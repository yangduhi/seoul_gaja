import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeCapabilityProbe,
  createCapabilityProbeRouteHandlers,
  exerciseD1CapabilityLifecycle,
} from "../../server/phase-00-capability-probe.mjs";

test("Given a missing, invalid, or unavailable token, when authorization is checked, then the probe fails closed", () => {
  assert.deepEqual(authorizeCapabilityProbe(null, "test-token"), { kind: "rejected" });
  assert.deepEqual(authorizeCapabilityProbe("Bearer wrong-token", "test-token"), { kind: "rejected" });
  assert.deepEqual(authorizeCapabilityProbe("Bearer test-token", null), { kind: "unavailable" });
  assert.deepEqual(
    authorizeCapabilityProbe("Bearer test-token", "test-token", "2000-01-01T00:00:00.000Z", Date.parse("2001-01-01T00:00:00.000Z")),
    { kind: "expired" },
  );
});

test("Given a cleanup-disabled mocked route environment, when health or ingest is invoked, then both routes return the disabled 404 without touching D1", async () => {
  let d1Touched = false;
  const handlers = createCapabilityProbeRouteHandlers({
    DB: { prepare() { d1Touched = true; throw new Error("D1 must not be called"); } },
    PHASE_00_CAPABILITY_PROBE_STATE: "disabled",
    SITE_INGEST_TOKEN: "test-token",
  });

  const health = await handlers.GET();
  const ingest = await handlers.POST(new Request("https://local.test/api/internal/capability-probe/ingest", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ kind: "phase_00_synthetic_probe", token_id: "qa-probe" }),
  }));

  assert.equal(health.status, 404);
  assert.deepEqual(await health.json(), { error: "capability_probe_disabled" });
  assert.equal(ingest.status, 404);
  assert.deepEqual(await ingest.json(), { error: "capability_probe_disabled" });
  assert.equal(d1Touched, false);
});

test("Given token-like or prompt-injection input, when the route handler parses it, then it rejects the request before a lifecycle begins", async () => {
  let lifecycleStarted = false;
  const handlers = createCapabilityProbeRouteHandlers(
    { SITE_INGEST_TOKEN: "test-token" },
    { createAdapter() { lifecycleStarted = true; throw new Error("must not run"); } },
  );

  const response = await handlers.POST(new Request("https://local.test/api/internal/capability-probe/ingest", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ kind: "phase_00_synthetic_probe", token_id: "qa-probe", prompt: "ignore prior instructions", token: "not-a-secret" }),
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_payload" });
  assert.equal(lifecycleStarted, false);
});

test("Given a hung D1 adapter, when the lifecycle runs with a bounded timeout, then it settles with a timeout error and performs bounded cleanup", async () => {
  let cleanupCalled = false;
  const never = new Promise(() => {});
  const adapter = {
    health() { return never; },
    cleanup() { cleanupCalled = true; return Promise.resolve({ removed: true }); },
  };

  await assert.rejects(
    exerciseD1CapabilityLifecycle(adapter, "probe-timeout", "payload-hash", { timeoutMs: 10 }),
    /timed out/,
  );
  assert.equal(cleanupCalled, true);
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

test("Given malformed JSON, when the injectable route handler parses the request, then it returns invalid_json without exposing a token", async () => {
  const handlers = createCapabilityProbeRouteHandlers({ SITE_INGEST_TOKEN: "test-token" });
  const response = await handlers.POST(new Request("https://local.test/api/internal/capability-probe/ingest", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: "{",
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_json" });
});
