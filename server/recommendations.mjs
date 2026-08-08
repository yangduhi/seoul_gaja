import { buildRecommendationInput } from './recommendation-input.mjs';

const MAX_SOURCE_AGE_MS = 180 * 60 * 1000;
const ZERO_ELIGIBLE_COPY = 'No source-backed crowd-and-time recommendations are available right now.';
const FORBIDDEN_INPUT_KEYS = [
  'bestTime',
  'bestTimeClaim',
  'child',
  'childScore',
  'cultureEvent',
  'date',
  'dateScore',
  'event',
  'eventScore',
  'exactCrowd',
  'exactCrowdCount',
  'incident',
  'incidentScore',
  'momentum',
  'momentumScore',
  'noIncident',
  'parking',
  'parkingScore',
  'purpose',
  'purposeFit',
  'safety',
  'safetyScore',
  'transport',
  'transportScore',
  'trending',
  'trendingScore',
];

function time(value) {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function percentile(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function sourceIsAvailable(input, now) {
  const sourceTime = time(input?.sourceUpdatedAt);
  return input?.status === 'available' && sourceTime !== null && now >= sourceTime && now - sourceTime <= MAX_SOURCE_AGE_MS;
}

function koreaTimeBasis(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const value = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { weekday: value.weekday, localTimeBucket: `${value.hour}:${Number(value.minute) < 30 ? '00' : '30'}` };
}

function horizonBucket(timestamp) {
  return `${new Date(timestamp).toISOString().slice(0, 13)}:00:00Z`;
}

function historyIsAvailable(history, basis, now) {
  return history?.status === 'available'
    && percentile(history.percentile)
    && sourceIsAvailable({ status: history.status, sourceUpdatedAt: history.computedAt }, now)
    && history.weekday === basis.weekday
    && history.localTimeBucket === basis.localTimeBucket;
}

function sameCohort(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((areaCode, index) => areaCode === expected[index]);
}

function forecastCoreIsAvailable(point, snapshotId, now) {
  const timestamp = time(point?.timestamp);
  return sourceIsAvailable(point, now)
    && point.authority === 'official'
    && point.snapshotId === snapshotId
    && percentile(point.percentile)
    && timestamp !== null
    && point.horizonBucket === horizonBucket(timestamp)
    && point.interpolated !== true
    && point.extrapolated !== true;
}

function forecastCohorts(input, snapshotId, now, current) {
  const cohorts = new Map();
  for (const place of input.places) {
    if (!current.includes(place.areaCode)) continue;
    for (const point of place.officialForecasts ?? []) {
      if (!forecastCoreIsAvailable(point, snapshotId, now)) continue;
      const bucket = point.horizonBucket;
      const areaCodes = cohorts.get(bucket) ?? [];
      if (!areaCodes.includes(place.areaCode)) areaCodes.push(place.areaCode);
      cohorts.set(bucket, areaCodes);
    }
  }
  for (const [bucket, areaCodes] of cohorts) {
    const sorted = areaCodes.sort();
    if (sameCohort(sorted, current)) cohorts.set(bucket, sorted);
    else cohorts.delete(bucket);
  }
  return cohorts;
}

function selectedForecast(place, mode, snapshotId, now, historyEnhanced, history, cohorts) {
  const upperBound = now + (mode === 'NOW' ? 60 : 180) * 60 * 1000;
  const points = place.officialForecasts?.filter((point) => {
    const timestamp = time(point?.timestamp);
    const cohort = cohorts.get(point?.horizonBucket);
    return timestamp !== null
      && timestamp > now
      && timestamp <= upperBound
      && forecastCoreIsAvailable(point, snapshotId, now)
      && Array.isArray(cohort)
      && sameCohort(point.cohort, cohort);
  }) ?? [];
  if (points.length === 0) return null;
  const score = (point) => historyEnhanced
    ? 0.5 * place.currentCrowd.percentile + 0.3 * point.percentile + 0.2 * history.percentile
    : mode === 'NOW'
      ? 0.6 * place.currentCrowd.percentile + 0.4 * point.percentile
      : 0.4 * place.currentCrowd.percentile + 0.6 * point.percentile;
  points.sort((left, right) => score(left) - score(right) || time(left.timestamp) - time(right.timestamp));
  if (mode === 'NOW') points.sort((left, right) => time(left.timestamp) - time(right.timestamp));
  return points[0];
}

function sourceTimestamps(input, forecast, historyEnhanced, history) {
  const values = {
    activeSnapshot: input.activeSnapshot.sourceUpdatedAt,
    currentCrowd: input.currentCrowd.sourceUpdatedAt,
    officialForecast: forecast.sourceUpdatedAt,
  };
  if (historyEnhanced) values.history = history.computedAt;
  return values;
}

function hasForbiddenInput(input) {
  return input.unsupportedInput === true
    || FORBIDDEN_INPUT_KEYS.some((key) => Object.hasOwn(input, key));
}

function resultForPlace(input, mode, now, historyMaturity, basis, currentCohort, cohorts) {
  if (hasForbiddenInput(input) || !sourceIsAvailable(input.currentCrowd, now)) return null;
  if (!percentile(input.currentCrowd.percentile) || input.currentCrowd.snapshotId !== input.activeSnapshot.id) return null;
  if (!sameCohort(input.currentCrowd.cohort, currentCohort)) return null;
  if (!Array.isArray(input.officialForecasts) || input.officialForecasts.some((point) => point?.interpolated === true || point?.extrapolated === true)) return null;
  const history = input.historyDeviation;
  const historyEnhanced = historyMaturity !== 'ACCUMULATING';
  if (historyEnhanced && !historyIsAvailable(history, basis, now)) return null;
  const forecast = selectedForecast(input, mode, input.activeSnapshot.id, now, historyEnhanced, history, cohorts);
  if (forecast === null) return null;
  const score = historyEnhanced
    ? 0.5 * input.currentCrowd.percentile + 0.3 * forecast.percentile + 0.2 * history.percentile
    : mode === 'NOW'
      ? 0.6 * input.currentCrowd.percentile + 0.4 * forecast.percentile
      : 0.4 * input.currentCrowd.percentile + 0.6 * forecast.percentile;
  const reasons = [
    { kind: 'current_crowd_percentile', value: input.currentCrowd.percentile, sourceTimestamp: input.currentCrowd.sourceUpdatedAt },
    { kind: 'official_forecast_percentile', value: forecast.percentile, sourceTimestamp: forecast.sourceUpdatedAt },
  ];
  if (historyEnhanced) reasons.push({ kind: 'history_deviation_percentile', value: history.percentile, sourceTimestamp: history.computedAt });
  return {
    order: Number(score.toFixed(6)),
    result: {
      areaCode: input.areaCode,
      variant: historyEnhanced ? 'history-enhanced' : 'base',
      historyMaturity,
      selectedTimestamp: forecast.timestamp,
      sourceTimestamps: sourceTimestamps(input, forecast, historyEnhanced, history),
      reasons,
    },
  };
}

function evaluateMode(input, mode, now, basis, currentCohort, cohorts) {
  const results = input.places
    .map((place) => resultForPlace({ ...place, activeSnapshot: input.activeSnapshot }, mode, now, historyMaturity(input, place.historyDeviation), basis, currentCohort, cohorts))
    .filter((entry) => entry !== null)
    .sort((left, right) => left.order - right.order || time(left.result.selectedTimestamp) - time(right.result.selectedTimestamp) || left.result.areaCode.localeCompare(right.result.areaCode))
    .map((entry) => entry.result);
  return results.length > 0
    ? { mode, status: 'READY', results }
    : { mode, status: 'ZERO_ELIGIBLE', browseCopy: ZERO_ELIGIBLE_COPY, results: [] };
}

function currentCohort(input, now) {
  return input.places
    .filter((place) => !hasForbiddenInput(place)
      && sourceIsAvailable(place.currentCrowd, now)
      && percentile(place.currentCrowd?.percentile)
      && place.currentCrowd.snapshotId === input.activeSnapshot.id)
    .map((place) => place.areaCode)
    .sort();
}

function historyMaturity(input, history) {
  if (!Number.isSafeInteger(history?.sampleCount) || history.sampleCount < 4) return 'ACCUMULATING';
  const elapsedDays = input.historyMaturity?.elapsedDays;
  const coverage = input.historyMaturity?.coverage;
  if (Number.isFinite(elapsedDays) && percentile(coverage)) {
    if (elapsedDays >= 56 && coverage >= 0.9) return 'MATURE';
    if (elapsedDays >= 28 && coverage >= 0.8) return 'STABLE';
    if (elapsedDays >= 7 && coverage >= 0.7) return 'PROVISIONAL';
  }
  if (!percentile(history?.coverage) || !Number.isFinite(history?.elapsedDays) || history.elapsedDays < 7) return 'ACCUMULATING';
  if (history.maturity === 'MATURE' && history.coverage >= 0.9) return 'MATURE';
  if (history.maturity === 'STABLE' && history.coverage >= 0.8) return 'STABLE';
  if (history.maturity === 'PROVISIONAL' && history.coverage >= 0.7) return 'PROVISIONAL';
  return 'ACCUMULATING';
}

export function evaluateRecommendations(input) {
  const now = time(input?.now);
  if (now === null || !input?.activeSnapshot || !sourceIsAvailable({ status: 'available', sourceUpdatedAt: input.activeSnapshot.sourceUpdatedAt }, now) || !Array.isArray(input.places)) {
    return {
      now: { mode: 'NOW', status: 'ZERO_ELIGIBLE', browseCopy: ZERO_ELIGIBLE_COPY, results: [] },
      next: { mode: 'NEXT', status: 'ZERO_ELIGIBLE', browseCopy: ZERO_ELIGIBLE_COPY, results: [] },
    };
  }
  const basis = koreaTimeBasis(now);
  const current = currentCohort(input, now);
  const forecasts = forecastCohorts(input, input.activeSnapshot.id, now, current);
  return {
    now: evaluateMode(input, 'NOW', now, basis, current, forecasts),
    next: evaluateMode(input, 'NEXT', now, basis, current, forecasts),
  };
}

export function buildRecommendationSurface(viewModel, now) {
  return evaluateRecommendations(buildRecommendationInput(viewModel, now));
}
