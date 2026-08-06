import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootPage = await readFile(new URL("../../../app/page.tsx", import.meta.url), "utf8");
const surface = await readFile(new URL("../../../app/_catalog/CatalogSurface.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../../../app/_catalog/CatalogSurface.module.css", import.meta.url), "utf8");

test("catalog route renders the product surface and never falls back to the starter preview", () => {
  assert.match(rootPage, /CatalogSurface/);
  assert.doesNotMatch(rootPage, /SkeletonPreview/);
  assert.match(rootPage, /readProductViewModel/);
});

test("catalog surface exposes the family planning failure-safe interactions", () => {
  for (const label of ["공식 장소 검색", "다시 시도", "내 주변", "지도를 불러오지 못했습니다", "최근 데이터 확인 불가"]) {
    assert.match(surface, new RegExp(label));
  }
  assert.match(surface, /event\.key === \"Escape\"/);
  assert.match(surface, /openInAppPlaceDetail/);
  assert.match(surface, /seoul-gaja:detail-restored/);
  assert.match(surface, /selectedAreaCode/);
});

test("map legend stays bottom-centered and mobile chips retain the touch target", () => {
  assert.match(styles, /\.mapLegend \{ z-index: 4; bottom: calc\(var\(--sg-nav-height\) \+ 272px\); \}/);
  assert.match(styles, /\.mapLegend \{ position: absolute; bottom: var\(--sg-space-xl\); left: 50%;/);
  assert.doesNotMatch(styles, /\.chip \{ min-height: 38px; \}/);
});

test("map texture is live CSS and shared material values come from canonical tokens", () => {
  assert.match(styles, /\.mapGrid \{[^}]*background-image: var\(--sg-gradient-map-roads\);/);
  assert.match(styles, /\.mapGrid::before \{[^}]*background: var\(--sg-gradient-map-river\);/);
  assert.match(styles, /\.mapGrid::after \{[^}]*border: 2px solid var\(--sg-semantic-map-road\);/);
  assert.match(styles, /saturate\(var\(--sg-glass-floating-saturation\)\)/);
  assert.doesNotMatch(styles, /background(?:-image)?:\s*url\(/);
  assert.doesNotMatch(styles, /linear-gradient\(135deg,\s*var\(--sg-brand-blue\),\s*var\(--sg-brand-indigo\)\)/);
});
