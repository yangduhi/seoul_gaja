import type {
  CatalogPlace,
  D1Row,
  ForecastPlace,
  ForecastPoint,
  ForecastView,
  HistoryProfile,
  HistoryView,
  RejectionReason,
  SnapshotRow,
  SnapshotView,
  UnavailableReason,
} from "./product-read-model.ts";

const AVAILABILITIES = ["available", "carried_forward", "unavailable", "expired"] as const;
const PROVENANCES = ["refreshed", "carried_forward", "missing"] as const;
const CROWD_LEVELS = ["RELAXED", "NORMAL", "BUSY", "CROWDED", "UNKNOWN"] as const;
const FORECAST_CROWD_LEVELS = ["RELAXED", "NORMAL", "BUSY", "CROWDED"] as const;
const MATURITIES = ["ACCUMULATING", "PROVISIONAL", "STABLE", "MATURE"] as const;
const UNAVAILABLE_CACHE_STATES = ["empty", "unavailable", "expired"] as const;
const MAX_SOURCE_AGE_MS = 180 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const FORECAST_POINT_COUNT = 6;

export function parseCatalog(rows: readonly D1Row[], expectedCount: number): { readonly status: "READY"; readonly places: readonly CatalogPlace[] } | Readonly<{ readonly status: "REJECTED"; readonly reason: "MALFORMED_CATALOG_ROW" }> {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 1 || rows.length !== expectedCount) return { status: "REJECTED", reason: "MALFORMED_CATALOG_ROW" };
  const seen = new Set<string>();
  const places: CatalogPlace[] = [];
  for (const row of rows) {
    const areaCode = nonEmptyString(row.area_code);
    const areaName = nonEmptyString(row.area_name);
    const catalogVersion = nonEmptyString(row.catalog_version);
    const latitude = nullableFiniteNumber(row.latitude);
    const longitude = nullableFiniteNumber(row.longitude);
    const category = row.category === null || row.category === undefined ? null : nonEmptyString(row.category);
    if (areaCode === null || areaName === null || catalogVersion === null || latitude === undefined || longitude === undefined || category === undefined || seen.has(areaCode)) return { status: "REJECTED", reason: "MALFORMED_CATALOG_ROW" };
    seen.add(areaCode);
    places.push({ areaCode, areaName, category, latitude, longitude, catalogVersion });
  }
  return { status: "READY", places };
}

export function parseSnapshot(rows: readonly D1Row[], catalog: readonly CatalogPlace[], now: number): { readonly status: "READY"; readonly view: SnapshotView } | Readonly<{ readonly status: "UNAVAILABLE"; readonly reason: UnavailableReason }> | Readonly<{ readonly status: "REJECTED"; readonly reason: RejectionReason }> {
  if (rows.length !== catalog.length) return { status: "UNAVAILABLE", reason: "SNAPSHOT_UNAVAILABLE" };
  const catalogByCode = new Map(catalog.map((place) => [place.areaCode, place]));
  const seen = new Set<string>();
  const mapped: SnapshotRow[] = [];
  let snapshotId: string | null = null;
  let catalogVersion: string | null = null;
  let hasUnavailable = false;
  for (const row of rows) {
    const areaCode = nonEmptyString(row.area_code);
    const place = areaCode === null ? undefined : catalogByCode.get(areaCode);
    const currentSnapshotId = nonEmptyString(row.snapshot_id);
    const currentCatalogVersion = nonEmptyString(row.catalog_version);
    const availability = literal(row.availability, AVAILABILITIES);
    const provenance = literal(row.provenance, PROVENANCES);
    const crowdLevel = literal(row.crowd_level, CROWD_LEVELS);
    const sourceUpdatedAt = nullableIso(row.source_updated_at);
    const fetchedAt = iso(row.fetched_at);
    const storedAt = iso(row.stored_at);
    const populationMin = nullableInteger(row.population_min);
    const populationMax = nullableInteger(row.population_max);
    const rawHash = nullableString(row.raw_hash);
    if (place === undefined || seen.has(areaCode ?? "") || currentSnapshotId === null || currentCatalogVersion === null || availability === null || provenance === null || crowdLevel === null || sourceUpdatedAt === undefined || fetchedAt === null || storedAt === null || populationMin === undefined || populationMax === undefined || rawHash === undefined || (row.snapshot_status !== "accepted" && row.snapshot_status !== "replayed") || currentCatalogVersion !== place.catalogVersion || !validRange(populationMin, populationMax)) return { status: "REJECTED", reason: "MALFORMED_SNAPSHOT_ROW" };
    if (snapshotId !== null && currentSnapshotId !== snapshotId || catalogVersion !== null && currentCatalogVersion !== catalogVersion) return { status: "REJECTED", reason: "MISMATCHED_SNAPSHOT" };
    snapshotId = currentSnapshotId;
    catalogVersion = currentCatalogVersion;
    seen.add(areaCode);
    if (availability === "expired") return { status: "UNAVAILABLE", reason: "SNAPSHOT_EXPIRED" };
    const freshnessBasis = sourceUpdatedAt === null ? "fetched_at_degraded" : "source_updated_at";
    const freshnessTimestamp = sourceUpdatedAt ?? fetchedAt;
    const age = now - Date.parse(freshnessTimestamp);
    if (age < -MAX_FUTURE_SKEW_MS) return { status: "UNAVAILABLE", reason: "SNAPSHOT_FUTURE_TIMESTAMP" };
    if (age > MAX_SOURCE_AGE_MS) return { status: "UNAVAILABLE", reason: "SNAPSHOT_EXPIRED" };
    hasUnavailable ||= availability === "unavailable";
    mapped.push({ areaCode, areaName: place.areaName, snapshotId: currentSnapshotId, catalogVersion: currentCatalogVersion, sourceUpdatedAt, fetchedAt, storedAt, availability, provenance, crowdLevel, populationMin, populationMax, rawHash, freshness: classifyFreshness(age), freshnessBasis });
  }
  if (snapshotId === null || catalogVersion === null || mapped.length !== catalog.length || seen.size !== catalog.length) return { status: "UNAVAILABLE", reason: "SNAPSHOT_UNAVAILABLE" };
  if (!mapped.some((row) => row.availability !== "unavailable")) return { status: "UNAVAILABLE", reason: "SNAPSHOT_UNAVAILABLE" };
  return { status: "READY", view: { status: hasUnavailable ? "PARTIAL" : "READY", snapshotId, catalogVersion, rows: mapped } };
}

