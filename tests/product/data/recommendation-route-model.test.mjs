import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { readProductViewModel } from "../../../server/product-read-model.ts";
import { buildRecommendationSurface } from "../../../server/recommendations.mjs";

const fixturePath = resolve(import.meta.dirname, "../../fixtures/product/data/ready.json");
const now = "2026-08-06T00:30:00Z";

function database(data) {
  return {
    prepare(sql) {
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
      return { async all() { return { results: rows }; } };
    },
  };
}

function authoritativeRawHistory() {
  const buckets = [
    "2026-07-09T00:30:00Z",
    "2026-07-16T00:30:00Z",
    "2026-07-23T00:30:00Z",
    "2026-07-30T00:30:00Z",
    "2026-08-06T00:30:00Z",
  ];
  return buckets.flatMap((observation_bucket) => [
    {
      area_code: "alpha",
      observation_bucket,
      snapshot_id: `raw-${observation_bucket}`,
      snapshot_status: "accepted",
      crowd_level: "NORMAL",
      availability: "available",
      source_updated_at: "2026-08-06T00:10:00Z",
    },
    {
      area_code: "beta",
      observation_bucket,
      snapshot_id: `raw-${observation_bucket}`,
      snapshot_status: "accepted",
      crowd_level: "BUSY",
      availability: "available",
      source_updated_at: "2026-08-06T00:10:00Z",
    },
  ]);
}

function forgeEligibleProfiles(rows) {
  for (const row of rows) {
    row.weekday = 4;
    row.hour = 9;
    row.local_time_bucket = "09:30";
    row.elapsed_days = 56;
    row.maturity = "MATURE";
    row.crowd_rank_median = 0;
    row.sample_count = 999;
    row.missing_count = 0;
    row.coverage = 1;
    row.computed_at = "2026-08-06T00:10:00Z";
  }
}

test("Given forged eligible weekday profiles but absent raw observations, when the ProductViewModel feeds recommendations, then history stays base", async () => {
  const data = JSON.parse(await readFile(fixturePath, "utf8"));
  forgeEligibleProfiles(data.history);

  const product = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });
  assert.equal(product.status, "READY");
  if (product.status !== "READY") return;

  const surface = buildRecommendationSurface(product.data, now);

  assert.equal(surface.now.status, "READY");
  assert.equal(surface.now.results.every((result) => result.variant === "base"), true);
});

test("Given authoritative raw observations at the exact Seoul weekday and 30-minute bucket, when forged profiles remain ineligible, then recommendations derive eligible history", async () => {
  const data = JSON.parse(await readFile(fixturePath, "utf8"));
  data.rawObservations = authoritativeRawHistory();
  for (const row of data.history) {
    row.local_time_bucket = "00:00";
    row.elapsed_days = 0;
    row.maturity = "ACCUMULATING";
    row.sample_count = 0;
    row.coverage = 0;
    row.computed_at = "2026-07-01T00:00:00Z";
  }

  const product = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });
  assert.equal(product.status, "READY");
  if (product.status !== "READY") return;

  const surface = buildRecommendationSurface(product.data, now);

  assert.equal(surface.now.status, "READY");
  assert.equal(surface.now.results.every((result) => result.variant === "history-enhanced"), true);
});

test("Given the real product read model, when the route builds recommendation props, then source-backed NOW/NEXT fields reach the render boundary", async () => {
  const data = JSON.parse(await readFile(fixturePath, "utf8"));
  data.rawObservations = authoritativeRawHistory();
  const product = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });
  assert.equal(product.status, "READY");
  if (product.status !== "READY") return;

  const surface = buildRecommendationSurface(product.data, now);

  assert.equal(surface.now.status, "READY");
  assert.equal(surface.now.mode, "NOW");
  assert.equal(surface.now.results[0].variant, "history-enhanced");
  assert.equal(Object.hasOwn(surface.now.results[0], "score"), false);
  assert.equal(surface.now.results[0].selectedTimestamp, "2026-08-06T01:00:00Z");
  assert.equal(surface.now.results[0].sourceTimestamps.currentCrowd, "2026-08-06T00:00:00Z");
  assert.deepEqual(surface.now.results[0].reasons.map((reason) => reason.kind), [
    "current_crowd_percentile",
    "official_forecast_percentile",
    "history_deviation_percentile",
  ]);
  assert.equal(surface.next.status, "READY");
});

function hasOwnScore(value) {
  if (Array.isArray(value)) return value.some(hasOwnScore);
  if (value !== null && typeof value === "object") {
    return Object.hasOwn(value, "score") || Object.values(value).some(hasOwnScore);
  }
  return false;
}

