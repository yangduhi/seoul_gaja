import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  authorizeCapabilityProbe,
  exerciseD1CapabilityLifecycle,
} from "../../server/phase-00-capability-probe.mjs";

test("Given a missing, invalid, or unavailable token, when authorization is checked, then the probe fails closed", () => {
  assert.deepEqual(authorizeCapabilityProbe(null, "test-token"), { kind: "rejected" });
  assert.deepEqual(authorizeCapabilityProbe("Bearer wrong-token", "test-token"), { kind: "rejected" });
  assert.deepEqual(authorizeCapabilityProbe("Bearer test-token", null), { kind: "unavailable" });
});

test("Given an unconfirmed rollback, when the lifecycle fails, then cleanup still runs and the failure is surfaced", async () => {
  let cleanupCalled = false;
  const adapter = {
    async health() {},
    async write({ probeId, payloadHash }) {
      return { probeId, payloadHash, state: "written" };
    },
    async read(probeId) {
      return { probeId, payloadHash: "payload-hash", state: "written" };
    },
    async update(probeId) {
      return { probeId, payloadHash: "payload-hash", state: "updated" };
    },
    async rollback() {
      return null;
    },
    async cleanup() {
      cleanupCalled = true;
      return { removed: true };
    },
  };

  await assert.rejects(
    exerciseD1CapabilityLifecycle(adapter, "probe-1", "payload-hash"),
    /rollback was not confirmed/,
  );
  assert.equal(cleanupCalled, true);
});

test("Given the source-backed probe routes, when the server boundary is inspected, then the secret stays server-only", async () => {
  const [ingest, health] = await Promise.all([
    readFile(new URL("../../app/api/internal/capability-probe/ingest/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/internal/capability-probe/health/route.js", import.meta.url), "utf8"),
  ]);

  assert.match(ingest, /import "server-only"/);
  assert.match(ingest, /env\.SITE_INGEST_TOKEN/);
  assert.doesNotMatch(ingest, /process\.env/);
  assert.match(ingest, /exerciseD1CapabilityLifecycle/);
  assert.match(health, /GET/);
});
