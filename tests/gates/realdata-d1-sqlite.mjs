import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function createSqliteD1({ failAtWrite = null, failTriggerBootstrap = false } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  let writeCount = 0;

  function statement(sql, values = []) {
    const prepared = sqlite.prepare(sql);
    return {
      bind(...boundValues) {
        return statement(sql, boundValues);
      },
      async run() {
        if (failTriggerBootstrap && /^\s*CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+provenance_/i.test(sql)) {
          throw new Error("TASK_FORCED_TRIGGER_BOOTSTRAP_FAILURE");
        }
        if (failAtWrite !== null && writeCount === failAtWrite) {
          throw new Error("TASK_FORCED_WRITE_FAILURE");
        }
        writeCount += 1;
        return prepared.run(...values);
      },
      async first() {
        return prepared.get(...values) ?? null;
      },
      async all() {
        return { results: prepared.all(...values) };
      },
    };
  }

  return {
    exec(sql) {
      sqlite.exec(sql);
    },
    prepare(sql) {
      return statement(sql);
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const item of statements) results.push(await item.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    async count(table) {
      return Number(sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
    },
    async countTriggers() {
      return Number(sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger'").get().count);
    },
    async triggerNames() {
      return sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all().map(({ name }) => name);
    },
    close() {
      sqlite.close();
    },
  };
}

export async function applyDrizzleMigrations(database, migrationRoot) {
  const journalPath = join(migrationRoot, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
    throw new Error("EXECUTABLE_DRIZZLE_MIGRATIONS_REQUIRED");
  }
  for (const entry of journal.entries) {
    if (typeof entry.tag !== "string" || entry.tag.length === 0) {
      throw new Error("MALFORMED_DRIZZLE_MIGRATION_JOURNAL");
    }
    const migration = await readFile(join(migrationRoot, `${entry.tag}.sql`), "utf8");
    for (const statement of migration.split(";")) {
      if (statement.trim().length > 0) database.exec(statement);
    }
  }
}
