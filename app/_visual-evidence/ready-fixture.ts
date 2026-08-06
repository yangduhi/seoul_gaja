import readyData from "../../tests/fixtures/product/data/ready.json";
import type { ProductViewModel } from "../../server/product-read-model";
import { parseCatalog, parseForecast, parseRawHistory, parseSnapshot } from "../../server/product-read-model-parsers";

class VisualFixtureError extends Error {
  readonly stage: string;

  constructor(stage: string) {
    super(`The checked-in ready fixture failed at ${stage}`);
    this.name = "VisualFixtureError";
    this.stage = stage;
  }
}

function buildReadyVisualFixture(): ProductViewModel {
  const catalog = parseCatalog(readyData.catalog, readyData.catalog.length);
  if (catalog.status !== "READY") throw new VisualFixtureError("catalog");
  const now = Date.parse("2026-08-06T00:30:00Z");
  const snapshot = parseSnapshot(readyData.snapshot, catalog.places, now);
  if (snapshot.status !== "READY") throw new VisualFixtureError("snapshot");
  const forecast = parseForecast(readyData.forecast, catalog.places, snapshot.view.snapshotId, now);
  if (forecast.status !== "READY") throw new VisualFixtureError("official forecast");
  const history = parseRawHistory([], catalog.places, now);
  return { catalog: catalog.places, snapshot: snapshot.view, officialForecast: forecast.view, history };
}

export const readyVisualFixture = buildReadyVisualFixture();
