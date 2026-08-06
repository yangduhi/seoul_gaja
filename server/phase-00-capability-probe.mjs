export const CAPABILITY_PROBE_NAME = "phase-00-capability-probe";
export const CAPABILITY_PROBE_PATH = "/api/internal/capability-probe/ingest";

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_SYNTHETIC_PAYLOAD_BYTES = 4_096;

class CapabilityLifecycleError extends Error {
  constructor(message) {
    super(message);
    this.name = "CapabilityLifecycleError";
  }
}

export async function exerciseD1CapabilityLifecycle(adapter, probeId, payloadHash, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    await callAdapter(adapter, "health", [], timeoutMs);

    const written = await callAdapter(adapter, "write", [{ probeId, payloadHash }], timeoutMs);
    assertProbeRecord(written, probeId, payloadHash, "written");

    const read = await callAdapter(adapter, "read", [probeId], timeoutMs);
    assertProbeRecord(read, probeId, payloadHash, "written");

    const updated = await callAdapter(adapter, "update", [probeId], timeoutMs);
    assertProbeRecord(updated, probeId, payloadHash, "updated");

    const rolledBack = await callAdapter(adapter, "rollback", [probeId], timeoutMs);
    assertProbeRecord(rolledBack, probeId, payloadHash, "updated");

    return { probeId, cleanup: "confirmed" };
  } finally {
    const cleanup = await callAdapter(adapter, "cleanup", [probeId], timeoutMs);
    if (!cleanup?.removed) {
      throw new CapabilityLifecycleError("Phase 00 cleanup was not confirmed");
    }
  }
}

export function authorizeCapabilityProbe(authorization, expectedToken, expiresAt, now = Date.now()) {
  if (typeof expectedToken !== "string" || expectedToken.length === 0) {
    return { kind: "unavailable" };
  }

  if (expiresAt !== undefined && expiresAt !== null) {
    const expiry = Date.parse(expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now) return { kind: "expired" };
  }

  if (typeof authorization !== "string") return { kind: "rejected" };

  const [scheme, token, extra] = authorization.trim().split(/\s+/u);
  if (scheme !== "Bearer" || !token || extra || token !== expectedToken) {
    return { kind: "rejected" };
  }

  return { kind: "authorized" };
}

export function createCapabilityProbeRouteHandlers(env, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const createAdapter = options.createAdapter ?? createD1CapabilityAdapter;
  const now = options.now ?? Date.now;

  return {
    async GET() {
      if (isProbeDisabled(env)) return disabledResponse();

      try {
        await callAdapter(createAdapter(env.DB), "health", [], timeoutMs);
        return Response.json({ probe: CAPABILITY_PROBE_NAME, status: "healthy" });
      } catch (error) {
        if (error instanceof Error) {
          return Response.json({ probe: CAPABILITY_PROBE_NAME, status: "unavailable" }, { status: 503 });
        }
        throw error;
      }
    },

    async POST(request) {
      if (isProbeDisabled(env)) return disabledResponse();

      const authorization = authorizeCapabilityProbe(
        request.headers.get("authorization"),
        env.SITE_INGEST_TOKEN,
        env.SITE_INGEST_TOKEN_EXPIRES_AT,
        now(),
      );
      if (authorization.kind === "unavailable") {
        return Response.json({ error: "capability_probe_unavailable" }, { status: 503 });
      }
      if (authorization.kind === "expired") {
        return Response.json({ error: "capability_probe_token_expired" }, { status: 401 });
      }
      if (authorization.kind === "rejected") {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }

      let payload;
      try {
        payload = await parseSyntheticPayload(request, timeoutMs);
      } catch (error) {
        if (error instanceof SyntaxError) return Response.json({ error: "invalid_json" }, { status: 400 });
        if (error instanceof CapabilityLifecycleError) {
          return Response.json({ error: "payload_timeout" }, { status: 408 });
        }
        throw error;
      }
      if (!isSyntheticPayload(payload)) return Response.json({ error: "invalid_payload" }, { status: 400 });

      try {
        const probeId = crypto.randomUUID();
        const payloadHash = await sha256(JSON.stringify(payload));
        const lifecycle = await exerciseD1CapabilityLifecycle(
          createAdapter(env.DB), probeId, payloadHash, { timeoutMs },
        );
        return Response.json({ probe: CAPABILITY_PROBE_NAME, probeId: lifecycle.probeId, cleanup: lifecycle.cleanup }, { status: 202 });
      } catch (error) {
        if (error instanceof Error) {
          return Response.json({ error: "capability_probe_unavailable" }, { status: 503 });
        }
        throw error;
      }
    },
  };
}

