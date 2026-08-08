import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const cachedPlaywright = createRequire("D:\\DevWorkCache\\npm\\_npx\\a5b920f00216d246\\node_modules\\playwright\\package.json");
const { chromium } = cachedPlaywright("playwright");

const root = process.cwd();
const evidenceDir = resolve(root, ".omo/evidence/seoul-gaja-v4-plan-review/task-10-postintegration-fix-v2");
const candidate = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: root, encoding: "utf8" }).trim(),
};
const port = 53711;
const origin = `http://localhost:${port}`;
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const viewports = process.env.TASK10_DIAGNOSTIC === "1" ? [{ width: 1616, height: 923 }] : [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1616, height: 923 },
];
const serverOutput = [];
const server = spawn(process.execPath, [resolve(root, "node_modules/vinext/dist/cli.js"), "dev", "--host", "localhost", "--port", String(port)], {
  cwd: root,
  env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/task-10-postintegration-fix-v2.log" },
  windowsHide: true,
});
server.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
server.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/?visualFixture=ready-v1`);
      if (response.ok) return;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error("Vinext server did not become ready within 60 seconds.");
}

function observe(page) {
  const consoleErrors = [];
  const failedNetwork = [];
  const responses = [];
  page.on("response", (response) => {
    responses.push({ status: response.status(), resourceType: response.request().resourceType(), url: response.url() });
    if (response.status() >= 400) failedNetwork.push({ kind: "response", status: response.status(), url: response.url() });
  });
  page.on("requestfailed", (request) => failedNetwork.push({ kind: "requestfailed", failure: request.failure()?.errorText ?? null, resourceType: request.resourceType(), url: request.url() }));
  page.on("pageerror", (error) => consoleErrors.push({ kind: "pageerror", message: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push({ kind: "console", message: message.text() });
  });
  return { consoleErrors, failedNetwork, responses };
}

async function snapshot(page) {
  return page.evaluate(() => ({
    activeElement: document.activeElement instanceof HTMLElement ? document.activeElement.id || document.activeElement.getAttribute("aria-label") || document.activeElement.tagName : null,
    catalog: document.querySelector('[aria-label="서울 공식 장소 탐색"]') !== null,
    detailSurface: document.querySelector("[data-detail-surface]")?.getAttribute("data-detail-surface") ?? null,
    dialogCount: document.querySelectorAll('[role="dialog"]').length,
    historyLength: window.history.length,
    historyState: window.history.state,
    notFound: document.querySelector("[data-catalog-not-found]") !== null,
    pathname: window.location.pathname,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
    scrollY: window.scrollY,
  }));
}

async function assertCatalogReplay(page, beforeOpen, label) {
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.location.pathname === "/" && document.querySelector("[data-detail-surface]") === null);
  await page.waitForFunction(() => document.activeElement instanceof HTMLElement && document.activeElement.id === "place-alpha");
  const afterEscape = await snapshot(page);
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 10_000 });
  await page.waitForFunction(() => window.location.pathname === "/" && document.querySelector('[aria-label="서울 공식 장소 탐색"]') !== null);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => document.activeElement instanceof HTMLElement && document.activeElement.id === "place-alpha");
  const afterBack = await snapshot(page);
  if (afterEscape.activeElement !== "place-alpha" || afterBack.activeElement !== "place-alpha") throw new Error(`${label}: focus did not restore to place-alpha.`);
  if (afterEscape.scrollY !== beforeOpen.scrollY || afterBack.scrollY !== beforeOpen.scrollY) throw new Error(`${label}: scroll position changed during close/back replay.`);
  return { afterEscape, afterBack };
}

async function runReadyJourney(browser, pass, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const observed = observe(page);
  await page.goto(`${origin}/?visualFixture=ready-v1`, { waitUntil: "networkidle" });
  const beforeListOpen = await snapshot(page);
  await page.locator("#place-alpha").click();
  await page.waitForFunction(() => window.location.pathname === "/places/alpha" && window.history.state?.entry === "sheet");
  await page.waitForLoadState("networkidle");
  const listOpened = await snapshot(page);
  const expectedSurface = viewport.width < 768 ? "BOTTOM_SHEET" : "DETAIL_PANE";
  if (listOpened.detailSurface !== expectedSurface) throw new Error(`${viewport.width}x${viewport.height}: expected ${expectedSurface}, got ${listOpened.detailSurface}.`);
  if (listOpened.historyLength !== beforeListOpen.historyLength + 1) throw new Error(`${viewport.width}x${viewport.height}: list selection did not create exactly one pushState entry.`);
  await page.screenshot({ path: resolve(evidenceDir, `pass-${pass}-${viewport.width}x${viewport.height}-detail.png`), fullPage: true });
  const listReplay = await assertCatalogReplay(page, beforeListOpen, `${viewport.width}x${viewport.height} list selection`);

  const nextPanel = page.locator(".sg-recommendation").filter({ hasText: "NEXT" });
  const nextAction = nextPanel.locator("button");
  await nextAction.scrollIntoViewIfNeeded();
  const beforeNextOpen = await snapshot(page);
  const nextBox = await nextAction.boundingBox();
  if (nextBox === null || nextBox.x < 0 || nextBox.y < 0 || nextBox.x + nextBox.width > viewport.width || nextBox.y + nextBox.height > viewport.height) throw new Error(`${viewport.width}x${viewport.height}: NEXT action is clipped.`);
  await nextAction.focus();
  await nextAction.press("Enter");
  await page.waitForFunction(() => window.location.pathname === "/places/alpha" && window.history.state?.entry === "sheet");
  await page.waitForLoadState("networkidle");
  const nextOpened = await snapshot(page);
  const nextReplay = await assertCatalogReplay(page, beforeNextOpen, `${viewport.width}x${viewport.height} NEXT selection`);
  await page.screenshot({ path: resolve(evidenceDir, `pass-${pass}-${viewport.width}x${viewport.height}-catalog-restored.png`), fullPage: true });
  await page.waitForLoadState("networkidle");
  await context.close();
  return { pass, viewport, expectedSurface, beforeListOpen, listOpened, listReplay, nextActionBox: nextBox, nextOpened, nextReplay, ...observed };
}

async function runDirectAndInvalid(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const observed = observe(page);
  await page.goto(`${origin}/places/alpha?visualFixture=ready-v1`, { waitUntil: "networkidle" });
  const direct = await snapshot(page);
  await page.reload({ waitUntil: "networkidle" });
  const reload = await snapshot(page);
  await page.goto(`${origin}/places/does-not-exist`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.location.pathname === "/" && document.querySelector("[data-catalog-not-found]") !== null);
  const invalid = await snapshot(page);
  const invalidShareAbsent = await page.evaluate(() => document.querySelector('[data-area-code="does-not-exist"]') === null && !Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("가족과 공유")));
  await page.screenshot({ path: resolve(evidenceDir, `invalid-${viewport.width}x${viewport.height}.png`), fullPage: true });
  await page.waitForLoadState("networkidle");
  await context.close();
  if (direct.detailSurface !== "FULL_SCREEN" || reload.detailSurface !== "FULL_SCREEN") throw new Error(`${viewport.width}x${viewport.height}: direct/reload did not remain FULL_SCREEN.`);
  if (invalid.pathname !== "/" || !invalid.catalog || !invalid.notFound || invalid.robots?.replaceAll(" ", "") !== "noindex,nofollow" || !invalidShareAbsent) throw new Error(`${viewport.width}x${viewport.height}: invalid route fallback contract failed.`);
  return { viewport, direct, reload, invalid, invalidShareAbsent, ...observed };
}

async function runMapRetry(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const observed = observe(page);
  await page.goto(origin, { waitUntil: "networkidle" });
  const retry = page.getByRole("button", { name: "다시 시도", exact: true });
  await retry.waitFor({ state: "visible" });
  const hitTarget = await retry.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === button || (hit !== null && button.contains(hit));
  });
  await retry.click();
  const announcement = page.getByRole("status").filter({ hasText: "다시 시도했습니다." });
  await announcement.waitFor({ state: "visible" });
  await page.screenshot({ path: resolve(evidenceDir, `map-retry-${viewport.width}x${viewport.height}.png`), fullPage: true });
  await page.waitForLoadState("networkidle");
  await context.close();
  if (!hitTarget) throw new Error(`${viewport.width}x${viewport.height}: map retry does not own its center hit point.`);
  return { viewport, hitTarget, announcement: "다시 시도했습니다.", ...observed };
}

async function runHostileSearch(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const observed = observe(page);
  await page.goto(`${origin}/?visualFixture=ready-v1`, { waitUntil: "networkidle" });
  const hostile = '<img src=x onerror="window.__injected=true">';
  await page.locator("#place-search").fill(hostile);
  await page.waitForFunction((expected) => document.querySelector("#place-search")?.value === expected, hostile);
  await page.waitForFunction(() => document.querySelectorAll('#catalog-list [id^="place-"]').length === 0);
  const result = await page.evaluate(() => ({ imgCount: document.querySelectorAll("img").length, injected: Reflect.get(window, "__injected") === true, placeButtonCount: document.querySelectorAll('#catalog-list [id^="place-"]').length, query: document.querySelector("#place-search")?.value ?? null }));
  await context.close();
  if (result.imgCount !== 0 || result.injected || result.placeButtonCount !== 0 || result.query !== hostile) throw new Error("Hostile search input was not inert catalog text.");
  return { input: hostile, result, ...observed };
}

let browser;
let report;
let failure;
try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const readyJourneys = [];
  for (const pass of [1, 2]) for (const viewport of viewports) readyJourneys.push(await runReadyJourney(browser, pass, viewport));
  const directAndInvalid = [];
  const mapRetry = [];
  for (const viewport of viewports) {
    directAndInvalid.push(await runDirectAndInvalid(browser, viewport));
    mapRetry.push(await runMapRetry(browser, viewport));
  }
  const hostileSearch = await runHostileSearch(browser);
  const allScenarios = [...readyJourneys, ...directAndInvalid, ...mapRetry, hostileSearch];
  const failedNetwork = allScenarios.flatMap((scenario) => scenario.failedNetwork);
  const consoleErrors = allScenarios.flatMap((scenario) => scenario.consoleErrors);
  const rscFailures = failedNetwork.filter((event) => event.url.includes(".rsc"));
  const hardNetworkFailures = failedNetwork;
  await writeFile(resolve(evidenceDir, "browser-network-diagnostic.json"), `${JSON.stringify({ candidate, failedCount: failedNetwork.length, hardFailureCount: hardNetworkFailures.length, consoleErrorCount: consoleErrors.length, failedNetwork, consoleErrors, rscFailures }, null, 2)}\n`);
  if (failedNetwork.length > 0 || consoleErrors.length > 0) throw new Error(`Browser matrix recorded ${failedNetwork.length} failed network events and ${consoleErrors.length} console errors.`);
  report = {
    candidate,
    browser: { adapter: "cached Playwright", executable: chromePath, version: await browser.version() },
    server: { command: `${process.execPath} node_modules/vinext/dist/cli.js dev --host localhost --port ${port}`, origin },
    viewports,
    repetitions: 2,
    readyJourneys,
    directAndInvalid,
    mapRetry,
    hostileSearch,
    networkSummary: { failedCount: failedNetwork.length, hardFailureCount: hardNetworkFailures.length, rscFailureCount: rscFailures.length, consoleErrorCount: consoleErrors.length },
    verdict: "PASS",
  };
} catch (error) {
  failure = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) };
  report = { candidate, failure, verdict: "FAIL" };
  process.exitCode = 1;
} finally {
  await writeFile(resolve(evidenceDir, "browser-matrix.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser?.close();
  server.kill();
  await new Promise((resolveExit) => {
    if (server.exitCode !== null) resolveExit();
    else {
      server.once("exit", resolveExit);
      setTimeout(resolveExit, 5_000);
    }
  });
  await writeFile(resolve(evidenceDir, "browser-vinext.log"), serverOutput.join(""));
}
