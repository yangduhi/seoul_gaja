import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

function declaration(name, value) {
  const cssName = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return `  --sg-${cssName}: ${value};`;
}

export function buildDesignTokenCss(tokens) {
  const lines = [
    "/* Generated from design/design-tokens.json. Do not edit directly. */",
    ":root {",
    declaration("surface", tokens.color.surface.base),
    declaration("surface-elevated", tokens.color.surface.elevated),
    declaration("surface-secondary", tokens.color.surface.secondary),
    declaration("surface-mint", tokens.color.surface.mint),
    declaration("surface-map", tokens.color.surface.map),
    declaration("surface-dark", tokens.color.surface.dark),
    declaration("text-primary", tokens.color.text.primary),
    declaration("text-secondary", tokens.color.text.secondary),
    declaration("text-strong", tokens.color.text.strong),
    declaration("text-inverse", tokens.color.text.inverse),
    declaration("brand-blue", tokens.color.brand.blue),
    declaration("brand-indigo", tokens.color.brand.indigo),
    declaration("brand-purple", tokens.color.brand.purple),
    declaration("crowd-relaxed", tokens.color.status.relaxed),
    declaration("crowd-normal", tokens.color.status.normal),
    declaration("crowd-busy", tokens.color.status.busy),
    declaration("crowd-crowded", tokens.color.status.crowded),
    declaration("crowd-unknown", tokens.color.status.unknown),
    ...Object.entries(tokens.color.semantic).map(([name, value]) => declaration(`semantic-${name}`, value)),
    ...Object.entries(tokens.space).map(([name, value]) => declaration(`space-${name}`, value)),
    declaration("radius-panel", tokens.radius.panel),
    declaration("radius-card", tokens.radius.panel),
    declaration("radius-sheet", tokens.radius.sheet),
    declaration("radius-pill", tokens.radius.pill),
    declaration("radius-small", tokens.radius.small),
    declaration("radius-sm", tokens.radius.small),
    declaration("radius-control", tokens.radius.control),
    declaration("radius-hero", tokens.radius.hero),
    declaration("glass-content", tokens.glass.content.background),
    declaration("glass-floating", tokens.glass.floating.background),
    declaration("glass-strong", tokens.glass.strong.background),
    declaration("glass-border-content", tokens.glass.content.border),
    declaration("glass-border-floating", tokens.glass.floating.border),
    declaration("glass-border-strong", tokens.glass.strong.border),
    declaration("glass-content-blur", tokens.glass.content.blur),
    declaration("glass-floating-blur", tokens.glass.floating.blur),
    declaration("glass-strong-blur", tokens.glass.strong.blur),
    declaration("glass-content-saturation", tokens.glass.content.saturation),
    declaration("glass-floating-saturation", tokens.glass.floating.saturation),
    declaration("glass-strong-saturation", tokens.glass.strong.saturation),
    ...Object.entries(tokens.border).map(([name, value]) => declaration(`border-${name}`, value)),
    ...Object.entries(tokens.shadow).map(([name, value]) => declaration(`shadow-${name}`, value)),
    ...Object.entries(tokens.type).map(([name, value]) => declaration(`type-${name}`, value)),
    ...Object.entries(tokens.typography).map(([name, value]) => declaration(`typography-${name}`, value)),
    ...Object.entries(tokens.gradient).map(([name, value]) => declaration(`gradient-${name}`, value)),
    declaration("layout-padding", tokens.layout.padding),
    declaration("layout-gap", tokens.layout.gap),
    declaration("nav-height", tokens.layout.navigationHeight),
    declaration("touch-target", tokens.layout.touchTarget),
    declaration("control-height", tokens.layout.controlHeight),
    declaration("desktop-explorer", tokens.layout.desktopExplorer),
    declaration("desktop-detail", tokens.layout.desktopDetail),
    declaration("desktop-map-min", tokens.layout.desktopMapMinimum),
    declaration("motion-fast", tokens.motion.fast),
    declaration("motion-standard", tokens.motion.standard),
    declaration("motion-slow", tokens.motion.slow),
    declaration("motion-easing", tokens.motion.easing),
    declaration("focus-ring", `${tokens.accessibility.focus_ring.split(" ")[0]} solid ${tokens.accessibility.focus_ring.split(" ")[1]}`),
    "}",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const root = resolve(import.meta.dirname, "..");
  const tokenPath = resolve(root, "design", "design-tokens.json");
  const outputPath = resolve(root, "app", "design-tokens.generated.css");
  const expected = buildDesignTokenCss(JSON.parse(await readFile(tokenPath, "utf8")));
  if (process.argv.includes("--check")) {
    const actual = await readFile(outputPath, "utf8");
    if (actual !== expected) throw new Error("app/design-tokens.generated.css is stale; run npm run tokens:generate");
    return;
  }
  await writeFile(outputPath, expected, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
