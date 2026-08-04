import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { evaluateRecommendations } from '../../server/recommendations.mjs';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'task-09', 'positive', 'recommendations.json');

async function fixture() {
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}

test('Given source-backed percentile inputs, When NOW is evaluated, Then it uses the first official point in the 60-minute horizon', async () => {
  const result = evaluateRecommendations(await fixture());

  assert.equal(result.now.status, 'READY');
  assert.equal(result.now.results[0].areaCode, 'aardvark');
  assert.equal(result.now.results[0].selectedTimestamp, '2026-08-04T09:20:00Z');
  assert.equal(result.now.results[0].score, 0.37);
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
  assert.equal(result.next.results[0].score, 0.25);
});

test('Given history below PROVISIONAL maturity, When recommendations are evaluated, Then base formulas remain unrenormalized', async () => {
  const record = await fixture();
  record.historyMaturity = { elapsedDays: 6, coverage: 0.99 };

  const result = evaluateRecommendations(record);

  assert.equal(result.now.results[0].variant, 'base');
  assert.equal(result.now.results[0].score, 0.32);
  assert.equal(result.next.results[0].variant, 'base');
  assert.equal(result.next.results[0].score, 0.14);
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
