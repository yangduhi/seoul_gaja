import assert from "node:assert/strict";
import test from "node:test";

import { handleIngestSnapshot } from "../../server/ingest-snapshot-request.mjs";

const token = "local-fixture-token";

function validPayload() {
  const rows = Array.from({ length: 121 }, (_, index) => ({
    areaCode: `AREA-${String(index + 1).padStart(3, "0")}`,
    areaName: `Area ${index + 1}`,
    availability: "available",
    provenance: "refreshed",
    crowdLevel: "NORMAL",
    sourceUpdatedAt: "2026-08-06T10:00:00Z",
    fetchedAt: "2026-08-06T10:01:00Z",
  }));
  return { contractVersion: "1.0.0", snapshotId: "snapshot-local-001", catalogVersion: "catalog-v1", rows, meta: { attempted: 121, refreshed: 121, carriedForward: 0, unavailable: 0 } };
}

function request(payload, options = {}) {
  return new Request("http://localhost/api/internal/ingest/snapshot", {
    method: options.method ?? "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: options.method === "GET" ? undefined : payload,
  });
}

test("Given a valid normalized snapshot, When the canonical handler receives it, Then it returns an accepted contract receipt", async () => {
  const response = await handleIngestSnapshot(request(JSON.stringify(validPayload())), token);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { status: "accepted", snapshotId: "snapshot-local-001", catalogVersion: "catalog-v1", attempted: 121 });
});

test("Given malformed JSON, When the canonical handler parses it, Then it rejects the boundary", async () => {
  const response = await handleIngestSnapshot(request("{"), token);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_json" });
});

test("Given storage-only field names, When the canonical handler validates the API payload, Then it rejects snake_case", async () => {
  const payload = validPayload();
  payload.rows[0].source_updated_at = payload.rows[0].sourceUpdatedAt;
  const response = await handleIngestSnapshot(request(JSON.stringify(payload)), token);
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "invalid_payload" });
});

test("Given the wrong method or bearer token, When the canonical handler receives it, Then it rejects the request", async () => {
  const getResponse = await handleIngestSnapshot(request(undefined, { method: "GET" }), token);
  assert.equal(getResponse.status, 405);
  const unauthorized = await handleIngestSnapshot(request(JSON.stringify(validPayload())), "different-token");
  assert.equal(unauthorized.status, 401);
});
