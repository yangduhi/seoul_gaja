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
