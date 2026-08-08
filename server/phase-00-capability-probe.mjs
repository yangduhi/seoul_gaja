export const CAPABILITY_PROBE_NAME = "phase-00-capability-probe";
export const CAPABILITY_PROBE_PATH = "/api/internal/capability-probe/ingest";
export const CAPABILITY_PROBE_STATE = "probe";
const MAX_SYNTHETIC_PAYLOAD_BYTES = 4096;

import { RequestBodyTooLargeError, readJsonBodyWithinLimit } from "./request-body.mjs";

class CapabilityLifecycleError extends Error {
  constructor(message) {
    super(message);
    this.name = "CapabilityLifecycleError";
  }
}

/**
 * Keeps the disposable Phase 00 probe independent from production ingestion.
 * The adapter is deliberately small so local tests can prove the complete D1
 * lifecycle without inventing a second runtime or exposing a secret.
 */
export async function exerciseD1CapabilityLifecycle(adapter, probeId, payloadHash, options = {}) {
  const timeoutMs = normalizeTimeout(options.timeoutMs);

  try {
    await withTimeout("health", (signal) => adapter.health(signal), timeoutMs);

    const written = await withTimeout(
      "write",
      (signal) => adapter.write({ probeId, payloadHash }, signal),
      timeoutMs,
    );
    assertProbeRecord(written, probeId, payloadHash, "written");

    const read = await withTimeout("read", (signal) => adapter.read(probeId, signal), timeoutMs);
    assertProbeRecord(read, probeId, payloadHash, "written");

    const updated = await withTimeout("update", (signal) => adapter.update(probeId, signal), timeoutMs);
    assertProbeRecord(updated, probeId, payloadHash, "updated");

    const rolledBack = await withTimeout("rollback", (signal) => adapter.rollback(probeId, signal), timeoutMs);
    assertProbeRecord(rolledBack, probeId, payloadHash, "updated");

    return { probeId, cleanup: "confirmed" };
  } finally {
    const cleanup = await withTimeout("cleanup", (signal) => adapter.cleanup(probeId, signal), timeoutMs);
    if (!cleanup?.removed) {
      throw new CapabilityLifecycleError("Phase 00 cleanup was not confirmed");
    }
  }
}

export function authorizeCapabilityProbe(authorization, expectedToken, expiresAt, now = new Date().toISOString()) {
  if (typeof expectedToken !== "string" || expectedToken.length === 0) {
    return { kind: "unavailable" };
  }

  if (typeof authorization !== "string") {
    return { kind: "rejected" };
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/u);
  if (scheme !== "Bearer" || !token || extra || token !== expectedToken) {
    return { kind: "rejected" };
  }

  const expiry = Date.parse(expiresAt);
  const observedAt = Date.parse(now);
  if (!Number.isFinite(expiry) || !Number.isFinite(observedAt)) {
    return { kind: "unavailable" };
  }
  if (expiry <= observedAt) {
    return { kind: "expired" };
  }

  return { kind: "authorized" };
}

export function isCapabilityProbeEnabled(state) {
  return state === CAPABILITY_PROBE_STATE;
}

export function isSyntheticCapabilityProbePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value);
  return (
    entries.length === 2 &&
    value.kind === "phase_00_synthetic_probe" &&
    typeof value.token_id === "string" &&
    /^[a-z0-9][a-z0-9-]{0,63}$/u.test(value.token_id)
  );
}

export function createD1CapabilityAdapter(database) {
  return {
    async health() {
      await database.prepare("SELECT 1 AS phase_00_capability_health").first();
    },
    async write({ probeId, payloadHash }) {
      await database
        .prepare(
          "INSERT INTO phase_00_capability_probe (probe_id, payload_hash, state) VALUES (?, ?, 'written')",
        )
        .bind(probeId, payloadHash)
        .run();
      return readD1Probe(database, probeId);
    },
    async read(probeId) {
      return readD1Probe(database, probeId);
    },
    async update(probeId) {
      await database
        .prepare("UPDATE phase_00_capability_probe SET state = 'updated' WHERE probe_id = ?")
        .bind(probeId)
        .run();
      return readD1Probe(database, probeId);
    },
    async rollback(probeId) {
      try {
        await database.batch([
          database
            .prepare("UPDATE phase_00_capability_probe SET state = 'rollback_candidate' WHERE probe_id = ?")
            .bind(probeId),
          database
            .prepare(
              "INSERT INTO phase_00_capability_probe (probe_id, payload_hash, state) VALUES (?, ?, 'duplicate')",
            )
            .bind(probeId, "rollback-sentinel"),
        ]);
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        return readD1Probe(database, probeId);
      }

      return null;
    },
    async cleanup(probeId) {
      await database
        .prepare("DELETE FROM phase_00_capability_probe WHERE probe_id = ?")
        .bind(probeId)
        .run();
      const remaining = await readD1Probe(database, probeId);
      return { removed: remaining === null };
    },
  };
}

