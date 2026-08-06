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
const HISTORY_CROWD_VALUES = Object.freeze({ RELAXED: 0, NORMAL: 1, BUSY: 2, CROWDED: 3 });
const WEEKDAYS = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });
const USABLE_SNAPSHOT_STATUSES = ["accepted", "replayed"] as const;
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
    if (areaCode === null || place === undefined || seen.has(areaCode)) return { status: "REJECTED", reason: "MALFORMED_SNAPSHOT_ROW" };
    if (currentSnapshotId === null || currentCatalogVersion === null || availability === null || provenance === null || crowdLevel === null || sourceUpdatedAt === undefined || fetchedAt === null || storedAt === null || populationMin === undefined || populationMax === undefined || rawHash === undefined || (row.snapshot_status !== "accepted" && row.snapshot_status !== "replayed") || currentCatalogVersion !== place.catalogVersion || !validRange(populationMin, populationMax)) return { status: "REJECTED", reason: "MALFORMED_SNAPSHOT_ROW" };
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

export function parseRawHistory(rows: readonly D1Row[], catalog: readonly CatalogPlace[], now: number): HistoryView {
  const catalogCodes = new Set(catalog.map((place) => place.areaCode));
  const seen = new Set<string>();
  const observations: { readonly areaCode: string; readonly bucket: string; readonly timestamp: number; readonly value: number | null; readonly population: number | null; readonly sourceUpdatedAt: string; readonly key: string }[] = [];
  for (const row of rows) {
    const areaCode = nonEmptyString(row.area_code), bucket = iso(row.observation_bucket), snapshotId = nonEmptyString(row.snapshot_id), snapshotStatus = literal(row.snapshot_status, USABLE_SNAPSHOT_STATUSES), availability = literal(row.availability, AVAILABILITIES), sourceUpdatedAt = iso(row.source_updated_at);
    if (areaCode === null || !catalogCodes.has(areaCode) || bucket === null || snapshotId === null || snapshotStatus === null || availability === null || sourceUpdatedAt === null) return unavailableHistory();
    const timestamp = Date.parse(bucket), normalizedBucket = new Date(timestamp).toISOString(), duplicate = `${areaCode}|${normalizedBucket}`;
    const bucketDate = new Date(timestamp);
    const crowd = rawCrowdValue(row.crowd_level), population = rawPopulationMidpoint(row.population_min, row.population_max);
    if (timestamp > now || bucketDate.getUTCMinutes() % 15 !== 0 || bucketDate.getUTCSeconds() !== 0 || bucketDate.getUTCMilliseconds() !== 0 || seen.has(duplicate) || crowd === undefined || population === undefined) return unavailableHistory();
    seen.add(duplicate);
    const basis = koreaHistoryBasis(timestamp);
    observations.push({ areaCode, bucket: normalizedBucket, timestamp, value: availability === "available" || availability === "carried_forward" ? crowd : null, population, sourceUpdatedAt, key: `${areaCode}|${basis.weekday}|${basis.hour}|${basis.localTimeBucket}` });
  }
  const buckets = new Map<string, typeof observations>();
  for (const observation of observations) if (observation.value !== null) buckets.set(observation.bucket, [...(buckets.get(observation.bucket) ?? []), observation]);
  const profiles = new Map<string, { valid: { readonly rank: number; readonly population: number | null; readonly timestamp: number; readonly sourceUpdatedAt: string }[]; missingCount: number }>();
  for (const observation of observations) {
    const cohort = buckets.get(observation.bucket) ?? [], denominator = Math.max(1, cohort.length - 1);
    const crowdValue = observation.value;
    const rank = crowdValue === null ? undefined : cohort.filter((candidate) => candidate.value !== null && candidate.value < crowdValue).length / denominator;
    const profile = profiles.get(observation.key) ?? { valid: [], missingCount: 0 };
    profiles.set(observation.key, rank === undefined ? { ...profile, missingCount: profile.missingCount + 1 } : { ...profile, valid: [...profile.valid, { rank, population: observation.population, timestamp: observation.timestamp, sourceUpdatedAt: observation.sourceUpdatedAt }] });
  }
  const byAreaCode = new Map<string, Readonly<{ readonly profiles: readonly HistoryProfile[] }>>();
  for (const [key, profile] of profiles) {
    if (profile.valid.length === 0) continue;
    const [areaCode, weekdayText, hourText, localTimeBucket] = key.split("|");
    if (areaCode === undefined || weekdayText === undefined || hourText === undefined || localTimeBucket === undefined) return unavailableHistory();
    const samples = profile.valid.length, elapsedDays = (Math.max(...profile.valid.map((item) => item.timestamp)) - Math.min(...profile.valid.map((item) => item.timestamp))) / 86_400_000, coverage = samples / (samples + profile.missingCount);
    const populations = profile.valid.flatMap((item) => item.population === null ? [] : [item.population]);
    const value: HistoryProfile = { weekday: Number(weekdayText), hour: Number(hourText), localTimeBucket, maturity: rawMaturity(samples, elapsedDays, coverage), crowdRankMedian: rawPercentile(profile.valid.map((item) => item.rank), 0.5), populationMidpointMedian: populations.length === 0 ? null : rawPercentile(populations, 0.5), populationMidpointIqr: populations.length < 2 ? null : rawPercentile(populations, 0.75) - rawPercentile(populations, 0.25), sampleCount: samples, elapsedDays, missingCount: profile.missingCount, coverage, computedAt: profile.valid.map((item) => item.sourceUpdatedAt).sort().at(-1) ?? "" };
    byAreaCode.set(areaCode, { profiles: [...(byAreaCode.get(areaCode)?.profiles ?? []), value] });
  }
  return byAreaCode.size === 0 ? unavailableHistory() : { status: "READY", byAreaCode: Object.fromEntries(byAreaCode) };
}

