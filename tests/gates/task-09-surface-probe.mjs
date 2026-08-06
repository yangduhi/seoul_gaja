import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { evaluateRecommendations } from '../../server/recommendations.mjs';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'task-09', 'positive', 'recommendations.json');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));

function clone() {
  return structuredClone(fixture);
}

function summary(record) {
  const result = evaluateRecommendations(record);
  return Object.fromEntries(['now', 'next'].map((mode) => {
    const value = result[mode];
    return [mode, {
      mode: value.mode,
      status: value.status,
      browseCopy: value.browseCopy,
      results: value.results.map((item) => ({
        areaCode: item.areaCode,
        variant: item.variant,
        historyMaturity: item.historyMaturity,
        selectedTimestamp: item.selectedTimestamp,
        sourceTimestamps: item.sourceTimestamps,
        reasons: item.reasons,
      })),
    }];
  }));
}

const accumulating = clone();
accumulating.historyMaturity = { elapsedDays: 6, coverage: 0.99 };
const partial = clone();
partial.places[1].currentCrowd.status = 'unavailable';
for (const place of [partial.places[0], partial.places[2]]) {
  place.currentCrowd.cohort = ['aardvark', 'alpha'];
  for (const point of place.officialForecasts) point.cohort = ['aardvark', 'alpha'];
}
const stable = clone();
stable.historyMaturity = { elapsedDays: 28, coverage: 0.8 };
const mature = clone();
mature.historyMaturity = { elapsedDays: 56, coverage: 0.9 };
const missing = clone();
for (const place of missing.places) place.currentCrowd.status = 'UNKNOWN';
const interpolated = clone();
for (const place of interpolated.places) place.officialForecasts[0].interpolated = true;
const unsupported = clone();
for (const place of unsupported.places) place.transportScore = 0;

process.stdout.write(`${JSON.stringify({
  happy: {
    available: summary(accumulating),
    partial: summary(partial),
    provisional: summary(clone()),
    stable: summary(stable),
    mature: summary(mature),
  },
  failure: {
    missing_or_unknown: summary(missing),
    interpolation: summary(interpolated),
    unsupported: summary(unsupported),
  },
}, null, 2)}\n`);