export function createD1CapabilityAdapter(database) {
  return {
    health() {
      return database.prepare("SELECT 1 AS phase_00_capability_health").first();
    },
    async write({ probeId, payloadHash }) {
      await database.prepare(
        "INSERT INTO phase_00_capability_probe (probe_id, payload_hash, state) VALUES (?, ?, 'written')",
      ).bind(probeId, payloadHash).run();
      return readD1Probe(database, probeId);
    },
    read(probeId) {
      return readD1Probe(database, probeId);
    },
    async update(probeId) {
      await database.prepare("UPDATE phase_00_capability_probe SET state = 'updated' WHERE probe_id = ?")
        .bind(probeId).run();
      return readD1Probe(database, probeId);
    },
    async rollback(probeId) {
      try {
        await database.batch([
          database.prepare("UPDATE phase_00_capability_probe SET state = 'rollback_candidate' WHERE probe_id = ?").bind(probeId),
          database.prepare(
            "INSERT INTO phase_00_capability_probe (probe_id, payload_hash, state) VALUES (?, ?, 'duplicate')",
          ).bind(probeId, "rollback-sentinel"),
        ]);
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        return readD1Probe(database, probeId);
      }
      return null;
    },
    async cleanup(probeId) {
      await database.prepare("DELETE FROM phase_00_capability_probe WHERE probe_id = ?").bind(probeId).run();
      return { removed: (await readD1Probe(database, probeId)) === null };
    },
  };
}

async function parseSyntheticPayload(request, timeoutMs) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > MAX_SYNTHETIC_PAYLOAD_BYTES) {
    throw new SyntaxError("payload size is invalid");
  }
  const text = await withTimeout(() => request.text(), timeoutMs, "request body");
  if (new TextEncoder().encode(text).byteLength > MAX_SYNTHETIC_PAYLOAD_BYTES) {
    throw new SyntaxError("payload is too large");
  }
  return JSON.parse(text);
}

function isSyntheticPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "kind" || keys[1] !== "token_id") return false;
  return value.kind === "phase_00_synthetic_probe"
    && typeof value.token_id === "string"
    && /^[a-z0-9][a-z0-9-]{0,63}$/u.test(value.token_id);
}

function isProbeDisabled(env) {
  return env.PHASE_00_CAPABILITY_PROBE_STATE === "disabled";
}

function disabledResponse() {
  return Response.json({ error: "capability_probe_disabled" }, { status: 404 });
}

async function readD1Probe(database, probeId) {
  const record = await database.prepare(
    "SELECT probe_id, payload_hash, state FROM phase_00_capability_probe WHERE probe_id = ?",
  ).bind(probeId).first();
  if (!record) return null;
  return { probeId: record.probe_id, payloadHash: record.payload_hash, state: record.state };
}

async function callAdapter(adapter, method, argumentsList, timeoutMs) {
  if (typeof adapter?.[method] !== "function") {
    throw new CapabilityLifecycleError(`Phase 00 adapter method ${method} is unavailable`);
  }
  return withTimeout(() => adapter[method](...argumentsList), timeoutMs, `D1 ${method}`);
}

function withTimeout(operation, timeoutMs, operationName) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new CapabilityLifecycleError("Phase 00 timeout must be a positive integer");
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new CapabilityLifecycleError(`Phase 00 ${operationName} timed out`)), timeoutMs);
    Promise.resolve().then(operation).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function assertProbeRecord(record, probeId, payloadHash, state) {
  if (!record || record.probeId !== probeId || record.payloadHash !== payloadHash || record.state !== state) {
    const stage = state === "updated" ? "rollback was not confirmed" : "D1 lifecycle state was not confirmed";
    throw new CapabilityLifecycleError(`Phase 00 ${stage}`);
  }
}
