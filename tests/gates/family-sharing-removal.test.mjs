import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as detailState from "../../server/detail-state.mjs";

const detailSource = await readFile(new URL("../../app/places/[areaCode]/PlaceDetailClient.tsx", import.meta.url), "utf8");
const detailStyles = await readFile(new URL("../../app/places/[areaCode]/PlaceDetail.module.css", import.meta.url), "utf8");
const catalogSource = await readFile(new URL("../../app/_catalog/CatalogSurface.tsx", import.meta.url), "utf8");

test("Given the detail surface, When family sharing is removed, Then no share action or browser share helper remains", () => {
  assert.doesNotMatch(detailSource, /가족과 공유|navigator\.share|navigator\.clipboard|copyCanonicalUrl|function share\(/);
  assert.doesNotMatch(detailStyles, /\.share\b/);
  assert.equal("createShareRequest" in detailState, false);
  assert.equal("resolveShareOutcome" in detailState, false);
});

test("Given the catalog detail sheet, When family sharing is removed, Then the share-only full-screen copy is absent", () => {
  assert.doesNotMatch(catalogSource, /공유 가능한 전체 화면 링크|공식 장소 링크에는 현재 위치가 포함되지 않습니다/);
});

test("Given the sharing removal, When preserved planning and recovery seams are inspected, Then family guidance and non-sharing actions remain", () => {
  assert.match(catalogSource, /mode: "NOW" \| "NEXT"/);
  assert.match(catalogSource, /가족의 다음 시간을 천천히 고르세요/);
  assert.match(catalogSource, /다시 시도/);
  assert.match(detailSource, /카카오맵/);
  assert.match(detailSource, /네이버지도/);
  assert.match(detailSource, /목록으로 돌아가기/);
  assert.match(detailSource, /다시 시도/);
  assert.match(detailSource, /window\.history\.back/);
  assert.match(detailSource, /seoul-gaja:detail-restored/);
});
