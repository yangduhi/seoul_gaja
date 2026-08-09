import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { canonicalPayloadSha256 } from '../../server/provenance-cadence.mjs';
import { handleIngestSnapshot } from '../../server/ingest-snapshot-request.mjs';
import { createD1Mock } from './task-08-d1-mock.mjs';

async function collectorSnapshot() {
  const directory = await mkdtemp(join(tmpdir(), 'seoul-gaja-provenance-'));
  const snapshotPath = join(directory, 'snapshot.json');
  const receiptPath = join(directory, 'receipt.json');
  try {
    const result = spawnSync('python', ['-m', 'collector.tests.fixture_snapshot', snapshotPath, receiptPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 0, result.stderr);
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    return { snapshot, receipt };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function ingestRequest(snapshot) {
  return new Request('http://localhost/api/internal/ingest/snapshot', {
    method: 'POST',
    headers: { authorization: 'Bearer local-token', 'content-type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
}

test('Given a deterministic official collector run, When canonical ingest evaluates it, Then the emitted provenance receipt is accepted', async () => {
  // Given
  const { snapshot } = await collectorSnapshot();
  const database = createD1Mock();

  // When
  const response = await handleIngestSnapshot(ingestRequest(snapshot), 'local-token', database);

  // Then
  assert.equal(response.status, 202);
  const body = await response.json();
  const { provenanceReceipt, ...canonicalPayload } = snapshot;
  assert.equal(body.canonicalPayloadSha256, canonicalPayloadSha256(canonicalPayload));
  assert.equal(database.receipts.size, 1);
  assert.equal(provenanceReceipt.per_place_outcome_counts.refreshed, 121);
});

test('Given the collector receipt, When its data relations are inspected, Then identity, counts, hashes, timestamps, and redaction are source-backed', async () => {
  // Given
  const { snapshot, receipt } = await collectorSnapshot();
  const sourceRegistry = JSON.parse(await readFile('data/source-registry.json', 'utf8'));

  // When
  const provenance = snapshot.provenanceReceipt;
  const serialized = JSON.stringify({ snapshot, receipt });

  // Then
  assert.equal(snapshot.rows.length, 121);
  assert.equal(new Set(snapshot.rows.map(({ areaCode }) => areaCode)).size, 121);
  assert.equal(provenance.catalog_version, snapshot.catalogVersion);
  assert.equal(provenance.parser_version, sourceRegistry.citydata_ppltn.parserVersion);
  assert.equal(Object.values(provenance.per_place_outcome_counts).reduce((sum, count) => sum + count, 0), 121);
  assert.deepEqual(provenance.source_times, snapshot.rows.map(({ sourceUpdatedAt }) => sourceUpdatedAt));
  assert.deepEqual(provenance.fetch_times, snapshot.rows.map(({ fetchedAt }) => fetchedAt));
  assert.equal(provenance.accepted_at, provenance.fetch_times.at(-1));
  assert.equal(provenance.raw_response_sha256, canonicalPayloadSha256(receipt.rawResponseSha256));
  assert.equal(receipt.payloadSha256, snapshot.payloadSha256);
  assert.equal(receipt.catalogVersion, snapshot.catalogVersion);
  assert.match(receipt.catalogSourceRawSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(serialized, /"(?:authorization|token|api_key|raw_response_body)"\s*:/i);
});

test('Given missing or stale provenance fields, When canonical ingest evaluates them, Then strict policy fails closed', async () => {
  // Given
  const { snapshot } = await collectorSnapshot();
  const missing = { ...snapshot };
  delete missing.provenanceReceipt;
  const stale = {
    ...snapshot,
    provenanceReceipt: { ...snapshot.provenanceReceipt, fetch_times: ['not-a-timestamp'] },
  };

  // When
  const [missingResponse, staleResponse] = await Promise.all([
    handleIngestSnapshot(ingestRequest(missing), 'local-token', createD1Mock()),
    handleIngestSnapshot(ingestRequest(stale), 'local-token', createD1Mock()),
  ]);

  // Then
  assert.equal(missingResponse.status, 422);
  assert.deepEqual(await missingResponse.json(), { error: 'invalid_provenance' });
  assert.equal(staleResponse.status, 422);
  assert.deepEqual(await staleResponse.json(), { error: 'invalid_provenance' });
});

test('Given a misleading caller-supplied canonical hash, When ingest accepts the payload, Then policy recomputes the hash from canonical content', async () => {
  // Given
  const { snapshot } = await collectorSnapshot();
  const misleadingHash = '0'.repeat(64);
  snapshot.provenanceReceipt = { ...snapshot.provenanceReceipt, canonical_payload_sha256: misleadingHash };
  const { provenanceReceipt: _provenanceReceipt, ...canonicalPayload } = snapshot;

  // When
  const response = await handleIngestSnapshot(ingestRequest(snapshot), 'local-token', createD1Mock());

  // Then
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.canonicalPayloadSha256, canonicalPayloadSha256(canonicalPayload));
  assert.notEqual(body.canonicalPayloadSha256, misleadingHash);
});

test('Given malformed collector provenance, When canonical ingest evaluates it, Then strict policy rejects it', async () => {
  // Given
  const { snapshot } = await collectorSnapshot();
  snapshot.provenanceReceipt = { ...snapshot.provenanceReceipt, raw_response_sha256: 'invalid' };

  // When
  const response = await handleIngestSnapshot(ingestRequest(snapshot), 'local-token', createD1Mock());

  // Then
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: 'invalid_provenance' });
});
