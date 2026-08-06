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
  assert.equal(surface.now.results[0].variant, "base");
  assert.equal(surface.now.results[0].selectedTimestamp, "2026-08-06T01:00:00Z");
  assert.equal(surface.now.results[0].sourceTimestamps.currentCrowd, "2026-08-06T00:00:00Z");
  assert.deepEqual(surface.now.results[0].reasons.map((reason) => reason.kind), [
    "current_crowd_percentile",
    "official_forecast_percentile",
  ]);
  assert.equal(surface.next.status, "READY");
});
