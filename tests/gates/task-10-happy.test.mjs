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
