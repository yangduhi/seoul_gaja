import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../../../app/places/[areaCode]/PlaceDetailClient.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../../../app/places/[areaCode]/page.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../../../app/places/[areaCode]/PlaceDetail.module.css", import.meta.url), "utf8");

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

test("full-screen detail is centered on desktop while in-app detail remains a drawer dialog", () => {
  assert.match(styles, /\.surface \{ display: flex; align-items: center; justify-content: center;/);
  assert.match(styles, /\.panel \{ width: min\(100%, 720px\);/);
  assert.match(styles, /\.sheet \{ width: min\(var\(--sg-desktop-detail\), 100%\); align-self: stretch; margin-left: auto;/);
  assert.match(route, /onKeyDown=\{surface === "FULL_SCREEN" \? undefined : handleDialogKeyDown\}/);
  assert.match(route, /event\.key !== "Tab"/);
});
