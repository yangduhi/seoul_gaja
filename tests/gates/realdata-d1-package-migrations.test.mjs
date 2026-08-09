import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = resolve(import.meta.dirname, "..", "..");
const builtMigrationRoot = resolve(root, "dist", ".openai", "drizzle");

function createD1PackageExecutor() {
  const sqlite = new DatabaseSync(":memory:");

  return {
    async apply(migrationRoot) {
      const journal = JSON.parse(await readFile(join(migrationRoot, "meta", "_journal.json"), "utf8"));
      for (const entry of journal.entries) {
        const migration = await readFile(join(migrationRoot, `${entry.tag}.sql`), "utf8");
        for (const statement of migration.split(";")) {
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

test("Given the built Sites migration package, when a semicolon-only executor applies it, then migrations contain no trigger bodies and execute without incomplete input", async () => {
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
    const immutableTriggerNames = [
      "provenance_receipts_no_update",
      "provenance_receipts_no_delete",
      "provenance_source_bindings_no_update",
      "provenance_source_bindings_no_delete",
    ];
    for (const trigger of immutableTriggerNames) assert.equal(database.hasTrigger(trigger), false);
    const provenanceMigration = await readFile(join(builtMigrationRoot, "0003_snapshot_revision_and_provenance.sql"), "utf8");
    assert.doesNotMatch(provenanceMigration, /\bCREATE\s+TRIGGER\b/i);
  } finally {
    database.close();
  }
});
