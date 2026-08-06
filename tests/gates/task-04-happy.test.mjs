import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPABILITY_PROBE_NAME,
  CAPABILITY_PROBE_PATH,
  authorizeCapabilityProbe,
  exerciseD1CapabilityLifecycle,
  isCapabilityProbeEnabled,
  createD1CapabilityAdapter,
} from "../../server/phase-00-capability-probe.mjs";
import { createLocalD1CapabilityDatabase } from "../fixtures/task-04/local-d1.mjs";

test("Given a matching server-side bearer token, when the disposable lifecycle runs, then health through cleanup succeeds", async () => {
  const calls = [];
  const adapter = {
    async health() {
      calls.push("health");
    },
    async write({ probeId, payloadHash }) {
      calls.push("write");
      return { probeId, payloadHash, state: "written" };
    },
    async read(probeId) {
      calls.push("read");
      return { probeId, payloadHash: "payload-hash", state: "written" };
    },
    async update(probeId) {
      calls.push("update");
      return { probeId, payloadHash: "payload-hash", state: "updated" };
    },
    async rollback(probeId) {
      calls.push("rollback");
      return { probeId, payloadHash: "payload-hash", state: "updated" };
    },
    async cleanup(probeId) {
      calls.push("cleanup");
      return { probeId, removed: true };
    },
  };

  const authorization = authorizeCapabilityProbe(
    "Bearer token-redacted",
    "token-redacted",
    "2026-08-06T00:01:00.000Z",
    "2026-08-06T00:00:00.000Z",
  );
  const result = await exerciseD1CapabilityLifecycle(adapter, "probe-1", "payload-hash");

  assert.deepEqual(authorization, { kind: "authorized" });
  assert.deepEqual(calls, ["health", "write", "read", "update", "rollback", "cleanup"]);
  assert.deepEqual(result, { probeId: "probe-1", cleanup: "confirmed" });
  assert.equal(CAPABILITY_PROBE_NAME, "phase-00-capability-probe");
  assert.equal(CAPABILITY_PROBE_PATH, "/api/internal/capability-probe/ingest");
  assert.equal(isCapabilityProbeEnabled("probe"), true);
  assert.equal(isCapabilityProbeEnabled("cleanup"), false);
});

test("Given the disposable Phase 00 migration, when the SQL-backed D1 lifecycle runs, then rollback and cleanup leave no synthetic row", async () => {
  const database = await createLocalD1CapabilityDatabase();
  try {
    const result = await exerciseD1CapabilityLifecycle(
      createD1CapabilityAdapter(database),
      "probe-sql",
      "payload-hash-sql",
    );
    assert.deepEqual(result, { probeId: "probe-sql", cleanup: "confirmed" });
    assert.equal(await createD1CapabilityAdapter(database).read("probe-sql"), null);
  } finally {
    database.close();
  }
});
