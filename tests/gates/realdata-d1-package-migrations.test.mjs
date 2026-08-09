import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = resolve(import.meta.dirname, "..", "..");
const builtMigrationRoot = resolve(root, "dist", ".openai", "drizzle");
const statementBreakpoint = "--> statement-breakpoint";

function createD1PackageExecutor() {
  const sqlite = new DatabaseSync(":memory:");

  return {
    async apply(migrationRoot) {
      const journal = JSON.parse(await readFile(join(migrationRoot, "meta", "_journal.json"), "utf8"));
      for (const entry of journal.entries) {
        const migration = await readFile(join(migrationRoot, `${entry.tag}.sql`), "utf8");
        const statements = migration.includes(statementBreakpoint)
          ? migration.split(statementBreakpoint)
          : migration.split(";");
        for (const statement of statements) {
          if (statement.trim().length > 0) sqlite.exec(statement);
        }
      }
    },
    hasTable(name) {
      return sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;
    },
    hasTrigger(name) {
      return sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = ?").get(name) !== undefined;
    },
    exec(sql) {
      sqlite.exec(sql);
    },
    close() {
      sqlite.close();
    },
  };
}

test("Given the built Sites migration package, when the D1 package executor applies immutable trigger migrations, then every migration executes without incomplete input", async () => {
  // Given
  const database = createD1PackageExecutor();

  try {
    // When
    await assert.doesNotReject(database.apply(builtMigrationRoot));

    // Then
    for (const table of [
      "place_catalog",
      "snapshot_runs",
      "snapshot_revisions",
      "provenance_receipts",
      "provenance_source_bindings",
      "phase_00_capability_probe",
    ]) assert.equal(database.hasTable(table), true);
    for (const trigger of [
      "provenance_receipts_no_update",
      "provenance_receipts_no_delete",
      "provenance_source_bindings_no_update",
      "provenance_source_bindings_no_delete",
    ]) assert.equal(database.hasTrigger(trigger), true);

    database.exec(`INSERT INTO provenance_receipts (
      receipt_id, receipt_version, workflow_run_id, collector_version, parser_version, catalog_version,
      raw_response_sha256, per_place_outcome_counts, source_times, fetch_times, canonical_payload_sha256,
      accepted_at, retained_until
    ) VALUES (
      'package-test-receipt', 1, 'package-test-run', 'collector', 'parser', 'catalog',
      '${"a".repeat(64)}', '{}', '[]', '[]', '${"b".repeat(64)}',
      '2026-08-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z'
    )`);
    database.exec(`INSERT INTO provenance_source_bindings (
      derived_kind, derived_key, source_receipt_id, source_receipt_version, bound_at
    ) VALUES ('materialization', 'package-test', 'package-test-receipt', 1, '2026-08-10T00:00:00.000Z')`);
    assert.throws(
      () => database.exec("UPDATE provenance_receipts SET collector_version = 'mutated'"),
      /PROVENANCE_RECEIPT_IMMUTABLE/,
    );
    assert.throws(
      () => database.exec("UPDATE provenance_source_bindings SET bound_at = '2026-08-11T00:00:00.000Z'"),
      /PROVENANCE_SOURCE_BINDING_IMMUTABLE/,
    );
  } finally {
    database.close();
  }
});
