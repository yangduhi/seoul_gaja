import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const sha256 = /^[a-f0-9]{64}$/;

export async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(root, relativePath), 'utf8'));
}

export function evaluateNegativeFixture(fixture) {
  if (fixture.kind === 'missing_owner_bound_quota' || fixture.kind === 'missing_live_scheduled_runs') {
    return { verdict: 'NOT_RUN_BLOCKED' };
  }
  return { verdict: 'FAIL' };
}

export function assertProvenanceCadenceContract(contract, fixture) {
  assert.deepEqual(contract.canonical_ingest, {
    method: 'POST',
    path: '/api/internal/ingest/snapshot',
    accepted_status: 'accepted',
  });
  assert.equal(contract.provenance_receipt.storage, 'D1');
  assert.equal(contract.provenance_receipt.append_only, true);
  assert.equal(contract.provenance_receipt.redacted, true);
  assert.ok(contract.provenance_receipt.retention_days >= contract.provenance_receipt.minimum_raw_data_retention_days);
  assert.deepEqual(contract.source_bindings.materialization_rows, ['source_receipt_id', 'source_receipt_version']);
  assert.deepEqual(contract.source_bindings.profile_rows, ['source_receipt_id', 'source_receipt_version']);

  const capacity = contract.capacity;
  assert.equal(capacity.catalog_place_count, 121);
  assert.equal(capacity.selected_cadence_minutes, 15);
  assert.equal(capacity.max_attempts_per_place, 2);
  assert.equal(capacity.max_concurrent_requests, 4);
  assert.deepEqual(capacity.retryable_conditions, ['network_error', 'timeout', '5xx']);
  assert.deepEqual(capacity.non_retryable_conditions, ['4xx', 'quota_exhausted']);
  assert.equal(capacity.worst_case.scheduled_runs_per_day, 24 * 60 / capacity.selected_cadence_minutes);
  assert.equal(capacity.worst_case.requests_per_run, capacity.catalog_place_count * capacity.max_attempts_per_place);
  assert.equal(capacity.worst_case.requests_per_day, capacity.worst_case.scheduled_runs_per_day * capacity.worst_case.requests_per_run);

  const receipt = fixture.provenance_receipt;
  for (const field of contract.provenance_receipt.required_fields) {
    assert.notEqual(receipt[field], undefined, `missing provenance field ${field}`);
  }
  assert.match(receipt.raw_response_sha256, sha256);
  assert.match(receipt.canonical_payload_sha256, sha256);
  assert.equal(Object.values(receipt.per_place_outcome_counts).reduce((total, count) => total + count, 0), capacity.catalog_place_count);
  assert.doesNotMatch(JSON.stringify(receipt), /(?:authorization|token|api_key|raw_response_body)/i);
  assert.deepEqual(fixture.source_bindings.materialization_row, {
    source_receipt_id: receipt.receipt_id,
    source_receipt_version: receipt.receipt_version,
  });
  assert.deepEqual(fixture.source_bindings.profile_row, {
    source_receipt_id: receipt.receipt_id,
    source_receipt_version: receipt.receipt_version,
  });

  for (const field of capacity.required_owner_quota_evidence) {
    assert.notEqual(fixture.quota_evidence[field], undefined, `missing owner quota evidence ${field}`);
  }
  assert.ok(fixture.quota_evidence.documented_limit >= capacity.worst_case.requests_per_day);
  assert.equal(fixture.cadence_runs.length, capacity.required_live_cadence_runs);
  for (const [index, run] of fixture.cadence_runs.entries()) {
    assert.equal(run.status, 'accepted');
    assert.equal(run.attempted_count, capacity.catalog_place_count);
    assert.ok(run.retry_attempts < capacity.max_attempts_per_place);
    if (index > 0) {
      const prior = fixture.cadence_runs[index - 1];
      assert.equal(Date.parse(run.scheduled_at) - Date.parse(prior.scheduled_at), capacity.selected_cadence_minutes * 60_000);
    }
  }
  for (const scenario of fixture.overlap_scenarios) {
    assert.ok(capacity.required_scenarios.includes(scenario.kind));
    assert.equal(scenario.result, 'REJECTED_OVERLAP');
  }
}