export function parseForecast(rows: readonly D1Row[], catalog: readonly CatalogPlace[], snapshotId: string, now: number): { readonly status: "READY"; readonly view: ForecastView } | Readonly<{ readonly status: "UNAVAILABLE"; readonly reason: UnavailableReason }> | Readonly<{ readonly status: "REJECTED"; readonly reason: RejectionReason }> {
  const byAreaCode = new Map<string, ForecastPlace>();
  for (const row of rows) {
    const areaCode = nonEmptyString(row.area_code);
    if (areaCode === null || !catalog.some((place) => place.areaCode === areaCode) || byAreaCode.has(areaCode) || row.section_name !== "official_forecast" || iso(row.source_updated_at) === null || iso(row.fetched_at) === null || iso(row.expires_at) === null) return { status: "REJECTED", reason: "MALFORMED_FORECAST" };
    if (row.state !== "available") return literal(row.state, UNAVAILABLE_CACHE_STATES) === null ? { status: "REJECTED", reason: "MALFORMED_FORECAST" } : { status: "UNAVAILABLE", reason: "OFFICIAL_FORECAST_UNAVAILABLE" };
    const expiresAt = Date.parse(String(row.expires_at));
    if (expiresAt <= now) return { status: "UNAVAILABLE", reason: "OFFICIAL_FORECAST_UNAVAILABLE" };
    if (row.normalized_json === null || typeof row.normalized_json !== "string") return { status: "UNAVAILABLE", reason: "OFFICIAL_FORECAST_UNAVAILABLE" };
    let parsed: unknown;
    try { parsed = JSON.parse(row.normalized_json); } catch (error) { if (error instanceof SyntaxError) return { status: "REJECTED", reason: "MALFORMED_FORECAST" }; throw error; }
    if (!isRecord(parsed) || parsed.authority !== "official") return { status: "REJECTED", reason: "MALFORMED_FORECAST" };
    if (parsed.synthetic === true) return { status: "REJECTED", reason: "SYNTHETIC_FORECAST" };
    const pointRows = Array.isArray(parsed.points) ? parsed.points : [];
    if (pointRows.length < FORECAST_POINT_COUNT) return { status: "UNAVAILABLE", reason: "OFFICIAL_FORECAST_UNAVAILABLE" };
    const points: ForecastPoint[] = [];
    const seen = new Set<string>();
    for (const point of pointRows) {
      if (!isRecord(point)) return { status: "REJECTED", reason: "MALFORMED_FORECAST" };
      const timestamp = iso(point.timestamp);
      const pointSource = iso(point.source_updated_at);
      const crowdLevel = literal(point.crowd_level, FORECAST_CROWD_LEVELS);
      const pointSnapshotId = nonEmptyString(point.snapshot_id);
      const populationMin = nullableInteger(point.population_min);
      const populationMax = nullableInteger(point.population_max);
      const percentile = optionalPercentile(point.percentile);
      if (timestamp === null || pointSource === null || crowdLevel === null || pointSnapshotId === null || pointSnapshotId !== snapshotId || point.synthetic === true || point.authority !== undefined && point.authority !== "official" || populationMin === undefined || populationMax === undefined || percentile === undefined || !validRange(populationMin, populationMax) || seen.has(timestamp)) return { status: "REJECTED", reason: point.synthetic === true ? "SYNTHETIC_FORECAST" : "MALFORMED_FORECAST" };
      if (Date.parse(pointSource) - now > MAX_FUTURE_SKEW_MS || now - Date.parse(pointSource) > MAX_SOURCE_AGE_MS) return { status: "UNAVAILABLE", reason: "OFFICIAL_FORECAST_UNAVAILABLE" };
      seen.add(timestamp);
      points.push({ timestamp, crowdLevel, sourceUpdatedAt: pointSource, snapshotId: pointSnapshotId, populationMin, populationMax, ...(percentile === null ? {} : { percentile }) });
    }
    if (points.filter((point) => Date.parse(point.timestamp) > now).length < FORECAST_POINT_COUNT) return { status: "UNAVAILABLE", reason: "OFFICIAL_FORECAST_UNAVAILABLE" };
    byAreaCode.set(areaCode, { sourceUpdatedAt: String(row.source_updated_at), fetchedAt: String(row.fetched_at), points });
  }
  if (byAreaCode.size !== catalog.length) return { status: "UNAVAILABLE", reason: "OFFICIAL_FORECAST_UNAVAILABLE" };
  return { status: "READY", view: { status: "READY", byAreaCode: Object.fromEntries(byAreaCode) } };
}

