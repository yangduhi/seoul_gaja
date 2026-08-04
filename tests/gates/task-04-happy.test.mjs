import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPABILITY_PROBE_NAME,
  CAPABILITY_PROBE_PATH,
  authorizeCapabilityProbe,
  exerciseD1CapabilityLifecycle,
} from "../../server/phase-00-capability-probe.mjs";

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

  const authorization = authorizeCapabilityProbe("Bearer test-token", "test-token");
  const result = await exerciseD1CapabilityLifecycle(adapter, "probe-1", "payload-hash");

  assert.deepEqual(authorization, { kind: "authorized" });
  assert.deepEqual(calls, ["health", "write", "read", "update", "rollback", "cleanup"]);
  assert.deepEqual(result, { probeId: "probe-1", cleanup: "confirmed" });
  assert.equal(CAPABILITY_PROBE_NAME, "phase-00-capability-probe");
  assert.equal(CAPABILITY_PROBE_PATH, "/api/internal/capability-probe/ingest");
});
