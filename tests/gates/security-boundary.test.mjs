import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityProbeRouteHandlers } from "../../server/phase-00-capability-probe.mjs";
import { handleIngestSnapshot } from "../../server/ingest-snapshot-request.mjs";

const AUTH_TOKEN = "token-redacted";
const FUTURE_EXPIRY = "2099-01-01T00:00:00.000Z";

function createHeaderlessJsonRequest(url, body, authorization = `Bearer ${AUTH_TOKEN}`) {
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return new Request(url, {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: stream,
    duplex: "half",
  });
}

function createEnvironment(overrides = {}) {
  return {
    DB: { prepare: () => ({ first: async () => ({ ok: 1 }) }) },
    SITE_INGEST_TOKEN: AUTH_TOKEN,
    SITE_INGEST_TOKEN_EXPIRES_AT: FUTURE_EXPIRY,
    PHASE_00_CAPABILITY_PROBE_STATE: "probe",
    ...overrides,
  };
}

test("Given a probe-enabled health route, when its bearer is missing, then it returns unauthorized without health disclosure", async () => {
  const handlers = createCapabilityProbeRouteHandlers(createEnvironment());

  const response = await handlers.GET(new Request("https://local.test/api/internal/capability-probe/health"));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});

test("Given a probe-enabled health route, when its bearer is wrong, then it returns unauthorized without health disclosure", async () => {
  const handlers = createCapabilityProbeRouteHandlers(createEnvironment());

  const response = await handlers.GET(new Request("https://local.test/api/internal/capability-probe/health", {
    headers: { authorization: "Bearer wrong-token" },
  }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});

test("Given a probe-enabled health route, when its matching bearer is expired, then it returns the existing expiry error without health disclosure", async () => {
  const handlers = createCapabilityProbeRouteHandlers(createEnvironment({ SITE_INGEST_TOKEN_EXPIRES_AT: "2026-01-01T00:00:00.000Z" }), {
    now: "2026-01-01T00:00:01.000Z",
  });

  const response = await handlers.GET(new Request("https://local.test/api/internal/capability-probe/health", {
    headers: { authorization: `Bearer ${AUTH_TOKEN}` },
  }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "token_expired" });
});

test("Given a headerless capability-probe body above 4 KiB, when POST reads it, then it rejects before JSON parsing", async () => {
  const handlers = createCapabilityProbeRouteHandlers(createEnvironment());
  const request = createHeaderlessJsonRequest(
    "https://local.test/api/internal/capability-probe/ingest",
    JSON.stringify({ kind: "phase_00_synthetic_probe", token_id: "manual-qa", padding: "x".repeat(4_097) }),
  );

  assert.equal(request.headers.get("content-length"), null);
  const response = await handlers.POST(request);

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "payload_too_large" });
});

test("Given a headerless canonical-ingest body above 1 MiB, when POST reads it, then it rejects before JSON parsing", async () => {
  const request = createHeaderlessJsonRequest(
    "https://local.test/api/internal/ingest/snapshot",
    JSON.stringify({ padding: "x".repeat(1_048_577) }),
  );

  assert.equal(request.headers.get("content-length"), null);
  const response = await handleIngestSnapshot(request, AUTH_TOKEN);

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "payload_too_large" });
});

test("Given a body stream that exceeds 1 MiB then stays open, when canonical ingest reads it, then it cancels and rejects within the test bound", { timeout: 100 }, async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1_048_577));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://local.test/api/internal/ingest/snapshot", {
    method: "POST",
    headers: { authorization: `Bearer ${AUTH_TOKEN}`, "content-type": "application/json" },
    body: stream,
    duplex: "half",
  });

  const response = await handleIngestSnapshot(request, AUTH_TOKEN);

  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
});
