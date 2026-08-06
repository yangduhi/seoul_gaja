import {
  parseCatalog,
  parseForecast,
  parseHistory,
  parseSnapshot,
} from "./product-read-model-parsers.ts";

const CATALOG_COUNT = 121;

export type D1Row = Readonly<Record<string, unknown>>;

export interface D1StatementLike {
  all<T extends D1Row = D1Row>(): Promise<{ readonly results: readonly T[] }>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
}

export type ProductReadOptions = Readonly<{
  readonly now?: string | number | Date;
  readonly expectedCatalogCount?: number;
}>;

export type ProductReadResult =
  | Readonly<{ readonly status: "READY"; readonly data: ProductViewModel }>
  | Readonly<{ readonly status: "UNAVAILABLE"; readonly reason: UnavailableReason }>
  | Readonly<{ readonly status: "REJECTED"; readonly reason: RejectionReason }>;

export type ProductViewModel = Readonly<{
  readonly catalog: readonly CatalogPlace[];
  readonly snapshot: SnapshotView;
  readonly officialForecast: ForecastView;
  readonly history: HistoryView;
}>;

export type CatalogPlace = Readonly<{
  readonly areaCode: string;
  readonly areaName: string;
  readonly category: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly catalogVersion: string;
}>;

export type SnapshotRow = Readonly<{
  readonly areaCode: string;
  readonly areaName: string;
  readonly snapshotId: string;
  readonly catalogVersion: string;
  readonly sourceUpdatedAt: string | null;
  readonly fetchedAt: string;
  readonly storedAt: string;
  readonly availability: "available" | "carried_forward" | "unavailable" | "expired";
  readonly provenance: "refreshed" | "carried_forward" | "missing";
  readonly crowdLevel: "RELAXED" | "NORMAL" | "BUSY" | "CROWDED" | "UNKNOWN";
  readonly populationMin: number | null;
  readonly populationMax: number | null;
}>;

export type SnapshotView = Readonly<{
  readonly status: "READY" | "PARTIAL";
  readonly snapshotId: string;
  readonly catalogVersion: string;
  readonly rows: readonly SnapshotRow[];
}>;

export type ForecastPoint = Readonly<{
  readonly timestamp: string;
  readonly crowdLevel: "RELAXED" | "NORMAL" | "BUSY" | "CROWDED";
  readonly sourceUpdatedAt: string;
  readonly snapshotId: string;
  readonly populationMin: number | null;
  readonly populationMax: number | null;
  readonly percentile?: number;
}>;

export type ForecastPlace = Readonly<{
  readonly sourceUpdatedAt: string;
  readonly fetchedAt: string;
  readonly points: readonly ForecastPoint[];
}>;

export type ForecastView =
  | Readonly<{ readonly status: "READY"; readonly byAreaCode: Readonly<Record<string, ForecastPlace>> }>
  | Readonly<{ readonly status: "UNAVAILABLE"; readonly reason: "OFFICIAL_FORECAST_UNAVAILABLE" }>;

export type HistoryProfile = Readonly<{
  readonly weekday: number;
  readonly hour: number;
  readonly maturity: "ACCUMULATING" | "PROVISIONAL" | "STABLE" | "MATURE";
  readonly crowdRankMedian: number | null;
  readonly populationMidpointMedian: number | null;
  readonly populationMidpointIqr: number | null;
  readonly sampleCount: number;
  readonly missingCount: number;
  readonly coverage: number;
  readonly computedAt: string;
}>;

export type HistoryView =
  | Readonly<{ readonly status: "READY"; readonly byAreaCode: Readonly<Record<string, Readonly<{ readonly profiles: readonly HistoryProfile[] }>>> }>
  | Readonly<{ readonly status: "UNAVAILABLE"; readonly reason: "HISTORY_UNAVAILABLE" }>;

export type UnavailableReason =
  | "DB_BINDING_MISSING"
  | "DB_TABLE_UNAVAILABLE"
  | "DB_READ_UNAVAILABLE"
  | "SNAPSHOT_UNAVAILABLE"
  | "SNAPSHOT_EXPIRED"
  | "SNAPSHOT_FUTURE_TIMESTAMP"
  | "OFFICIAL_FORECAST_UNAVAILABLE"
  | "HISTORY_UNAVAILABLE";

