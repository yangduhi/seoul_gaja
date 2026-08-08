import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { readProductViewModel } from "../../../server/product-read-model.ts";

const fixturePath = resolve(import.meta.dirname, "../../fixtures/product/data/ready.json");
const now = "2026-08-06T00:30:00Z";

async function fixture() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

function database(data, { missingTable = null } = {}) {
  return {
    prepare(sql) {
      if (missingTable && sql.includes(missingTable)) {
        throw new Error(`no such table: ${missingTable}`);
      }
      const rows = sql.includes("FROM place_catalog")
        ? data.catalog
        : sql.includes("FROM current_snapshot")
          ? data.snapshot
          : sql.includes("FROM detail_cache")
            ? data.forecast
            : sql.includes("FROM raw_observation_15m")
              ? data.rawObservations ?? []
            : sql.includes("FROM weekday_hour_profile")
              ? data.history
              : [];
      return {
        async all() {
          return { results: rows };
        },
      };
    },
  };
}

test("Given valid snake_case D1 rows, when the product read model is loaded, then source-backed values map to camelCase", async () => {
  const result = await readProductViewModel(database(await fixture()), { now, expectedCatalogCount: 2 });

  assert.equal(result.status, "READY");
  assert.equal(result.data.catalog[0].areaCode, "alpha");
  assert.equal(result.data.catalog[0].areaName, "Alpha Place");
  assert.equal(result.data.snapshot.rows[1].availability, "carried_forward");
  assert.equal(result.data.snapshot.rows[0].sourceUpdatedAt, "2026-08-06T00:00:00Z");
  assert.equal(result.data.snapshot.rows[0].rawHash, "sha256-alpha");
  assert.equal(result.data.snapshot.rows[0].freshnessBasis, "source_updated_at");
  assert.equal(result.data.officialForecast.byAreaCode.alpha.points[0].crowdLevel, "NORMAL");
  assert.equal(result.data.officialForecast.byAreaCode.alpha.points[0].snapshotId, "snapshot-2026-08-06T00:00:00Z");
  assert.deepEqual(result.data.history, { status: "UNAVAILABLE", reason: "HISTORY_UNAVAILABLE" });
});

test("Given no DB binding, when the product read model is loaded, then it returns UNAVAILABLE without a fallback", async () => {
  const result = await readProductViewModel(null, { now, expectedCatalogCount: 2 });

  assert.deepEqual(result, { status: "UNAVAILABLE", reason: "DB_BINDING_MISSING" });
});

test("Given a missing D1 table, when the product read model is loaded, then it returns UNAVAILABLE", async () => {
  const result = await readProductViewModel(database(await fixture(), { missingTable: "current_snapshot" }), {
    now,
    expectedCatalogCount: 2,
  });

  assert.deepEqual(result, { status: "UNAVAILABLE", reason: "DB_TABLE_UNAVAILABLE" });
});

test("Given a malformed population range, when the snapshot is read, then the row is rejected", async () => {
  const data = await fixture();
  data.snapshot[0].population_min = -1;
  const result = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });

  assert.deepEqual(result, { status: "REJECTED", reason: "MALFORMED_SNAPSHOT_ROW" });
});

test("Given snapshot rows with different identities, when the snapshot is read, then it is rejected", async () => {
  const data = await fixture();
  data.snapshot[1].snapshot_id = "snapshot-other";
  const result = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });

  assert.deepEqual(result, { status: "REJECTED", reason: "MISMATCHED_SNAPSHOT" });
});

test("Given a source timestamp older than 180 minutes, when the snapshot is read, then it is unavailable", async () => {
  const data = await fixture();
  data.snapshot[0].source_updated_at = "2026-08-05T20:00:00Z";
  data.snapshot[1].source_updated_at = "2026-08-05T20:00:00Z";
  const result = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });

  assert.deepEqual(result, { status: "UNAVAILABLE", reason: "SNAPSHOT_EXPIRED" });
});

test("Given a source timestamp 120 minutes old, when the snapshot is read, then the row is classified stale", async () => {
  const data = await fixture();
  data.snapshot[0].source_updated_at = "2026-08-05T22:30:00Z";
  const result = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });

  assert.equal(result.status, "READY");
  assert.equal(result.data.snapshot.rows[0].freshness, "stale");
});

test("Given an available row without source time, when the snapshot is read, then fetched time is marked as degraded freshness basis", async () => {
  const data = await fixture();
  data.snapshot[0].source_updated_at = null;
  data.snapshot[0].fetched_at = "2026-08-06T00:10:00Z";
  const result = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });

  assert.equal(result.status, "READY");
  assert.equal(result.data.snapshot.rows[0].freshnessBasis, "fetched_at_degraded");
  assert.equal(result.data.snapshot.rows[0].freshness, "fresh");
});

test("Given degraded freshness based on a fetched time older than 180 minutes, when the snapshot is read, then it is unavailable", async () => {
  const data = await fixture();
  data.snapshot[0].source_updated_at = null;
  data.snapshot[0].fetched_at = "2026-08-05T20:00:00Z";
  const result = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });

  assert.deepEqual(result, { status: "UNAVAILABLE", reason: "SNAPSHOT_EXPIRED" });
});

test("Given every snapshot row is unavailable, when the snapshot is read, then activation is unavailable", async () => {
  const data = await fixture();
  for (const row of data.snapshot) {
    row.availability = "unavailable";
    row.source_updated_at = null;
  }
  const result = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });

  assert.deepEqual(result, { status: "UNAVAILABLE", reason: "SNAPSHOT_UNAVAILABLE" });
});

test("Given a synthetic forecast payload, when the data boundary is read, then it is rejected instead of used as official data", async () => {
  const data = await fixture();
  const payload = JSON.parse(data.forecast[0].normalized_json);
  payload.synthetic = true;
  data.forecast[0].normalized_json = JSON.stringify(payload);
  const result = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });

  assert.deepEqual(result, { status: "REJECTED", reason: "SYNTHETIC_FORECAST" });
});
