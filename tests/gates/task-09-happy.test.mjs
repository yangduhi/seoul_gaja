import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { evaluateRecommendations } from '../../server/recommendations.mjs';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'task-09', 'positive', 'recommendations.json');

async function fixture() {
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}

function hasOwnScore(value) {
  if (Array.isArray(value)) return value.some(hasOwnScore);
  if (value !== null && typeof value === 'object') return Object.hasOwn(value, 'score') || Object.values(value).some(hasOwnScore);
  return false;
}

test('Given source-backed percentile inputs, When NOW is evaluated, Then it uses the first official point in the 60-minute horizon', async () => {
  const result = evaluateRecommendations(await fixture());

  assert.equal(result.now.status, 'READY');
  assert.equal(result.now.results[0].areaCode, 'aardvark');
  assert.equal(result.now.results[0].selectedTimestamp, '2026-08-04T09:20:00Z');
  assert.equal(hasOwnScore(result), false);
  assert.equal(result.now.results[0].variant, 'history-enhanced');
  assert.deepEqual(result.now.results[0].reasons.map((reason) => reason.kind), [
    'current_crowd_percentile',
    'official_forecast_percentile',
    'history_deviation_percentile',
  ]);
  assert.equal(result.now.results[0].reasons.length, 3);
  assert.deepEqual(result.now.results[0].sourceTimestamps, {
    activeSnapshot: '2026-08-04T08:55:00Z',
    currentCrowd: '2026-08-04T08:55:00Z',
    officialForecast: '2026-08-04T08:55:00Z',
    history: '2026-08-04T08:55:00Z',
  });
});

test('Given equal NEXT scores, When the best official points are selected, Then timestamp and areaCode break the tie in that order', async () => {
  const result = evaluateRecommendations(await fixture());

  assert.equal(result.next.status, 'READY');
  assert.equal(result.next.results[0].areaCode, 'aardvark');
  assert.equal(result.next.results[0].selectedTimestamp, '2026-08-04T10:00:00Z');
  assert.equal(hasOwnScore(result), false);
});

test('Given history below PROVISIONAL maturity, When recommendations are evaluated, Then base formulas remain unrenormalized', async () => {
  const record = await fixture();
  record.historyMaturity = { elapsedDays: 6, coverage: 0.99 };

  const result = evaluateRecommendations(record);

  assert.equal(result.now.results[0].variant, 'base');
  assert.equal(hasOwnScore(result), false);
  assert.equal(result.next.results[0].variant, 'base');
  assert.equal(hasOwnScore(result), false);
});

test('Given a point exactly at the current time, When NOW is evaluated, Then it is ignored instead of interpolating', async () => {
  const record = await fixture();
  record.places[0].officialForecasts.unshift({
    ...record.places[0].officialForecasts[0],
    timestamp: record.now,
  });

  const result = evaluateRecommendations(record);
  const alpha = result.now.results.find((item) => item.areaCode === 'alpha');

  assert.equal(alpha.selectedTimestamp, '2026-08-04T09:20:00Z');
});

test('Given a recommendation in the second half of a Seoul hour, When history is evaluated, Then the valid 30-minute local bucket is used', async () => {
  const record = await fixture();
  record.now = '2026-08-04T09:45:00Z';
  record.activeSnapshot.sourceUpdatedAt = '2026-08-04T09:40:00Z';
  for (const place of record.places) {
    place.currentCrowd.sourceUpdatedAt = '2026-08-04T09:40:00Z';
    place.historyDeviation.localTimeBucket = '18:30';
    place.historyDeviation.computedAt = '2026-08-04T09:40:00Z';
    place.officialForecasts[0].timestamp = '2026-08-04T10:00:00Z';
    place.officialForecasts[0].horizonBucket = '2026-08-04T10:00:00Z';
    place.officialForecasts[1].timestamp = '2026-08-04T11:00:00Z';
    place.officialForecasts[1].horizonBucket = '2026-08-04T11:00:00Z';
    for (const point of place.officialForecasts) point.sourceUpdatedAt = '2026-08-04T09:40:00Z';
  }

  const result = evaluateRecommendations(record);

  assert.equal(result.now.status, 'READY');
  assert.equal(result.now.results[0].variant, 'history-enhanced');
});

test('Given partial current availability, When cohorts are formed, Then unavailable places are excluded while ordinary browse candidates remain recommendable', async () => {
  const record = await fixture();
  record.places[1].currentCrowd.status = 'unavailable';
  for (const place of [record.places[0], record.places[2]]) {
    place.currentCrowd.cohort = ['aardvark', 'alpha'];
    for (const point of place.officialForecasts) point.cohort = ['aardvark', 'alpha'];
  }

  const result = evaluateRecommendations(record);

  assert.equal(result.now.status, 'READY');
  assert.deepEqual(result.now.results.map((item) => item.areaCode).sort(), ['aardvark', 'alpha']);
});

test('Given stable or mature elapsed-day coverage, When history is eligible, Then the result exposes the truthful maturity without changing fixed weights', async () => {
  for (const [historyMaturity, expected] of [
    [{ elapsedDays: 28, coverage: 0.8 }, 'STABLE'],
    [{ elapsedDays: 56, coverage: 0.9 }, 'MATURE'],
  ]) {
    const record = await fixture();
    record.historyMaturity = historyMaturity;

    const result = evaluateRecommendations(record);

    assert.equal(result.now.results[0].historyMaturity, expected);
    assert.equal(hasOwnScore(result), false);
  }
});
