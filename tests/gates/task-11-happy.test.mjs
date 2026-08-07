import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

function fromRoot(path) {
  return new URL(path, root);
}

async function text(path) {
  return readFile(fromRoot(path), "utf8");
}

async function exists(path) {
  try {
    await access(fromRoot(path));
    return true;
  } catch {
    return false;
  }
}

test("Calm Glass tokens and primitives precede screen parity checks", async () => {
  assert.ok(await exists("DESIGN.md"), "Root DESIGN.md must bind the design authority before primitives.");
  assert.ok(await exists("app/_design/Presentation.ts"), "A shared readonly presentation model is required.");
  assert.ok(await exists("app/_design/PrimitiveShowcase.tsx"), "A route-less primitive showcase is required.");

  const [design, tokensText, contractText, css, panel, navigation, sheet, chart, phase03, presentation, showcase, catalogSurface, fixtureText] = await Promise.all([
    text("DESIGN.md"),
    text("design/design-tokens.json"),
    text("docs/execution/contracts/design-system-contract.json"),
    text("app/globals.css"),
    text("app/_design/GlassPanel.tsx"),
    text("app/_design/Navigation.tsx"),
    text("app/_design/PlaceDetailSheet.tsx"),
    text("app/_design/ChartAlternatives.tsx"),
    text("app/_design/Phase03CatalogSurface.tsx"),
    text("app/_design/Presentation.ts"),
    text("app/_design/PrimitiveShowcase.tsx"),
    text("app/_catalog/CatalogSurface.tsx"),
    text("tests/fixtures/task-11/screens.json"),
  ]);
  const tokens = JSON.parse(tokensText);
  const contract = JSON.parse(contractText);
  const fixture = JSON.parse(fixtureText);

  assert.equal(tokens.name, "Calm Glass");
  assert.deepEqual(tokens.recommendation, { modes: ["NOW", "NEXT"], missing_input: "suppress-no-renormalization" });
  assert.equal(tokens.authority.design_document, "docs/codex-pack-v4/design/design.md");
  assert.deepEqual(tokens.references.mockups, [
    "01-home-map-light.png",
    "02-place-detail-light.png",
    "03-family-recommendations-light.png",
    "04-history-insights-dark.png",
    "05-desktop-dashboard.png",
  ]);
  assert.equal(tokens.emphasis.gradient, "current-decision-cta-only");
  assert.equal(tokens.emphasis.maximum_glass_depths, 3);
  assert.equal(tokens.typography.fontFamily, '"Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif');
  assert.equal(contract.authoritative_token_file, "design/design-tokens.json");
  assert.equal(contract.first_phase03_consumer, "app/_catalog/CatalogSurface.tsx");
  assert.deepEqual(contract.chart_alternative, {
    row_sources: ["recommendation.reason.kind", "recommendation.reason.sourceTimestamp"],
    empty_behavior: "explanation-without-table",
    forbidden_values: ["raw-score", "fabricated-value"],
  });
  assert.deepEqual(contract.typography, {
    font_family: "Pretendard",
    font_family_token: "--sg-typography-font-family",
    fallbacks: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Noto Sans KR", "sans-serif"],
  });
  assert.deepEqual(contract.authority_order, [
    "docs/codex-pack-v4/design/design.md",
    "design/design-tokens.json",
    "docs/codex-pack-v4/design/component-contracts.md",
    "docs/codex-pack-v4/design/screen-specs.md",
    "docs/codex-pack-v4/design/mockups/*.png",
  ]);
  assert.equal(contract.screens.length, 5);
  assert.deepEqual(fixture.viewports.map(({ width }) => width), [390, 430, 768, 1616]);
  assert.match(panel, /glassDepths = \["content", "floating", "strong"\]/);
  assert.match(panel, /emphasis === "current-decision"/);
  assert.match(navigation, /<nav aria-label=\{label\}/);
  assert.match(navigation, /aria-current=/);
  assert.match(navigation, /type="button"/);
  assert.match(navigation, /ArrowRight/);
  assert.match(navigation, /ArrowLeft/);
  assert.match(navigation, /\.focus\(\)/);
  assert.doesNotMatch(navigation, /href=|next\/link|router\./i);
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /event\.key === "Escape"/);
  assert.match(sheet, /sheetRef\.current\?\.focus\(\)/);
  assert.match(sheet, /const previouslyFocusedElement =\s*document\.activeElement instanceof HTMLElement/);
  assert.match(sheet, /previouslyFocusedElement\?\.isConnected/);
  assert.match(sheet, /previouslyFocusedElement\.focus\(\)/);
  assert.match(chart, /<table(?:\s|>)/);
  assert.match(chart, /<caption>/);
  assert.match(chart, /rows\.length === 0/);
  assert.match(chart, /data-source-backed="true"/);
  assert.match(catalogSurface, /import \{ ChartAlternatives \}/);
  assert.match(catalogSurface, /<ChartAlternatives/);
  assert.match(catalogSurface, /reason\.sourceTimestamp/);
  assert.match(catalogSurface, /data-current-decision=\{item\.mode === "NOW" \? "true" : undefined\}/);
  assert.match(phase03, /aria-live="polite"/);
  assert.match(phase03, /<GlassPanel/);
  assert.match(presentation, /readonly mode: "sheet" \| "drawer" \| "full-screen"/);
  assert.match(showcase, /GlassPanel/);
  assert.match(showcase, /Navigation/);
  assert.match(showcase, /PlaceDetailSheet/);
  assert.match(showcase, /ChartAlternatives/);
  assert.match(showcase, /Phase03CatalogSurface/);
  assert.match(showcase, /presentationModes/);
  const designAuthorityPaths = [
    "docs/codex-pack-v4/design/design.md",
    "design/design-tokens.json",
    "docs/codex-pack-v4/design/component-contracts.md",
    "docs/codex-pack-v4/design/screen-specs.md",
    "docs/codex-pack-v4/design/mockups/*.png",
  ];
  const designAuthorityIndexes = designAuthorityPaths.map((path) => design.indexOf(path));
  assert.ok(designAuthorityIndexes.every((index) => index >= 0));
  assert.deepEqual([...designAuthorityIndexes].sort((left, right) => left - right), designAuthorityIndexes);
  assert.match(css, /\.sg-glass-panel--decision, \.sg-current-decision-cta \{ background: linear-gradient/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /outline-offset: 2px/);
  assert.match(css, /\*,\s*\*::before,\s*\*::after\s*\{\s*box-sizing:\s*border-box/);
  assert.match(css, /--font-sans: var\(--sg-typography-font-family\);/);
  assert.match(css, /font-family: var\(--sg-typography-font-family\);/);
});
