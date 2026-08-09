import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { handleIngestSnapshot } from "../../server/ingest-snapshot-request.mjs";
import { canonicalPayloadSha256 } from "../../server/provenance-cadence.mjs";
import { readProductViewModel } from "../../server/product-read-model.ts";
import { applyDrizzleMigrations, createSqliteD1 } from "./realdata-d1-sqlite.mjs";

const root = resolve(import.meta.dirname, "..", "..");
const migrationRoot = process.env.REALDATA_D1_MIGRATION_ROOT === undefined
  ? resolve(root, "drizzle")
  : resolve(process.env.REALDATA_D1_MIGRATION_ROOT);
const now = "2026-08-10T12:00:00.000Z";
const sourceUpdatedAt = "2026-08-10T11:55:00.000Z";
const fetchedAt = "2026-08-10T11:56:00.000Z";
const storedAt = "2026-08-10T11:57:00.000Z";

function shaFor(index) {
  return index.toString(16).padStart(64, "0");
}

async function completeSnapshot() {
  const catalogText = await readFile(resolve(root, "data", "seoul-places.json"), "utf8");
  const catalog = JSON.parse(catalogText.replace(/^\uFEFF/, ""));
  const rows = catalog.places.map((place, index) => ({
    areaCode: place.areaCode,
    areaName: place.areaName,
    availability: "available",
    provenance: "refreshed",
    crowdLevel: "NORMAL",
    populationMin: 100 + index,
    populationMax: 200 + index,
    sourceUpdatedAt,
    fetchedAt,
    rawHash: shaFor(index + 1),
    officialForecast: {
      authority: "official",
      sourceUpdatedAt,
      fetchedAt,
      rawHash: shaFor(index + 1),
      points: Array.from({ length: 6 }, (_, pointIndex) => ({
        timestamp: new Date(Date.parse(now) + (pointIndex + 1) * 60 * 60 * 1000).toISOString(),
        crowdLevel: "NORMAL",
        populationMin: 100 + index,
        populationMax: 200 + index,
        sourceUpdatedAt,
      })),
    },
  }));
  const canonicalPayload = {
    contractVersion: "1.0.0",
    snapshotId: "citydata-fixture-2026-08-10T11:55:00Z",
    catalogVersion: catalog.catalogVersion,
    rows,
    meta: { attempted: 121, refreshed: 121, carriedForward: 0, unavailable: 0 },
  };
  const payload = {
    ...canonicalPayload,
    payloadSha256: canonicalPayloadSha256(canonicalPayload),
    provenanceReceipt: {
      receipt_id: "fixture:realdata-d1-materialization:1",
      receipt_version: 1,
      workflow_run_id: "fixture-run-realdata-d1",
      collector_version: "fixture-collector",
      parser_version: "fixture-parser",
      catalog_version: catalog.catalogVersion,
      raw_response_sha256: shaFor(999),
      per_place_outcome_counts: { refreshed: 121, carried_forward: 0, unavailable: 0 },
      source_times: rows.map((row) => row.sourceUpdatedAt),
      fetch_times: rows.map((row) => row.fetchedAt),
      accepted_at: storedAt,
    },
  };
  return payload;
}

