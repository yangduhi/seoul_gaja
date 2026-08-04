const MAX_SOURCE_AGE_MS = 180 * 60 * 1000;
const ZERO_ELIGIBLE_COPY = 'No source-backed crowd-and-time recommendations are available right now.';

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
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const value = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { weekday: value.weekday, localTimeBucket: `${value.hour}:00` };
}

function horizonBucket(timestamp) {
  return `${new Date(timestamp).toISOString().slice(0, 13)}:00:00Z`;
}

function historyIsAvailable(history, basis) {
  return history?.status === 'available'
    && percentile(history.percentile)
    && time(history.computedAt) !== null
    && history.weekday === basis.weekday
    && history.localTimeBucket === basis.localTimeBucket;
}

function forecastIsAvailable(point, snapshotId, now) {
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

function selectedForecast(place, mode, snapshotId, now, historyEnhanced, history) {
  const upperBound = now + (mode === 'NOW' ? 60 : 180) * 60 * 1000;
  const points = place.officialForecasts?.filter((point) => {
    const timestamp = time(point?.timestamp);
    return timestamp !== null && timestamp > now && timestamp <= upperBound && forecastIsAvailable(point, snapshotId, now);
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

function resultForPlace(input, mode, now, historyEnhanced, basis) {
  if (input.unsupportedInput === true || !sourceIsAvailable(input.currentCrowd, now)) return null;
  if (!percentile(input.currentCrowd.percentile) || input.currentCrowd.snapshotId !== input.activeSnapshot.id) return null;
  if (!Array.isArray(input.officialForecasts) || input.officialForecasts.some((point) => point?.interpolated === true || point?.extrapolated === true)) return null;
  const history = input.historyDeviation;
  if (historyEnhanced && !historyIsAvailable(history, basis)) return null;
  const forecast = selectedForecast(input, mode, input.activeSnapshot.id, now, historyEnhanced, history);
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
    areaCode: input.areaCode,
    score: Number(score.toFixed(6)),
    variant: historyEnhanced ? 'history-enhanced' : 'base',
    selectedTimestamp: forecast.timestamp,
    sourceTimestamps: sourceTimestamps(input, forecast, historyEnhanced, history),
    reasons,
  };
}

function evaluateMode(input, mode, now, historyEnhanced, basis) {
  const results = input.places
    .map((place) => resultForPlace({ ...place, activeSnapshot: input.activeSnapshot }, mode, now, historyEnhanced, basis))
    .filter((result) => result !== null)
    .sort((left, right) => left.score - right.score || time(left.selectedTimestamp) - time(right.selectedTimestamp) || left.areaCode.localeCompare(right.areaCode));
  return results.length > 0
    ? { mode, status: 'READY', results }
    : { mode, status: 'ZERO_ELIGIBLE', browseCopy: ZERO_ELIGIBLE_COPY, results: [] };
}

export function evaluateRecommendations(input) {
  const now = time(input?.now);
  if (now === null || !input?.activeSnapshot || !sourceIsAvailable({ status: 'available', sourceUpdatedAt: input.activeSnapshot.sourceUpdatedAt }, now) || !Array.isArray(input.places)) {
    return {
      now: { mode: 'NOW', status: 'ZERO_ELIGIBLE', browseCopy: ZERO_ELIGIBLE_COPY, results: [] },
      next: { mode: 'NEXT', status: 'ZERO_ELIGIBLE', browseCopy: ZERO_ELIGIBLE_COPY, results: [] },
    };
  }
  const historyEnhanced = input.historyMaturity?.elapsedDays >= 7 && input.historyMaturity?.coverage >= 0.7;
  const basis = koreaTimeBasis(now);
  return {
    now: evaluateMode(input, 'NOW', now, historyEnhanced, basis),
    next: evaluateMode(input, 'NEXT', now, historyEnhanced, basis),
  };
}
