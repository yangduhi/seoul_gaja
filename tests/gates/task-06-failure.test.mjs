import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { validateBackfillRange } from '../../scripts/validate_backfill_inputs.mjs';

const negativeRoot = resolve(process.cwd(), 'tests/fixtures/workflow-security/negative');

for (const name of readdirSync(negativeRoot)) {
  test(`rejects ${name} without exposing a token value`, () => {
    const fixture = JSON.parse(readFileSync(resolve(negativeRoot, name), 'utf8'));
    assert.equal(fixture.secret_status, 'REDACTED');
    assert.doesNotMatch(JSON.stringify(fixture), /(?:Bearer\s+[^\s]+|SITE_INGEST_TOKEN\s*=|sk-[a-z0-9_-]{8,})/i);
    if (fixture.kind === 'invalid_date_range') {
      assert.throws(() => validateBackfillRange(fixture.start_date, fixture.end_date));
      return;
    }
    if (fixture.kind === 'injection_attempt') {
      assert.throws(() => validateBackfillRange(fixture.input, '2026-08-31'));
      return;
    }
    if (fixture.kind === 'malformed_json') {
      assert.throws(() => JSON.parse(fixture.raw_payload));
      return;
    }
    assert.equal(fixture.expected_result, 'REJECTED');
    assert.match(fixture.reason, /(?:environment|branch|token|replay|conflict|injection|dispatcher|maintainer)/i);
  });
}
