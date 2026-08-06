import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildDesignTokenCss } from "../../../scripts/generate-design-token-css.mjs";

const tokensUrl = new URL("../../../design/design-tokens.json", import.meta.url);
const generatedCssUrl = new URL("../../../app/design-tokens.generated.css", import.meta.url);

test("Given the authoritative token JSON, When CSS variables are generated, Then the checked-in CSS is exact", async () => {
  const [tokenSource, generatedCss] = await Promise.all([
    readFile(tokensUrl, "utf8"),
    readFile(generatedCssUrl, "utf8"),
  ]);

  assert.equal(generatedCss, buildDesignTokenCss(JSON.parse(tokenSource)));
});

test("Given canonical spacing and radii, When the generated CSS is inspected, Then exact values are preserved", async () => {
  const generatedCss = await readFile(generatedCssUrl, "utf8");

  for (const declaration of [
    "--sg-space-xs: 8px;",
    "--sg-space-sm: 10px;",
    "--sg-space-md: 14px;",
    "--sg-space-lg: 18px;",
    "--sg-space-xl: 28px;",
    "--sg-radius-panel: 22px;",
    "--sg-radius-sheet: 28px;",
  ]) {
    assert.match(generatedCss, new RegExp(declaration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Given the Calm Glass material contract, When CSS variables are generated, Then visual recipes remain canonical", async () => {
  const generatedCss = await readFile(generatedCssUrl, "utf8");

  for (const declaration of [
    "--sg-glass-floating-saturation: 145%;",
    "--sg-typography-body-line-height: 1.5;",
    "--sg-typography-title-tracking: -.05em;",
    "--sg-gradient-map-roads:",
    "--sg-gradient-map-river:",
    "--sg-gradient-detail-warning:",
    "--sg-touch-target: 44px;",
    "--sg-control-height: 48px;",
  ]) {
    assert.match(generatedCss, new RegExp(declaration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