export function parseHistory(rows: readonly D1Row[], catalog: readonly CatalogPlace[]): { readonly status: "READY"; readonly view: HistoryView } | Readonly<{ readonly status: "UNAVAILABLE"; readonly reason: UnavailableReason }> | Readonly<{ readonly status: "REJECTED"; readonly reason: RejectionReason }> {
  const byAreaCode = new Map<string, { readonly profiles: readonly HistoryProfile[] }>();
  const catalogCodes = new Set(catalog.map((place) => place.areaCode));
  for (const row of rows) {
    const areaCode = nonEmptyString(row.area_code);
    const weekday = integer(row.weekday);
    const hour = integer(row.hour);
    const maturity = literal(row.maturity, MATURITIES);
    const crowdRankMedian = nullablePercentile(row.crowd_rank_median);
    const populationMidpointMedian = nullableFiniteNumber(row.population_midpoint_median);
    const populationMidpointIqr = nullableFiniteNumber(row.population_midpoint_iqr);
    const sampleCount = nonNegativeInteger(row.sample_count);
    const missingCount = nonNegativeInteger(row.missing_count);
    const coverage = percentile(row.coverage);
    const computedAt = iso(row.computed_at);
    if (areaCode === null || !catalogCodes.has(areaCode) || weekday === null || weekday < 0 || weekday > 6 || hour === null || hour < 0 || hour > 23 || maturity === null || crowdRankMedian === undefined || populationMidpointMedian === undefined || populationMidpointIqr === undefined || sampleCount === null || missingCount === null || coverage === null || computedAt === null) return { status: "REJECTED", reason: "MALFORMED_HISTORY_ROW" };
    const profile = { weekday, hour, maturity, crowdRankMedian, populationMidpointMedian, populationMidpointIqr, sampleCount, missingCount, coverage, computedAt };
    byAreaCode.set(areaCode, { profiles: [...(byAreaCode.get(areaCode)?.profiles ?? []), profile] });
  }
  if (byAreaCode.size !== catalog.length) return { status: "UNAVAILABLE", reason: "HISTORY_UNAVAILABLE" };
  return { status: "READY", view: { status: "READY", byAreaCode: Object.fromEntries(byAreaCode) } };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function nonEmptyString(value: unknown): string | null { return typeof value === "string" && value.trim().length > 0 ? value : null; }
function nullableString(value: unknown): string | null | undefined { return value === null || value === undefined ? null : nonEmptyString(value) ?? undefined; }
function iso(value: unknown): string | null { return typeof value === "string" && /(?:Z|[+-]\d\d:\d\d)$/u.test(value) && Number.isFinite(Date.parse(value)) ? value : null; }
function nullableIso(value: unknown): string | null | undefined { return value === null || value === undefined ? null : iso(value) ?? undefined; }
function integer(value: unknown): number | null { return typeof value === "number" && Number.isSafeInteger(value) ? value : null; }
function nonNegativeInteger(value: unknown): number | null { const result = integer(value); return result !== null && result >= 0 ? result : null; }
function nullableInteger(value: unknown): number | null | undefined { return value === null || value === undefined ? null : nonNegativeInteger(value) ?? undefined; }
function nullableFiniteNumber(value: unknown): number | null | undefined { return value === null || value === undefined ? null : typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function percentile(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null; }
function nullablePercentile(value: unknown): number | null | undefined { return value === null || value === undefined ? null : percentile(value) ?? undefined; }
function optionalPercentile(value: unknown): number | null | undefined { return value === undefined ? null : percentile(value) ?? undefined; }
function literal<T extends readonly string[]>(value: unknown, values: T): T[number] | null { return typeof value === "string" && values.includes(value) ? value : null; }
function validRange(min: number | null, max: number | null): boolean { return min === null && max === null || min !== null && max !== null && max >= min; }
function classifyFreshness(ageMs: number): "fresh" | "delayed" | "stale" { const age = Math.max(0, ageMs); return age <= 30 * 60 * 1000 ? "fresh" : age <= 90 * 60 * 1000 ? "delayed" : "stale"; }
