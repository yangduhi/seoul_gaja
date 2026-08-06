import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureSource = await readFile(new URL("../../../app/_visual-evidence/ready-fixture.ts", import.meta.url), "utf8");
const resolverSource = await readFile(new URL("../../../app/_visual-evidence/resolve.ts", import.meta.url), "utf8");
const homeSource = await readFile(new URL("../../../app/page.tsx", import.meta.url), "utf8");
const detailSource = await readFile(new URL("../../../app/places/[areaCode]/page.tsx", import.meta.url), "utf8");

test("Given the visual evidence fixture, When source boundaries are inspected, Then it is deterministic and development-only", () => {
  assert.match(fixtureSource, /tests\/fixtures\/product\/data\/ready\.json/);
  assert.match(fixtureSource, /parseCatalog/);
  assert.match(fixtureSource, /parseForecast/);
  assert.doesNotMatch(fixtureSource, /fetch\(|env\.|process\.env/);
  assert.match(resolverSource, /process\.env\.NODE_ENV !== "development"/);
  assert.match(resolverSource, /visualFixture === "ready-v1"/);
});

test("Given home and direct-detail routes, When local evidence is requested, Then both routes use the same controlled fixture", () => {
  assert.match(homeSource, /resolveVisualEvidenceFixture/);
  assert.match(detailSource, /resolveVisualEvidenceFixture/);
  assert.match(homeSource, /visualFixture/);
  assert.match(detailSource, /visualFixture/);
});
