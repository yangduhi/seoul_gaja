import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function fixture(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

async function isPresent(path) {
  try {
    await access(new URL(path, root));
    return true;
  } catch {
    return false;
  }
}

test("negative design fixtures require the contracted fallback and reject unauthorized navigation", async () => {
  const [negative, contract, css, navigation, chart, showcase, page] = await Promise.all([
    fixture("tests/fixtures/task-11/negative.json"),
    fixture("docs/execution/contracts/design-system-contract.json"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/_design/Navigation.tsx", root), "utf8"),
    readFile(new URL("app/_design/ChartAlternatives.tsx", root), "utf8"),
    readFile(new URL("app/_design/PrimitiveShowcase.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);
  const expectations = new Map(negative.fixtures.map((item) => [item.id, item.expect]));

  assert.equal(expectations.get("forced-reduced-motion"), "motion-suppressed");
  assert.equal(expectations.get("keyboard-only"), "focus-visible-and-escape-close");
  assert.equal(expectations.get("narrow-390"), "primary-action-visible");
  assert.equal(expectations.get("map-chart-failure"), "text-table-alternative");
  assert.equal(expectations.get("overflow"), "no-clipped-primary-action");
  assert.equal(expectations.get("unauthorized-navigation"), "rejected");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.sg-current-decision-cta/);
  assert.match(chart, /data table/);
  assert.doesNotMatch(navigation, /href=|window\.location|router\.|pushState/i);
  assert.doesNotMatch(showcase, /href=|window\.location|router\.|pushState/i);
  assert.doesNotMatch(page, /PrimitiveShowcase/);
  assert.equal(await isPresent("app/__design/page.tsx"), false);
  assert.equal(await isPresent("app/settings/page.tsx"), false);
  assert.equal(await isPresent("app/help/page.tsx"), false);
  assert.deepEqual(contract.visual_receipt_policy.forbidden, ["unauthorized-navigation", "concept-board-pixel-authority", "gradient-on-every-card"]);
});
