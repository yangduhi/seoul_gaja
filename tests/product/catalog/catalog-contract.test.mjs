import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootPage = await readFile(new URL("../../../app/page.tsx", import.meta.url), "utf8");
const surface = await readFile(new URL("../../../app/_catalog/CatalogSurface.tsx", import.meta.url), "utf8");

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
