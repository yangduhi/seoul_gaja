import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

export async function createLocalD1CapabilityDatabase() {
  const database = new DatabaseSync(":memory:");
  const migration = await readFile(new URL("../../../migrations/0004_phase_00_capability_probe.sql", import.meta.url), "utf8");
  database.exec(migration);

  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      let parameters = [];
      return {
        bind(...values) {
          parameters = values;
          return this;
        },
        run() {
          return statement.run(...parameters);
        },
        first() {
          return statement.get(...parameters) ?? null;
        },
      };
    },
    batch(statements) {
      database.exec("BEGIN");
      try {
        for (const statement of statements) statement.run();
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    close() {
      database.close();
    },
  };
}
