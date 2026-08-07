import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const stylesheet = new URL("../../app/_catalog/CatalogSurface.module.css", import.meta.url);

function mobileRuleZIndex(styles, selector) {
  const mobileStyles = styles.slice(styles.indexOf("@media (max-width: 900px)"));
  const rule = mobileStyles.match(new RegExp(`\\${selector} \\{[^}]*z-index: (\\d+);`));
  assert.notEqual(rule, null, `${selector} must declare a mobile z-index`);
  return Number(rule[1]);
}

function mobileRuleTop(styles, selector) {
  const mobileStyles = styles.slice(styles.indexOf("@media (max-width: 900px)"));
  const rule = mobileStyles.match(new RegExp(`\\${selector} \\{[^}]*top: calc\\(env\\(safe-area-inset-top\\) \\+ (\\d+)px\\);`));
  assert.notEqual(rule, null, `${selector} must declare a mobile top offset`);
  return Number(rule[1]);
}

function narrowRuleTop(styles, selector) {
  const narrowStyles = styles.slice(styles.indexOf("@media (max-width: 400px)"));
  const rule = narrowStyles.match(new RegExp(`\\${selector} \\{[^}]*top: calc\\(env\\(safe-area-inset-top\\) \\+ (\\d+)px\\);`));
  assert.notEqual(rule, null, `${selector} must declare a narrow-screen top offset`);
  return Number(rule[1]);
}

test("Given the mobile unavailable-map notice, when overlapping catalog layers are rendered, then retry actions remain above non-map overlays", async () => {
  const styles = await readFile(stylesheet, "utf8");

  const mapNoticeTop = mobileRuleTop(styles, ".mapNotice");
  const narrowMapNoticeTop = narrowRuleTop(styles, ".mapNotice");
  const recommendationZIndex = mobileRuleZIndex(styles, ".recommendations");
  const statusBannerZIndex = mobileRuleZIndex(styles, ".statusBanner");
  const listHeaderZIndex = mobileRuleZIndex(styles, ".listHeader");
  const placeListZIndex = mobileRuleZIndex(styles, ".placeList");

  assert.equal(recommendationZIndex, 4);
  assert.equal(statusBannerZIndex, 4);
  assert.equal(listHeaderZIndex, 5);
  assert.equal(placeListZIndex, 5);
  assert.ok(mapNoticeTop >= 400, "map retry must begin below the status and recommendation overlays");
  assert.ok(narrowMapNoticeTop <= 380, "390px map retry must clear the catalog header with its full 44px target");
});