export function createCapabilityProbeRouteHandlers(environment, options = {}) {
  const now = options.now;
  const timeoutMs = options.timeoutMs;
  const createProbeId = options.createProbeId ?? (() => crypto.randomUUID());

  function authorizeRequest(request) {
    const authorization = authorizeCapabilityProbe(
      request.headers.get("authorization"),
      environment.SITE_INGEST_TOKEN,
      environment.SITE_INGEST_TOKEN_EXPIRES_AT,
      now,
    );
    if (authorization.kind === "unavailable") {
      return Response.json({ error: "capability_probe_unavailable" }, { status: 503 });
    }
    if (authorization.kind === "rejected") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    if (authorization.kind === "expired") {
      return Response.json({ error: "token_expired" }, { status: 401 });
    }
    return null;
  }

  async function GET(request) {
    if (!isCapabilityProbeEnabled(environment.PHASE_00_CAPABILITY_PROBE_STATE)) {
      return Response.json({ error: "capability_probe_disabled" }, { status: 404 });
    }

    const rejected = authorizeRequest(request);
    if (rejected) return rejected;

    try {
      await createD1CapabilityAdapter(environment.DB).health();
      return Response.json({ probe: CAPABILITY_PROBE_NAME, status: "healthy" });
    } catch (error) {
      if (error instanceof Error) {
        return Response.json({ probe: CAPABILITY_PROBE_NAME, status: "unavailable" }, { status: 503 });
      }
      throw error;
    }
  }

  async function POST(request) {
    if (!isCapabilityProbeEnabled(environment.PHASE_00_CAPABILITY_PROBE_STATE)) {
      return Response.json({ error: "capability_probe_disabled" }, { status: 404 });
    }

    const rejected = authorizeRequest(request);
    if (rejected) return rejected;

    let payload;
    try {
      payload = await readJsonBodyWithinLimit(request, MAX_SYNTHETIC_PAYLOAD_BYTES);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return Response.json({ error: "payload_too_large" }, { status: 413 });
      }
      if (error instanceof SyntaxError) {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }
      throw error;
    }
    if (!isSyntheticCapabilityProbePayload(payload)) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

    try {
      const probeId = createProbeId();
      const payloadHash = await sha256Payload(JSON.stringify(payload));
      const lifecycle = await exerciseD1CapabilityLifecycle(
        createD1CapabilityAdapter(environment.DB),
        probeId,
        payloadHash,
        { timeoutMs },
      );
      return Response.json(
        { probe: CAPABILITY_PROBE_NAME, probeId: lifecycle.probeId, cleanup: lifecycle.cleanup },
        { status: 202 },
      );
    } catch (error) {
      if (error instanceof Error) {
        return Response.json({ error: "capability_probe_unavailable" }, { status: 503 });
      }
      throw error;
    }
  }

  return { GET, POST };
}

async function readD1Probe(database, probeId) {
  const record = await database
    .prepare("SELECT probe_id, payload_hash, state FROM phase_00_capability_probe WHERE probe_id = ?")
    .bind(probeId)
    .first();

  if (!record) return null;
  return {
    probeId: record.probe_id,
    payloadHash: record.payload_hash,
    state: record.state,
  };
}

async function sha256Payload(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertProbeRecord(record, probeId, payloadHash, state) {
  if (
    !record ||
    record.probeId !== probeId ||
    record.payloadHash !== payloadHash ||
    record.state !== state
  ) {
    const stage = state === "updated" ? "rollback was not confirmed" : "D1 lifecycle state was not confirmed";
    throw new CapabilityLifecycleError(`Phase 00 ${stage}`);
  }
}

function normalizeTimeout(timeoutMs) {
  return Number.isSafeInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : 2000;
}

function withTimeout(stage, operation, timeoutMs) {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new CapabilityLifecycleError(`Phase 00 D1 ${stage} timed out`));
    }, timeoutMs);

    Promise.resolve()
      .then(() => operation(controller.signal))
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}
