export const CAPABILITY_PROBE_NAME = "phase-00-capability-probe";
export const CAPABILITY_PROBE_PATH = "/api/internal/capability-probe/ingest";
export const CAPABILITY_PROBE_STATE = "probe";

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