function request(payload) {
  return new Request("http://localhost/api/internal/ingest/snapshot", {
    method: "POST",
    headers: { authorization: "Bearer local-token", "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

test("Given the Sites migration package, when a semicolon-only D1-shaped executor applies it, then executable storage tables exist without immutable trigger bodies", async () => {
  // Given
  const database = createSqliteD1();

  try {
    // When
    await applyDrizzleMigrations(database, migrationRoot);

    // Then
    for (const table of [
      "place_catalog",
      "snapshot_runs",
      "current_snapshot",
      "raw_observation_15m",
      "detail_cache",
      "provenance_receipts",
      "phase_00_capability_probe",
    ]) assert.equal(await database.count(table), 0);
    assert.equal(await database.countTriggers(), 0);
  } finally {
    database.close();
  }
});

test("Given a complete 121-place official-shaped payload, when canonical ingest runs against fresh D1 storage, then the product read model is READY", async () => {
  // Given
  const database = createSqliteD1();
  const payload = await completeSnapshot();

  try {
    await applyDrizzleMigrations(database, migrationRoot);

    // When
    const response = await handleIngestSnapshot(request(payload), "local-token", database);
    const product = await readProductViewModel(database, { now, expectedCatalogCount: 121 });
    const replay = await handleIngestSnapshot(request(payload), "local-token", database);

    // Then
    assert.equal(response.status, 202);
    assert.match((await response.json()).canonicalPayloadSha256, /^[a-f0-9]{64}$/);
    assert.equal(replay.status, 202);
    assert.equal(product.status, "READY");
    assert.equal(await database.count("place_catalog"), 121);
    assert.equal(await database.count("current_snapshot"), 121);
    assert.equal(await database.count("raw_observation_15m"), 121);
    assert.equal(await database.count("detail_cache"), 121);
    assert.equal(await database.count("snapshot_runs"), 1);
    assert.equal(await database.countTriggers(), 4);
    assert.deepEqual(await database.triggerNames(), [
      "provenance_receipts_no_delete",
      "provenance_receipts_no_update",
      "provenance_source_bindings_no_delete",
      "provenance_source_bindings_no_update",
    ]);
    assert.equal((await database.prepare("SELECT payload_sha256 FROM snapshot_runs").first()).payload_sha256, payload.payloadSha256);
    if (product.status === "READY") {
      assert.equal(Object.keys(product.data.officialForecast.byAreaCode).length, 121);
      assert.equal(product.data.officialForecast.status, "READY");
      const forecasts = Object.values(product.data.officialForecast.byAreaCode);
      for (const forecast of forecasts) {
        assert.ok(forecast.points.filter((point) => Date.parse(point.timestamp) > Date.parse(now)).length >= 6);
        assert.ok(forecast.points.every((point) => point.snapshotId === payload.snapshotId));
      }
    }
    const forecastRows = await database.prepare("SELECT normalized_json FROM detail_cache").all();
    const zeroFabricatedRecommendationValues = !forecastRows.results.some((row) => /percentile|recommendation/i.test(String(row.normalized_json)));
    assert.equal(zeroFabricatedRecommendationValues, true);
    if (process.env.REALDATA_MANUAL_QA === "1") {
      process.stdout.write(`${JSON.stringify({
        firstStatus: response.status,
        readiness: product.status,
        triggerCount: await database.countTriggers(),
        catalogCount: await database.count("place_catalog"),
        currentCount: await database.count("current_snapshot"),
        forecastCount: await database.count("detail_cache"),
      })}\n`);
    }
  } finally {
    database.close();
  }
});

test("Given an accepted snapshot, when a stale receipt attempts to replace its immutable source bindings, then ingest returns 409 without mutation", async () => {
  // Given
  const database = createSqliteD1();
  const firstPayload = await completeSnapshot();
  const stalePayload = await completeSnapshot();
  stalePayload.provenanceReceipt = {
    ...stalePayload.provenanceReceipt,
    receipt_id: "fixture:realdata-d1-materialization:stale",
    workflow_run_id: "fixture-run-realdata-d1-stale",
  };

  try {
    await applyDrizzleMigrations(database, migrationRoot);
    const first = await handleIngestSnapshot(request(firstPayload), "local-token", database);

    // When
    const stale = await handleIngestSnapshot(request(stalePayload), "local-token", database);

    // Then
    assert.equal(first.status, 202);
    assert.equal(stale.status, 409);
    assert.deepEqual(await stale.json(), { error: "provenance_conflict" });
    assert.equal(await database.count("provenance_receipts"), 1);
    assert.equal(await database.count("provenance_source_bindings"), 2);
    assert.equal(await database.count("snapshot_runs"), 1);
    assert.equal(await database.count("current_snapshot"), 121);
  } finally {
    database.close();
  }
});

test("Given a payload with a missing or malformed official forecast, when canonical ingest validates it, then no acceptance or read-model rows are written", async () => {
  // Given
  const database = createSqliteD1();
  const missingForecast = await completeSnapshot();
  delete missingForecast.rows[0].officialForecast;
  const malformedForecast = await completeSnapshot();
  malformedForecast.rows[0].officialForecast.points[0].sourceUpdatedAt = "not-an-iso-timestamp";
  const malformedCanonicalPayload = structuredClone(malformedForecast);
  delete malformedCanonicalPayload.payloadSha256;
  delete malformedCanonicalPayload.provenanceReceipt;
  malformedForecast.payloadSha256 = canonicalPayloadSha256(malformedCanonicalPayload);

  try {
    await applyDrizzleMigrations(database, migrationRoot);

    // When
    const missingResponse = await handleIngestSnapshot(request(missingForecast), "local-token", database);
    const malformedResponse = await handleIngestSnapshot(request(malformedForecast), "local-token", database);

    // Then
    assert.equal(missingResponse.status, 422);
    assert.deepEqual(await missingResponse.json(), { error: "invalid_payload" });
    assert.equal(malformedResponse.status, 422);
    assert.deepEqual(await malformedResponse.json(), { error: "invalid_payload" });
    for (const table of ["provenance_receipts", "provenance_source_bindings", "snapshot_runs", "place_catalog", "current_snapshot", "raw_observation_15m", "detail_cache"]) {
      assert.equal(await database.count(table), 0);
    }
  } finally {
    database.close();
  }
});

test("Given an accepted payload and a trigger-bootstrap D1 failure, when ingest begins persistence, then it returns the documented storage failure with no accepted snapshot writes", async () => {
  // Given
  const database = createSqliteD1({ failTriggerBootstrap: true });
  const payload = await completeSnapshot();

  try {
    await applyDrizzleMigrations(database, migrationRoot);

    // When
    const response = await handleIngestSnapshot(request(payload), "local-token", database);

    // Then
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "provenance_storage_unavailable" });
    assert.equal(await database.countTriggers(), 0);
    for (const table of ["provenance_receipts", "provenance_source_bindings", "snapshot_runs", "place_catalog", "current_snapshot", "raw_observation_15m", "detail_cache"]) {
      assert.equal(await database.count(table), 0);
    }
  } finally {
    database.close();
  }
});

test("Given a forced materialization write failure, when canonical ingest batches acceptance with the read model, then no partial state remains", async () => {
  // Given
  const database = createSqliteD1({ failAtWrite: 13 });
  const payload = await completeSnapshot();

  try {
    await applyDrizzleMigrations(database, migrationRoot);

    // When
    const response = await handleIngestSnapshot(request(payload), "local-token", database);

    // Then
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "materialization_storage_error" });
    for (const table of ["provenance_receipts", "provenance_source_bindings", "snapshot_runs", "place_catalog", "current_snapshot", "raw_observation_15m", "detail_cache"]) {
      assert.equal(await database.count(table), 0);
    }
  } finally {
    database.close();
  }
});
