import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../../../app/places/[areaCode]/PlaceDetailClient.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../../../app/places/[areaCode]/page.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../../../app/places/[areaCode]/PlaceDetail.module.css", import.meta.url), "utf8");
const catalog = await readFile(new URL("../../../app/_catalog/CatalogSurface.tsx", import.meta.url), "utf8");
const detailState = await readFile(new URL("../../../app/places/[areaCode]/PlaceDetailClient.tsx", import.meta.url), "utf8");
const detailSheet = await readFile(new URL("../../../app/_design/PlaceDetailSheet.tsx", import.meta.url), "utf8");
const home = await readFile(new URL("../../../app/page.tsx", import.meta.url), "utf8");

test("detail route is bound to the truthful D1 read model", () => {
  assert.match(page, /readProductViewModel/);
  assert.match(page, /status: \"UNAVAILABLE\"/);
  assert.match(page, /status: \"NOT_FOUND\"/);
});

test("detail surface exposes source-backed forecast, history, and recovery controls", () => {
  for (const token of ["공식 예측", "히스토리 인사이트", "가족과 공유", "최근 데이터가 만료", "결측값은 0으로 대체하지 않습니다", "Escape"]) assert.match(route, new RegExp(token));
  assert.match(route, /forecast\.length >= 6/);
  assert.match(route, /window\.history\.back/);
  assert.match(route, /seoul-gaja:detail-restored/);
});

test("invalid or removed places are excluded from indexing", () => {
  assert.match(page, /robots: \{ index: isOfficialPlace, follow: isOfficialPlace \}/);
  assert.match(page, /catalog\.some\(\(place\) => place\.areaCode === areaCode\)/);
});

test("invalid or removed places resolve to the catalog fallback surface", () => {
  assert.match(page, /path: "\/\?placeNotFound=1"/);
  assert.match(page, /redirect\(notFoundFallback\.path\)/);
  assert.match(home, /placeNotFound/);
  assert.match(home, /robots: isPlaceNotFound \? \{ index: false, follow: false \} : undefined/);
  assert.match(catalog, /data-catalog-not-found/);
});

test("full-screen detail is centered on desktop while in-app detail remains a drawer dialog", () => {
  assert.match(styles, /\.surface \{ display: flex; align-items: center; justify-content: center;/);
  assert.match(styles, /\.panel \{ width: min\(100%, 720px\);/);
  assert.match(styles, /\.sheet \{ width: min\(var\(--sg-desktop-detail\), 100%\); align-self: stretch; margin-left: auto;/);
  assert.match(route, /onKeyDown=\{surface === "FULL_SCREEN" \? undefined : handleDialogKeyDown\}/);
  assert.match(route, /event\.key !== "Tab"/);
});

test("detail material and hierarchy consume canonical design tokens", () => {
  assert.match(styles, /\.statusCard \{[^}]*background: var\(--sg-gradient-detail-warning\);/);
  assert.match(styles, /min-height: var\(--sg-touch-target\)/);
  assert.match(styles, /line-height: var\(--sg-typography-body-line-height\)/);
  assert.match(styles, /saturate\(var\(--sg-glass-(?:strong|floating)-saturation\)\)/);
  assert.doesNotMatch(styles, /blur\(26px\) saturate\(145%\)/);
});

test("catalog selection renders a real transient detail sheet and restores the prior selection", () => {
  assert.match(catalog, /PlaceDetailSheet/);
  assert.match(catalog, /const priorSelection = selectedAreaCode/);
  assert.match(catalog, /selection: priorSelection/);
  assert.match(catalog, /openInAppPlaceDetail/);
  assert.match(detailState, /history\.pushState\(\{ entry: "sheet" \}/);
  assert.doesNotMatch(catalog, /id: "saved"/);
  assert.doesNotMatch(catalog, /id: "settings"/);
  assert.doesNotMatch(route, /id: "saved"/);
  assert.doesNotMatch(route, /id: "settings"/);
});

test("transient detail sheet traps keyboard focus and makes the background inert", () => {
  assert.match(detailSheet, /event\.key === "Tab"/);
  assert.match(detailSheet, /sibling\.inert = true/);
  assert.match(detailSheet, /lastElement\.focus\(\)/);
  assert.match(detailSheet, /firstElement\.focus\(\)/);
});
