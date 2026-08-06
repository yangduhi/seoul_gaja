import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  authorizeCapabilityProbe,
  exerciseD1CapabilityLifecycle,
  isSyntheticCapabilityProbePayload,
} from "../../server/phase-00-capability-probe.mjs";

test("Given a missing, invalid, or unavailable token, when authorization is checked, then the probe fails closed", () => {
  assert.deepEqual(authorizeCapabilityProbe(null, "test-token"), { kind: "rejected" });
  assert.deepEqual(authorizeCapabilityProbe("Bearer wrong-token", "test-token"), { kind: "rejected" });
  assert.deepEqual(authorizeCapabilityProbe("Bearer test-token", null), { kind: "unavailable" });
});

test("Given an expired server-side token, when an otherwise matching bearer token is checked, then the probe rejects it", () => {
  assert.deepEqual(
    authorizeCapabilityProbe("Bearer token-redacted", "token-redacted", "2026-08-06T00:00:00.000Z", "2026-08-06T00:00:01.000Z"),
    { kind: "expired" },
  );
});

test("Given malformed or token-like synthetic input, when the probe payload is parsed, then it cannot override header authentication", () => {
  assert.equal(isSyntheticCapabilityProbePayload(null), false);
  assert.equal(isSyntheticCapabilityProbePayload([]), false);
  assert.equal(isSyntheticCapabilityProbePayload({ kind: "phase_00_synthetic_probe" }), false);
  assert.equal(
    isSyntheticCapabilityProbePayload({
      kind: "phase_00_synthetic_probe",
      token_id: "token-id-redacted",
      authorization: "Bearer token-redacted",
    }),
    false,
  );
  assert.deepEqual(authorizeCapabilityProbe("Bearer injected-token", "token-redacted"), { kind: "rejected" });
});

test("Given the local D1 migration path, when the capability table contract is inspected, then SQL-backed lifecycle storage is declared", async () => {
  const migration = await readFile(new URL("../../migrations/0004_phase_00_capability_probe.sql", import.meta.url), "utf8");
  const schema = await readFile(new URL("../../db/schema.ts", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS phase_00_capability_probe/);
  assert.match(schema, /phase00CapabilityProbe/);
});

test("Given the Phase 00 owner checklist, when activation is reviewed, then state and expiry settings are explicit", async () => {
  const contract = await readFile(new URL("../../docs/execution/contracts/phase-00-capability-contract.md", import.meta.url), "utf8");
  assert.match(contract, /PHASE_00_CAPABILITY_PROBE_STATE=probe/);
  assert.match(contract, /SITE_INGEST_TOKEN_EXPIRES_AT/);
  assert.match(contract, /future RFC 3339 expiry/);
  assert.match(contract, /sets the state to `cleanup`/);
});

test("Given a matching candidate receipt, when its identity is checked, then it binds the current exact commit and tree", async () => {
  const receipt = JSON.parse(await readFile(new URL("../../docs/evidence/phase-00/phase-receipt.json", import.meta.url), "utf8"));
  const commit = execFileSync("git", ["rev-parse", "HEAD^"], { encoding: "utf8" }).trim();
  const tree = execFileSync("git", ["rev-parse", `${commit}^{tree}`], { encoding: "utf8" }).trim();
  assert.equal(receipt.commit, commit);
  assert.equal(receipt.tree, tree);
});

test("Given a hung D1 health operation, when the disposable lifecycle runs, then it times out and reaches cleanup", async () => {
  let cleanupCalled = false;
  const adapter = {
    async health() {
      return new Promise(() => {});
    },
    async cleanup() {
      cleanupCalled = true;
      return { removed: true };
    },
  };

  const outcome = await Promise.race([
    exerciseD1CapabilityLifecycle(adapter, "probe-1", "payload-hash", { timeoutMs: 5 }).then(
      () => new Error("completed"),
      (error) => error,
    ),
    new Promise((resolve) => setTimeout(() => resolve(new Error("test timeout")), 40)),
  ]);
  assert.equal(outcome instanceof Error ? outcome.message : "completed", "Phase 00 D1 health timed out");
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

test("Given the source-backed probe routes, when the server boundary is inspected, then the secret stays server-only", async () => {
  const [ingest, health, server] = await Promise.all([
    readFile(new URL("../../app/api/internal/capability-probe/ingest/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/internal/capability-probe/health/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../server/phase-00-capability-probe.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(ingest, /import "server-only"/);
  assert.match(server, /environment\.SITE_INGEST_TOKEN/);
  assert.match(server, /environment\.SITE_INGEST_TOKEN_EXPIRES_AT/);
  assert.match(server, /environment\.PHASE_00_CAPABILITY_PROBE_STATE/);
  assert.match(server, /capability_probe_disabled/);
  assert.doesNotMatch(ingest, /process\.env/);
  assert.doesNotMatch(server, /process\.env/);
  assert.match(server, /createCapabilityProbeRouteHandlers/);
  assert.match(server, /exerciseD1CapabilityLifecycle/);
  assert.match(health, /GET/);
  assert.match(server, /capability_probe_disabled/);
});