function rawCrowdValue(value: unknown): number | null | undefined { if (value === null || value === undefined || value === "UNKNOWN") return null; return typeof value === "string" && Object.hasOwn(HISTORY_CROWD_VALUES, value) ? HISTORY_CROWD_VALUES[value as keyof typeof HISTORY_CROWD_VALUES] : undefined; }
function rawPopulationMidpoint(minimum: unknown, maximum: unknown): number | null | undefined { if ((minimum === null || minimum === undefined) && (maximum === null || maximum === undefined)) return null; return typeof minimum === "number" && Number.isFinite(minimum) && minimum >= 0 && typeof maximum === "number" && Number.isFinite(maximum) && maximum >= minimum ? (minimum + maximum) / 2 : undefined; }
function rawMaturity(samples: number, elapsedDays: number, coverage: number): HistoryProfile["maturity"] { if (samples < 4) return "ACCUMULATING"; if (elapsedDays >= 56 && coverage >= 0.9) return "MATURE"; if (elapsedDays >= 28 && coverage >= 0.8) return "STABLE"; return elapsedDays >= 7 && coverage >= 0.7 ? "PROVISIONAL" : "ACCUMULATING"; }
function rawPercentile(values: readonly number[], rank: number): number { const sorted = [...values].sort((left, right) => left - right), index = (sorted.length - 1) * rank, lower = Math.floor(index), upper = Math.ceil(index), lowerValue = sorted[lower] ?? 0, upperValue = sorted[upper] ?? lowerValue; return lowerValue + (upperValue - lowerValue) * (index - lower); }
function koreaHistoryBasis(timestamp: number): Readonly<{ readonly weekday: number; readonly hour: number; readonly localTimeBucket: string }> { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(timestamp)), values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])); return { weekday: WEEKDAYS[values.weekday as keyof typeof WEEKDAYS], hour: Number(values.hour), localTimeBucket: `${values.hour}:${Number(values.minute) < 30 ? "00" : "30"}` }; }
function unavailableHistory(): HistoryView { return { status: "UNAVAILABLE", reason: "HISTORY_UNAVAILABLE" }; }

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
function optionalPercentile(value: unknown): number | null | undefined { return value === undefined ? null : percentile(value) ?? undefined; }
function literal<T extends readonly string[]>(value: unknown, values: T): T[number] | null { return typeof value === "string" && values.includes(value) ? value : null; }
function validRange(min: number | null, max: number | null): boolean { return min === null && max === null || min !== null && max !== null && max >= min; }
function classifyFreshness(ageMs: number): "fresh" | "delayed" | "stale" { const age = Math.max(0, ageMs); return age <= 30 * 60 * 1000 ? "fresh" : age <= 90 * 60 * 1000 ? "delayed" : "stale"; }
