import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  createDetailNavigation,
  createStateMatrix,
  createShareRequest,
  resolveDetailEntry,
} from '../../server/detail-state.mjs';
import * as detailState from '../../server/detail-state.mjs';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'task-10', 'detail-state.json');

async function fixture() {
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}

test('Given an in-app official selection, When detail navigation begins, Then it emits the canonical sheet pushState command', async () => {
  const record = await fixture();
  const result = createDetailNavigation({
    catalog: record.catalog,
    areaCode: 'alpha',
    viewportWidth: 390,
    restore: record.restore,
  });

  assert.deepEqual(result, {
    kind: 'DETAIL',
    presentation: 'BOTTOM_SHEET',
    path: '/places/alpha',
    command: { kind: 'PUSH_STATE', state: { entry: 'sheet' }, path: '/places/alpha' },
    restore: record.restore,
  });
});

test('Given a canonical route opened directly or reloaded, When detail entry resolves, Then it uses the full-screen surface', async () => {
  const record = await fixture();

  assert.equal(resolveDetailEntry({ catalog: record.catalog, areaCode: 'alpha', navigationType: 'navigate', historyState: null, viewportWidth: 430 }).presentation, 'FULL_SCREEN');
  assert.equal(resolveDetailEntry({ catalog: record.catalog, areaCode: 'alpha', navigationType: 'reload', historyState: { entry: 'sheet' }, viewportWidth: 430 }).presentation, 'FULL_SCREEN');
  assert.equal(resolveDetailEntry({ catalog: record.catalog, areaCode: 'alpha', navigationType: 'navigate', historyState: { entry: 'sheet' }, viewportWidth: 1616 }).presentation, 'DETAIL_PANE');
});

test('Given a valid official place, When share is requested, Then the request contains only the canonical detail URL', async () => {
  const record = await fixture();
  assert.deepEqual(createShareRequest({ catalog: record.catalog, areaCode: 'alpha', origin: record.origin }), {
    kind: 'SHARE',
    url: 'https://family.example/places/alpha',
    disclosure: 'This link identifies only the official place and does not include your current location.',
  });
});

test('Given implemented state axes, When the matrix is generated, Then every combination names data, warning, disabled actions, retry, and announcement', () => {
  const matrix = createStateMatrix();
  assert.equal(matrix.length, 288);
  for (const entry of matrix) {
    assert.equal(typeof entry.visibleData, 'string');
    assert.equal(typeof entry.warningCopy, 'string');
    assert.ok(Array.isArray(entry.disabledActions));
    assert.equal(typeof entry.retryTarget, 'string');
    assert.equal(typeof entry.announcement, 'string');
  }
});

test('Given official-place search input, When it is resolved, Then results and clear affordance remain catalog-only', async () => {
  const record = await fixture();
  assert.equal(typeof detailState.resolveOfficialSearch, 'function');

  assert.deepEqual(detailState.resolveOfficialSearch(record.catalog, ' alpha '), {
    kind: 'RESULTS',
    query: 'alpha',
    places: [record.catalog[0]],
    clearAvailable: true,
    announcement: '1 official place found.',
  });
  assert.deepEqual(detailState.resolveOfficialSearch(record.catalog, ''), {
    kind: 'CATALOG',
    query: '',
    places: record.catalog,
    clearAvailable: false,
    announcement: '2 official places available.',
  });
});

test('Given detail expansion or address lookup, When the action resolves, Then no duplicate app history route is created', () => {
  assert.equal(typeof detailState.toggleDetailExpansion, 'function');
  assert.equal(typeof detailState.createAddressNavigation, 'function');
  assert.deepEqual(detailState.toggleDetailExpansion(false), { expanded: true, historyCommand: 'NONE' });
  assert.deepEqual(detailState.createAddressNavigation('Seoul Station'), {
    kind: 'EXTERNAL_NAVIGATION',
    url: 'https://map.kakao.com/?q=Seoul%20Station',
    appRoute: null,
  });
});
