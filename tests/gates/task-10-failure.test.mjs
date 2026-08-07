import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  closeSheet,
  createDetailNavigation,
  createShareRequest,
  resolveDetailEntry,
} from '../../server/detail-state.mjs';
import * as detailState from '../../server/detail-state.mjs';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'task-10', 'detail-state.json');

async function fixture() {
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}

test('Given an invalid or removed area code, When detail navigation resolves, Then it falls back to noindex catalog browse', async () => {
  const record = await fixture();
  const result = resolveDetailEntry({ catalog: record.catalog, areaCode: 'removed', navigationType: 'navigate', historyState: null, viewportWidth: 390 });

  assert.deepEqual(result, {
    kind: 'CATALOG_FALLBACK',
    path: '/',
    robots: 'noindex,nofollow',
    message: 'This official place is no longer available. Browse the current catalog.',
    announcement: 'Place not found. The current official catalog is available.',
  });
  assert.equal(createShareRequest({ catalog: record.catalog, areaCode: 'removed', origin: record.origin }), null);
});

test('Given an open sheet, When it closes, Then it goes back once and restores selection, scroll, and focus without a new history entry', async () => {
  const record = await fixture();
  assert.deepEqual(closeSheet(record.restore), {
    kind: 'HISTORY_BACK',
    restore: record.restore,
  });
});

test('Given unavailable or expired snapshots, When detail navigation is created, Then it preserves identity but disables unsupported detail actions', async () => {
  const record = await fixture();
  const unavailable = createDetailNavigation({ catalog: record.catalog, areaCode: 'alpha', viewportWidth: 390, restore: record.restore, snapshot: 'unavailable' });
  const expired = createDetailNavigation({ catalog: record.catalog, areaCode: 'alpha', viewportWidth: 390, restore: record.restore, snapshot: 'expired' });

  assert.deepEqual(unavailable.detail, {
    visibleData: 'place identity only',
    warningCopy: 'Current crowd data is unavailable.',
    disabledActions: ['forecast', 'better-time'],
  });
  assert.deepEqual(expired.detail, {
    visibleData: 'place identity and last normal time',
    warningCopy: 'Recent data cannot be confirmed.',
    disabledActions: ['forecast', 'better-time'],
  });
});

test('Given simultaneous failures, When state precedence resolves, Then invalid selection and source availability win retry and announcement', () => {
  assert.equal(typeof detailState.resolveUiState, 'function');
  const invalid = detailState.resolveUiState({ snapshot: 'unavailable', map: 'unavailable', history: 'ACCUMULATING', geolocation: 'timeout', selection: 'invalid' });
  assert.equal(invalid.retryTarget, 'catalog');
  assert.equal(invalid.announcement, 'Place not found. The current official catalog is available.');

  const unavailable = detailState.resolveUiState({ snapshot: 'unavailable', map: 'unavailable', history: 'MATURE', geolocation: 'timeout', selection: 'valid' });
  assert.equal(unavailable.retryTarget, 'snapshot');
});

test('Given no official-place results and hostile text, When search resolves, Then it returns inert data with a clear action', async () => {
  const record = await fixture();
  assert.equal(typeof detailState.resolveOfficialSearch, 'function');
  assert.deepEqual(detailState.resolveOfficialSearch(record.catalog, '<img src=x onerror=alert(1)>'), {
    kind: 'NO_RESULTS',
    query: '<img src=x onerror=alert(1)>',
    places: [],
    clearAvailable: true,
    announcement: 'No official places found. Clear search to browse the catalog.',
  });
});

test('Given every share outcome, When it resolves, Then success, cancellation, clipboard fallback, and retry are explicit', () => {
  assert.equal(typeof detailState.resolveShareOutcome, 'function');
  assert.deepEqual(detailState.resolveShareOutcome('shared'), { status: 'SUCCESS', announcement: 'Canonical place link shared.', retryTarget: 'none' });
  assert.deepEqual(detailState.resolveShareOutcome('cancelled'), { status: 'CANCELLED', announcement: 'Sharing cancelled.', retryTarget: 'share' });
  assert.deepEqual(detailState.resolveShareOutcome('clipboard'), { status: 'SUCCESS', announcement: 'Canonical place link copied.', retryTarget: 'none' });
  assert.deepEqual(detailState.resolveShareOutcome('failed'), { status: 'FAILED', announcement: 'Sharing failed. Copy the canonical URL from the address bar.', retryTarget: 'share' });
});
