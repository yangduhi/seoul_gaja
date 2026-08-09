import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { handleIngestSnapshot } from '../../server/ingest-snapshot-request.mjs';
import { createD1Mock } from './task-08-d1-mock.mjs';

const directory = await mkdtemp(join(tmpdir(), 'seoul-gaja-manual-'));
try {
  const snapshotPath = join(directory, 'snapshot.json');
  const receiptPath = join(directory, 'receipt.json');
  const collector = spawnSync('python', ['-m', 'collector.tests.fixture_snapshot', snapshotPath, receiptPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (collector.status !== 0) throw new Error(collector.stderr);
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  const database = createD1Mock();
  const request = new Request('http://localhost/api/internal/ingest/snapshot', {
    method: 'POST',
    headers: { authorization: 'Bearer local-token', 'content-type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  const response = await handleIngestSnapshot(request, 'local-token', database);
  const body = await response.json();
  const provenance = snapshot.provenanceReceipt;
  const serialized = JSON.stringify({ snapshot, receipt });
  const result = {
    collector_exit: collector.status,
    ingest_status: response.status,
    ingest_result: body.status,
    row_count: snapshot.rows.length,
    identity_count: new Set(snapshot.rows.map((row) => row.areaCode)).size,
    attempted: snapshot.meta.attempted,
    refreshed: snapshot.meta.refreshed,
    receipt_id: provenance.receipt_id,
    receipt_version: provenance.receipt_version,
    workflow_run_id: provenance.workflow_run_id,
    collector_version: provenance.collector_version,
    parser_version: provenance.parser_version,
    catalog_version: provenance.catalog_version,
    raw_response_sha256: provenance.raw_response_sha256,
    source_time_count: provenance.source_times.length,
    fetch_time_count: provenance.fetch_times.length,
    payload_sha256: snapshot.payloadSha256,
    audit_payload_hash_matches: receipt.payloadSha256 === snapshot.payloadSha256,
    canonical_payload_sha256: body.canonicalPayloadSha256,
    persisted_receipt_count: database.receipts.size,
    source_binding_count: database.bindings.size,
    forbidden_key_count: (serialized.match(/"(?:authorization|token|api_key|raw_response_body)"\s*:/gi) ?? []).length,
  };
  console.log(JSON.stringify(result));
  if (response.status !== 202 || result.row_count !== 121 || result.identity_count !== 121 || result.forbidden_key_count !== 0) process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
