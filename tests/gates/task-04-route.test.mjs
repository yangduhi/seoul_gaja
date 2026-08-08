import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createLocalD1CapabilityDatabase } from "../fixtures/task-04/local-d1.mjs";
import {
  createCapabilityProbeRouteHandlers,
  createD1CapabilityAdapter,
} from "../../server/phase-00-capability-probe.mjs";

const AUTH_TOKEN = "token-redacted";
const EXPIRY = "2099-01-01T00:00:00.000Z";

function makeEnvironment(database, overrides = {}) {
  return {
    DB: database,
    SITE_INGEST_TOKEN: AUTH_TOKEN,
    SITE_INGEST_TOKEN_EXPIRES_AT: EXPIRY,
    PHASE_00_CAPABILITY_PROBE_STATE: "probe",
    ...overrides,
  };
}

test("Given the route factory, when a valid synthetic POST is handled, then D1 lifecycle success is observable", async () => {
  const database = await createLocalD1CapabilityDatabase();
  try {
    const handlers = createCapabilityProbeRouteHandlers(makeEnvironment(database), {
      createProbeId: () => "route-probe",
    });
    const response = await handlers.POST(
      new Request("https://local.test/api/internal/capability-probe/ingest", {
        method: "POST",
        headers: {
          authorization: `Bearer ${AUTH_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ kind: "phase_00_synthetic_probe", token_id: "manual-qa" }),
      }),
    );

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), {
      probe: "phase-00-capability-probe",
      probeId: "route-probe",
      cleanup: "confirmed",
    });
    assert.equal(await createD1CapabilityAdapter(database).read("route-probe"), null);
  } finally {
    database.close();
  }
});

test("Given a probe-enabled route, when health is requested, then the SQL-backed adapter reports healthy", async () => {
  const database = await createLocalD1CapabilityDatabase();
  try {
    const handlers = createCapabilityProbeRouteHandlers(makeEnvironment(database));
    const response = await handlers.GET(new Request("https://local.test/api/internal/capability-probe/health", {
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      probe: "phase-00-capability-probe",
      status: "healthy",
    });
  } finally {
    database.close();
  }
});

test("Given a probe-enabled route, when auth or JSON is malformed, then the boundary rejects it", async () => {
  const database = await createLocalD1CapabilityDatabase();
  try {
    const handlers = createCapabilityProbeRouteHandlers(makeEnvironment(database));
    const missingAuth = await handlers.POST(
      new Request("https://local.test/api/internal/capability-probe/ingest", {
        method: "POST",
        body: "{}",
      }),
    );
    const invalidJson = await handlers.POST(
      new Request("https://local.test/api/internal/capability-probe/ingest", {
        method: "POST",
        headers: {
          authorization: `Bearer ${AUTH_TOKEN}`,
          "content-type": "application/json",
        },
        body: "{",
      }),
    );

    assert.equal(missingAuth.status, 401);
    assert.deepEqual(await missingAuth.json(), { error: "unauthorized" });
    assert.equal(invalidJson.status, 400);
    assert.deepEqual(await invalidJson.json(), { error: "invalid_json" });
  } finally {
    database.close();
  }
});

test("Given a valid request and an unavailable D1 binding, when POST is handled, then the route fails closed", async () => {
  const handlers = createCapabilityProbeRouteHandlers(makeEnvironment(undefined));
  const response = await handlers.POST(
    new Request("https://local.test/api/internal/capability-probe/ingest", {
      method: "POST",
      headers: {
        authorization: `Bearer ${AUTH_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ kind: "phase_00_synthetic_probe", token_id: "manual-qa" }),
    }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "capability_probe_unavailable" });
});

test("Given cleanup state, when health and POST are handled, then both routes are disabled", async () => {
  const database = await createLocalD1CapabilityDatabase();
  try {
    const handlers = createCapabilityProbeRouteHandlers(
      makeEnvironment(database, { PHASE_00_CAPABILITY_PROBE_STATE: "cleanup" }),
    );
    const health = await handlers.GET();
    const post = await handlers.POST(new Request("https://local.test/api/internal/capability-probe/ingest", { method: "POST" }));

    assert.equal(health.status, 404);
    assert.equal(post.status, 404);
  } finally {
    database.close();
  }
});

test("Given the parent integration identity, when the canonical receipt is checked, then it must be regenerated instead of using HEAD^", async () => {
  const receipt = JSON.parse(await readFile(new URL("../../docs/evidence/phase-00/phase-receipt.json", import.meta.url), "utf8"));
  const commit = execFileSync(
    "git",
    ["log", "-1", "--format=%H", "--", "docs/codex-pack-v4/scripts/run_command_map.py"],
    { encoding: "utf8" },
  ).trim();
  const tree = execFileSync("git", ["rev-parse", `${commit}^{tree}`], { encoding: "utf8" }).trim();
  assert.equal(receipt.commit, commit);
  assert.equal(receipt.tree, tree);
});