export type RejectionReason =
  | "MALFORMED_CATALOG_ROW"
  | "MALFORMED_SNAPSHOT_ROW"
  | "MISMATCHED_SNAPSHOT"
  | "MALFORMED_FORECAST"
  | "SYNTHETIC_FORECAST"
  | "MALFORMED_HISTORY_ROW";

const CATALOG_SQL = "SELECT area_code, area_name, category, latitude, longitude, catalog_version FROM place_catalog WHERE active = 1 ORDER BY area_code";
const SNAPSHOT_SQL = "SELECT c.area_code, c.source_updated_at, c.fetched_at, c.stored_at, c.snapshot_id, c.availability, c.provenance, c.crowd_level, c.population_min, c.population_max, s.catalog_version, s.status AS snapshot_status FROM current_snapshot AS c INNER JOIN snapshot_runs AS s ON s.snapshot_id = c.snapshot_id";
const FORECAST_SQL = "SELECT area_code, section_name, source_updated_at, fetched_at, expires_at, state, normalized_json FROM detail_cache WHERE section_name = 'official_forecast'";
const HISTORY_SQL = "SELECT area_code, weekday, hour, maturity, crowd_rank_median, population_midpoint_median, population_midpoint_iqr, sample_count, missing_count, coverage, computed_at FROM weekday_hour_profile";

export async function readProductViewModel(
  database: D1DatabaseLike | null | undefined,
  options: ProductReadOptions = {},
): Promise<ProductReadResult> {
  if (database === null || database === undefined || typeof database.prepare !== "function") {
    return { status: "UNAVAILABLE", reason: "DB_BINDING_MISSING" };
  }
  const now = resolveNow(options.now);
  if (now === null) return { status: "UNAVAILABLE", reason: "DB_READ_UNAVAILABLE" };

  try {
    const [catalogRows, snapshotRows, forecastRows, historyRows] = await Promise.all([
      readRows(database, CATALOG_SQL),
      readRows(database, SNAPSHOT_SQL),
      readRows(database, FORECAST_SQL),
      readRows(database, HISTORY_SQL),
    ]);
    if (catalogRows === null || snapshotRows === null || forecastRows === null || historyRows === null) {
      return { status: "UNAVAILABLE", reason: "DB_TABLE_UNAVAILABLE" };
    }
    const catalogResult = parseCatalog(catalogRows, options.expectedCatalogCount ?? CATALOG_COUNT);
    if (catalogResult.status === "REJECTED") return catalogResult;
    const snapshotResult = parseSnapshot(snapshotRows, catalogResult.places, now);
    if (snapshotResult.status !== "READY") return snapshotResult;
    const forecastResult = parseForecast(forecastRows, catalogResult.places, snapshotResult.view.snapshotId, now);
    if (forecastResult.status === "REJECTED") return forecastResult;
    const historyResult = parseHistory(historyRows, catalogResult.places);
    if (historyResult.status === "REJECTED") return historyResult;
    return {
      status: "READY",
      data: {
        catalog: catalogResult.places,
        snapshot: snapshotResult.view,
        officialForecast: forecastResult.view,
        history: historyResult.view,
      },
    };
  } catch (error) {
    if (error instanceof Error && isMissingTableError(error)) return { status: "UNAVAILABLE", reason: "DB_TABLE_UNAVAILABLE" };
    if (error instanceof Error) return { status: "UNAVAILABLE", reason: "DB_READ_UNAVAILABLE" };
    throw error;
  }
}

export const readProductData = readProductViewModel;

async function readRows(database: D1DatabaseLike, sql: string): Promise<readonly D1Row[] | null> {
  try {
    return (await database.prepare(sql).all()).results;
  } catch (error) {
    if (error instanceof Error && isMissingTableError(error)) return null;
    throw error;
  }
}

function isMissingTableError(error: Error): boolean {
  return /no such table|does not exist|unknown table|binding.*unavailable/i.test(error.message);
}

function resolveNow(value: ProductReadOptions["now"]): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return Date.now();
}
