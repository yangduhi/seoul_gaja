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
            : sql.includes("FROM weekday_hour_profile")
              ? data.history
              : [];
      return { async all() { return { results: rows }; } };
    },
  };
}

test("Given the real product read model, when the route builds recommendation props, then source-backed NOW/NEXT fields reach the render boundary", async () => {
  const data = JSON.parse(await readFile(fixturePath, "utf8"));
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
  const betaHistory = data.history.find((row) => row.area_code === "beta");
  betaHistory.maturity = "PROVISIONAL";
  betaHistory.crowd_rank_median = 0.7;
  betaHistory.population_midpoint_median = 35;
  betaHistory.population_midpoint_iqr = 4;
  betaHistory.sample_count = 8;
  betaHistory.missing_count = 1;
  betaHistory.coverage = 0.8;
  const product = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });
  assert.equal(product.status, "READY");
  if (product.status !== "READY") return;

  const surface = buildRecommendationSurface(product.data, now);

  assert.equal(surface.now.status, "READY");
  assert.equal(surface.now.results[0].variant, "history-enhanced");
  assert.equal(surface.now.results[0].historyMaturity, "PROVISIONAL");
  assert.equal(surface.now.results[0].reasons.at(-1)?.kind, "history_deviation_percentile");
  assert.equal(typeof surface.now.results[0].sourceTimestamps.history, "string");
  assert.equal(hasOwnScore(surface), false);

  for (const row of data.history) row.computed_at = "2026-08-05T21:29:59Z";
  const staleProduct = await readProductViewModel(database(data), { now, expectedCatalogCount: 2 });
  assert.equal(staleProduct.status, "READY");
  if (staleProduct.status !== "READY") return;
  assert.equal(buildRecommendationSurface(staleProduct.data, now).now.status, "ZERO_ELIGIBLE");
});
