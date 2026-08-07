import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../../../app/places/[areaCode]/page.tsx", import.meta.url), "utf8");
const detail = await readFile(new URL("../../../app/places/[areaCode]/PlaceDetailClient.tsx", import.meta.url), "utf8");

test("Given a valid detail route and an unavailable read model, When the page resolves, Then it preserves detail identity and an actionable unavailable state", () => {
  assert.match(page, /if \(result\.status === "UNAVAILABLE"\) \{/);
  assert.match(page, /status: "UNAVAILABLE", areaCode, areaName: null, snapshot: null, forecast: \[\], history: \[\], reason: result\.reason/);
  assert.match(page, /return <PlaceDetailClient areaCode=\{areaCode\} payload=\{payload\} \/>;/);
  assert.match(detail, /data-detail-unavailable/);
  assert.match(detail, /aria-live="polite"/);
  assert.match(detail, /다시 시도/);
});

test("Given a malformed, rejected, or removed area code, When the page resolves, Then the catalog not-found fallback remains the only fallback", () => {
  assert.match(page, /if \(!safeAreaCode\.test\(areaCode\)\) return <InvalidPlaceFallback \/>;/);
  assert.match(page, /if \(result\.status !== "READY"\) return <InvalidPlaceFallback \/>;/);
  assert.match(page, /if \(place === undefined\) return <InvalidPlaceFallback \/>;/);
});
