import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";

const cachedPlaywright = createRequire("D:\\DevWorkCache\\npm\\_npx\\a5b920f00216d246\\node_modules\\playwright\\package.json");
const { chromium } = cachedPlaywright("playwright");

const baseURL = "http://localhost:55238";
const evidenceUrl = new URL("./", import.meta.url);
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1616, height: 923 },
];

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const browserVersion = await browser.version();
const observations = [];
const consoleErrors = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ baseURL, viewport });
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(`${viewport.width}x${viewport.height}: ${message.text()}`);
    });
    await page.goto("/places/alpha?visualFixture=ready-v1", { waitUntil: "networkidle" });
    assert.equal(await page.getByRole("button", { name: "가족과 공유" }).count(), 0);
    assert.equal(await page.getByRole("link", { name: "카카오맵" }).count(), 1);
    assert.equal(await page.getByRole("link", { name: "네이버지도" }).count(), 1);
    assert.equal(await page.getByRole("link", { name: "목록으로 돌아가기" }).count(), 1);
    assert.equal(await page.locator("[data-detail-surface]").getAttribute("data-detail-surface"), "FULL_SCREEN");
    const geometry = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      minTarget: Math.min(...[...document.querySelectorAll("button, a")].filter((element) => element.getClientRects().length > 0).map((element) => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height))),
      familyGuidance: document.body.textContent?.includes("가면 좋은 시간") === true,
    }));
    assert.equal(geometry.horizontalOverflow, false);
    assert.ok(geometry.minTarget >= 44);
    assert.equal(geometry.familyGuidance, true);
    const screenshot = `${viewport.width}x${viewport.height}-detail.png`;
    await page.screenshot({ path: new URL(screenshot, evidenceUrl).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)), fullPage: true });
    observations.push({ viewport: `${viewport.width}x${viewport.height}`, route: "/places/alpha?visualFixture=ready-v1", shareButtonCount: 0, mapLinks: 2, backLink: true, surface: "FULL_SCREEN", ...geometry, screenshot });
    await page.close();
  }

  const unavailable = await browser.newPage({ baseURL, viewport: viewports[0] });
  await unavailable.goto("/places/alpha", { waitUntil: "networkidle" });
  assert.equal(await unavailable.getByRole("button", { name: "가족과 공유" }).count(), 0);
  assert.equal(await unavailable.getByRole("link", { name: "카카오맵" }).count(), 1);
  assert.equal(await unavailable.getByRole("link", { name: "네이버지도" }).count(), 1);
  assert.equal(await unavailable.getByRole("link", { name: "목록으로 돌아가기" }).count(), 1);
  const retry = unavailable.getByRole("button", { name: /다시 시도/ });
  await Promise.all([unavailable.waitForNavigation({ waitUntil: "networkidle" }), retry.click()]);
  const live = unavailable.locator("[data-detail-unavailable]");
  assert.equal(await live.getAttribute("aria-live"), "polite");
  assert.match(await live.textContent(), /현재 데이터 연결 대기/);
  await unavailable.screenshot({ path: new URL("unavailable-retry.png", evidenceUrl).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)), fullPage: true });
  observations.push({ viewport: "390x844", route: "/places/alpha", unavailableRetry: "clicked and reloaded", ariaLive: "polite", acknowledgement: "현재 데이터 연결 대기" });
  await unavailable.close();

  const journey = await browser.newPage({ baseURL, viewport: viewports[1] });
  await journey.goto("/?visualFixture=ready-v1", { waitUntil: "networkidle" });
  assert.equal(await journey.locator(".sg-recommendation", { hasText: "NOW" }).count(), 1);
  assert.equal(await journey.locator(".sg-recommendation", { hasText: "NEXT" }).count(), 1);
  assert.match(await journey.locator("body").textContent(), /가족의 다음 시간을 천천히 고르세요/);
  await journey.getByRole("button", { name: "Alpha Place 상세 보기" }).focus();
  await journey.keyboard.press("Enter");
  await journey.waitForFunction(() => location.pathname === "/places/alpha");
  assert.deepEqual(await journey.evaluate(() => history.state), { entry: "sheet" });
  await journey.keyboard.press("Escape");
  await journey.waitForFunction(() => location.pathname === "/");
  await journey.waitForFunction(() => document.activeElement?.id === "place-alpha");
  assert.equal(await journey.evaluate(() => document.activeElement?.id), "place-alpha");
  observations.push({ viewport: "430x932", route: "/?visualFixture=ready-v1", now: true, next: true, familyPlanningCopy: true, historyState: { entry: "sheet" }, escapeRestoredPath: "/", focusRestored: "place-alpha" });

  const search = journey.locator("#place-search");
  await search.fill("<img src=x onerror=alert(1)>");
  assert.equal(await journey.locator("script[src='x']").count(), 0);
  assert.match(await journey.locator("body").textContent(), /공식 장소 검색 결과가 없습니다/);
  observations.push({ ultraqa: "prompt-injection-like search", input: "redacted hostile markup fixture", result: "inert no-results state" });
  await journey.close();

  const stale = await browser.newPage({ baseURL, viewport: viewports[0] });
  await stale.goto("/places/alpha?visualFixture=ready-v1", { waitUntil: "networkidle" });
  await stale.evaluate(() => history.replaceState({ entry: "sheet" }, "", location.href));
  await stale.reload({ waitUntil: "networkidle" });
  assert.equal(await stale.locator("[data-detail-surface]").getAttribute("data-detail-surface"), "FULL_SCREEN");
  observations.push({ ultraqa: "stale transient history state", result: "reload remained FULL_SCREEN" });
  await stale.close();

  const mapUnavailable = await browser.newPage({ baseURL, viewport: viewports[0] });
  await mapUnavailable.goto("/", { waitUntil: "networkidle" });
  const mapRetry = mapUnavailable.getByRole("button", { name: "다시 시도", exact: true });
  await mapRetry.click();
  const mapStatus = mapUnavailable.getByRole("status");
  await assert.doesNotReject(mapStatus.getByText(/다시 시도했습니다/).waitFor());
  observations.push({ route: "/", mapUnavailableRetry: "clicked", acknowledgement: "다시 시도했습니다", role: "status" });
  await mapUnavailable.close();
} finally {
  await browser.close();
}

await writeFile(new URL("manual-qa-result.json", evidenceUrl), `${JSON.stringify({ verdict: "PASS", browserVersion, observations, consoleErrors }, null, 2)}\n`, "utf8");
assert.deepEqual(consoleErrors, []);