test("Given ProductViewModel history rows at the current Seoul weekday and hour, when the route builds recommendations, then eligible history is enhanced and stale history is suppressed", async () => {
  const data = JSON.parse(await readFile(fixturePath, "utf8"));
  data.rawObservations = authoritativeRawHistory();
  const betaHistory = data.history.find((row) => row.area_code === "beta");
  betaHistory.maturity = "PROVISIONAL";
  betaHistory.crowd_rank_median = 0.7;
  betaHistory.population_midpoint_median = 35;
  betaHistory.population_midpoint_iqr = 4;
  betaHistory.sample_count = 8;
  betaHistory.missing_count = 1;
  betaHistory.coverage = 0.8;
  betaHistory.local_time_bucket = "09:30";
  betaHistory.elapsed_days = 7;
  const product = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });
  assert.equal(product.status, "READY");
  if (product.status !== "READY") return;

  const surface = buildRecommendationSurface(product.data, now);

  assert.equal(surface.now.status, "READY");
  assert.equal(surface.now.results[0].variant, "history-enhanced");
  assert.equal(surface.now.results[0].historyMaturity, "STABLE");
  assert.equal(surface.now.results[0].reasons.at(-1)?.kind, "history_deviation_percentile");
  assert.equal(typeof surface.now.results[0].sourceTimestamps.history, "string");
  assert.equal(hasOwnScore(surface), false);

  for (const row of data.rawObservations) row.source_updated_at = "2026-08-05T21:29:59Z";
  const staleProduct = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });
  assert.equal(staleProduct.status, "READY");
  if (staleProduct.status !== "READY") return;
  assert.equal(buildRecommendationSurface(staleProduct.data, now).now.status, "ZERO_ELIGIBLE");
});

test("Given history provenance that is missing, mismatched, or below the sample threshold, when recommendations are built from ProductViewModel, then history enhancement fails closed", async () => {
  for (const update of [
    (row) => { delete row.local_time_bucket; },
    (row) => { row.local_time_bucket = "09:00"; },
    (row) => { delete row.elapsed_days; },
    (row) => { row.sample_count = 0; },
  ]) {
    const data = JSON.parse(await readFile(fixturePath, "utf8"));
    for (const row of data.history) {
      row.maturity = "PROVISIONAL";
      row.crowd_rank_median ??= 0.7;
      row.coverage = 0.7;
      row.elapsed_days = 7;
      row.local_time_bucket = "09:30";
      row.sample_count = 4;
      update(row);
    }
    const product = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });
    assert.equal(product.status, "READY");
    if (product.status !== "READY") return;
    const surface = buildRecommendationSurface(product.data, now);
    assert.equal(surface.now.status, "READY");
    assert.equal(surface.now.results.every((result) => result.variant === "base"), true);
    assert.equal(surface.now.results.every((result) => result.reasons.every((reason) => reason.kind !== "history_deviation_percentile")), true);
  }
});

test("Given malformed or duplicate raw observations, when the ProductViewModel feeds recommendations, then ordinary browsing stays ready and history stays base", async () => {
  for (const mutate of [
    (rows) => { rows[0].crowd_level = "PROMPT_INJECTION"; },
    (rows) => { rows.push({ ...rows[0] }); },
    (rows) => { rows[0].observation_bucket = "not-an-iso-timestamp"; },
  ]) {
    const data = JSON.parse(await readFile(fixturePath, "utf8"));
    data.rawObservations = authoritativeRawHistory();
    mutate(data.rawObservations);
    const product = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });

    assert.equal(product.status, "READY");
    if (product.status !== "READY") return;
    assert.deepEqual(product.data.history, { status: "UNAVAILABLE", reason: "HISTORY_UNAVAILABLE" });
    assert.equal(buildRecommendationSurface(product.data, now).now.results.every((result) => result.variant === "base"), true);
  }
});

test("Given raw observations without accepted snapshot provenance, in the future, or off the 15-minute grid, when recommendations are built, then history fails closed", async () => {
  for (const mutate of [
    (rows) => { rows[0].snapshot_status = "rejected"; },
    (rows) => { delete rows[0].snapshot_id; },
    (rows) => { rows[0].observation_bucket = "2026-08-06T00:45:00Z"; },
    (rows) => { rows[0].observation_bucket = "2026-07-09T00:17:00Z"; },
  ]) {
    const data = JSON.parse(await readFile(fixturePath, "utf8"));
    data.rawObservations = authoritativeRawHistory();
    mutate(data.rawObservations);

    const product = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });
    assert.equal(product.status, "READY");
    if (product.status !== "READY") continue;

    const surface = buildRecommendationSurface(product.data, now);
    assert.equal(surface.now.status, "READY");
    assert.equal(surface.now.results.every((result) => result.variant === "base"), true);
  }
});
