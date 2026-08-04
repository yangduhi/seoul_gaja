import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { evaluateRecommendations } from '../../server/recommendations.mjs';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'task-09', 'positive', 'recommendations.json');

async function invalidRecord(update) {
  const record = JSON.parse(await readFile(fixturePath, 'utf8'));
  update(record);
  return record;
}

function assertZeroEligible(result) {
  for (const mode of [result.now, result.next]) {
    assert.equal(mode.status, 'ZERO_ELIGIBLE');
    assert.deepEqual(mode.results, []);
    assert.equal(mode.browseCopy, 'No source-backed crowd-and-time recommendations are available right now.');
  }
}

test('Given a missing or UNKNOWN current input, When a recommendation is evaluated, Then no score is fabricated', async () => {
  const missing = await invalidRecord((record) => {
    for (const place of record.places) place.currentCrowd.status = 'UNKNOWN';
  });

  assertZeroEligible(evaluateRecommendations(missing));
});

test('Given expired official inputs or no official horizon, When a recommendation is evaluated, Then results are suppressed', async () => {
  const expired = await invalidRecord((record) => {
    for (const place of record.places) {
      for (const point of place.officialForecasts) point.sourceUpdatedAt = '2026-08-04T05:00:00Z';
    }
  });
  const empty = await invalidRecord((record) => {
    for (const place of record.places) place.officialForecasts = [];
  });

  assertZeroEligible(evaluateRecommendations(expired));
  assertZeroEligible(evaluateRecommendations(empty));
});

test('Given provisional maturity with an invalid history input, When recommendations are evaluated, Then base weights are not renormalized', async () => {
  const record = await invalidRecord((value) => {
    for (const place of value.places) place.historyDeviation.status = 'expired';
  });

  assertZeroEligible(evaluateRecommendations(record));
});

test('Given an interpolated, extrapolated, unsupported, or mismatched-cohort input, When recommendations are evaluated, Then the inputs are rejected', async () => {
  const interpolated = await invalidRecord((record) => {
    for (const place of record.places) place.officialForecasts[0].interpolated = true;
  });
  const extrapolated = await invalidRecord((record) => {
    for (const place of record.places) place.officialForecasts[0].extrapolated = true;
  });
  const unsupported = await invalidRecord((record) => {
    for (const place of record.places) place.unsupportedInput = true;
  });
  const mismatched = await invalidRecord((record) => {
    for (const place of record.places) place.currentCrowd.snapshotId = 'other-snapshot';
  });

  assertZeroEligible(evaluateRecommendations(interpolated));
  assertZeroEligible(evaluateRecommendations(extrapolated));
  assertZeroEligible(evaluateRecommendations(unsupported));
  assertZeroEligible(evaluateRecommendations(mismatched));
});
