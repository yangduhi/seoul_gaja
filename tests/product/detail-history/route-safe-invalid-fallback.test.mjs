import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../../../app/places/[areaCode]/page.tsx", import.meta.url), "utf8");

test("Given an unverified or removed deep link, When Vinext renders the route, Then a route-local fallback owns canonical catalog recovery without a server redirect", () => {
  assert.doesNotMatch(page, /from "next\/navigation"/);
  assert.doesNotMatch(page, /redirect\(/);
  assert.match(page, /InvalidPlaceFallback/);
  assert.match(page, /if \(result\.status !== "READY"\) return <InvalidPlaceFallback \/>/);
  assert.match(page, /if \(place === undefined\) return <InvalidPlaceFallback \/>/);
});
