import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const cachedPlaywright = createRequire("D:\\DevWorkCache\\npm\\_npx\\a5b920f00216d246\\node_modules\\playwright\\package.json");
const { chromium } = cachedPlaywright("playwright");

const root = process.cwd();
const phase = process.env.TASK10_PHASE ?? "green";
const evidenceDir = resolve(root, `.omo/evidence/task-10-unavailable-branch-fix/browser/matrix-ready-invalid/${phase}`);
const candidate = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: root, encoding: "utf8" }).trim(),
};
const port = Number(process.env.TASK10_PORT ?? "53920");
const origin = `http://localhost:${port}`;
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1616, height: 923 },
];
const serverOutput = [];

await mkdir(evidenceDir, { recursive: true });

const server = spawn(process.execPath, [resolve(root, "node_modules/vinext/dist/cli.js"), "dev", "--host", "localhost", "--port", String(port)], {
  cwd: root,
  env: { ...process.env, WRANGLER_LOG_PATH: `.wrangler/task-10-combined-full-${phase}.log` },
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
  const requestfailed = [];
  const responseErrors = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on("requestfailed", (request) => requestfailed.push({
    errorText: request.failure()?.errorText ?? null,
    method: request.method(),
    resourceType: request.resourceType(),
    url: request.url(),
  }));
  page.on("response", (response) => {
    if (response.status() >= 400) responseErrors.push({ status: response.status(), url: response.url() });
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push({ text: message.text() });
  });
  page.on("pageerror", (error) => pageErrors.push({ message: error.message, name: error.name }));
  return { requestfailed, responseErrors, consoleErrors, pageErrors };
}

async function catalogState(page) {
  return page.evaluate(() => ({
    activeElement: document.activeElement instanceof HTMLElement
      ? document.activeElement.id || document.activeElement.getAttribute("aria-label") || document.activeElement.tagName
      : null,
    pathname: window.location.pathname,
    search: window.location.search,
    historyState: window.history.state,
    detailSurface: document.querySelector("[data-detail-surface]")?.getAttribute("data-detail-surface") ?? null,
    scrollY: window.scrollY,
  }));
}

async function waitForCatalogRestore(page) {
  await page.waitForFunction(() => window.location.pathname === "/" && document.querySelector("[data-detail-surface]") === null);
  await page.waitForFunction(() => document.activeElement instanceof HTMLElement && document.activeElement.id === "place-alpha");
}

async function runHistoryJourney(browser, pass, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const observed = observe(page);
  await page.goto(`${origin}/?visualFixture=ready-v1`, { waitUntil: "networkidle" });
  const before = await catalogState(page);

  await page.locator("#place-alpha").click();
  await page.waitForFunction(() => window.location.pathname === "/places/alpha" && window.history.state?.entry === "sheet");
  const openedByClick = await catalogState(page);
  const expectedSurface = viewport.width < 768 ? "BOTTOM_SHEET" : "DETAIL_PANE";
  if (openedByClick.detailSurface !== expectedSurface) throw new Error(`${viewport.width}x${viewport.height}: click opened ${openedByClick.detailSurface}, expected ${expectedSurface}.`);
  await page.screenshot({ path: resolve(evidenceDir, `pass-${pass}-${viewport.width}x${viewport.height}-detail.png`), fullPage: true });

  await page.keyboard.press("Escape");
  await waitForCatalogRestore(page);
  const afterEscape = await catalogState(page);

  await page.goBack({ waitUntil: "domcontentloaded", timeout: 15_000 });
  await waitForCatalogRestore(page);
  const afterReplayBack = await catalogState(page);

  const nextAction = page.locator(".sg-recommendation").filter({ hasText: "NEXT" }).locator("button");
  await nextAction.scrollIntoViewIfNeeded();
  const nextBox = await nextAction.boundingBox();
  if (nextBox === null || nextBox.x < 0 || nextBox.y < 0 || nextBox.x + nextBox.width > viewport.width || nextBox.y + nextBox.height > viewport.height) {
    throw new Error(`${viewport.width}x${viewport.height}: NEXT action is clipped.`);
  }
  await nextAction.focus();
  await nextAction.press("Enter");
  await page.waitForFunction(() => window.location.pathname === "/places/alpha" && window.history.state?.entry === "sheet");
  const openedByEnter = await catalogState(page);
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 15_000 });
  await waitForCatalogRestore(page);
  const afterDirectBack = await catalogState(page);
  await page.screenshot({ path: resolve(evidenceDir, `pass-${pass}-${viewport.width}x${viewport.height}-catalog-restored.png`), fullPage: true });

  if ([afterEscape, afterReplayBack, afterDirectBack].some((state) => state.activeElement !== "place-alpha" || state.scrollY !== before.scrollY)) {
    throw new Error(`${viewport.width}x${viewport.height}: Back replay did not restore focus and scroll.`);
  }
  await context.close();
  return { pass, viewport, expectedSurface, before, openedByClick, afterEscape, afterReplayBack, nextBox, openedByEnter, afterDirectBack, ...observed };
}

async function runDirectInvalidAndShare(browser, pass, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => { throw new DOMException("cancelled", "AbortError"); },
    });
  });
  const page = await context.newPage();
  const observed = observe(page);
  await page.goto(`${origin}/places/alpha?visualFixture=ready-v1`, { waitUntil: "networkidle" });
  const direct = await catalogState(page);
  await page.getByRole("button", { name: "가족과 공유", exact: true }).click();
  await page.getByText("공유를 취소했습니다.", { exact: true }).waitFor({ state: "visible" });
  const shareCancellation = true;
  await page.reload({ waitUntil: "networkidle" });
  const reload = await catalogState(page);
  let goto = { status: null, error: null };
  try {
    const response = await page.goto(`${origin}/places/does-not-exist?visualFixture=ready-v1`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    goto = { status: response?.status() ?? null, error: null };
  } catch (error) {
    goto = { status: null, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
  await page.waitForFunction(
    () => window.location.pathname === "/"
      && window.location.search === ""
      && document.querySelector("[data-catalog-not-found]") !== null,
    undefined,
    { timeout: 15_000 },
  );
  const invalid = await page.evaluate(() => ({
    url: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
    notFoundCount: document.querySelectorAll("[data-catalog-not-found]").length,
    detailCount: document.querySelectorAll("[data-detail-surface], [data-area-code]").length,
    shareCount: Array.from(document.querySelectorAll("button")).filter((button) => button.textContent?.includes("가족과 공유")).length,
    copyPresent: document.body.innerText.includes("선택한 공식 장소를 더 이상 찾을 수 없습니다."),
  }));
  await page.goto(`${origin}/places/%3Cscript%3E?visualFixture=unknown&placeNotFound=%3Cimg%3E`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForFunction(
    () => window.location.pathname === "/"
      && window.location.search === ""
      && document.querySelector("[data-catalog-not-found]") !== null,
    undefined,
    { timeout: 15_000 },
  );
  const malformed = await page.evaluate(() => ({
    url: window.location.href,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
    notFoundCount: document.querySelectorAll("[data-catalog-not-found]").length,
    detailCount: document.querySelectorAll("[data-detail-surface], [data-area-code]").length,
    shareCount: Array.from(document.querySelectorAll("button")).filter((button) => button.textContent?.includes("가족과 공유")).length,
  }));
  await page.screenshot({ path: resolve(evidenceDir, `pass-${pass}-${viewport.width}x${viewport.height}-invalid.png`), fullPage: true });
  await context.close();
  if (direct.detailSurface !== "FULL_SCREEN" || reload.detailSurface !== "FULL_SCREEN") throw new Error(`${viewport.width}x${viewport.height}: direct/reload was not FULL_SCREEN.`);
  if (goto.status === null || goto.status < 200 || goto.status >= 400 || invalid.pathname !== "/" || invalid.search !== "" || invalid.robots?.replaceAll(" ", "") !== "noindex,nofollow" || invalid.notFoundCount !== 1 || invalid.detailCount !== 0 || invalid.shareCount !== 0 || !invalid.copyPresent) {
    throw new Error(`${viewport.width}x${viewport.height}: invalid direct fallback contract failed.`);
  }
  if (malformed.url !== `${origin}/` || malformed.robots?.replaceAll(" ", "") !== "noindex,nofollow" || malformed.notFoundCount !== 1 || malformed.detailCount !== 0 || malformed.shareCount !== 0) {
    throw new Error(`${viewport.width}x${viewport.height}: malformed route/query fallback contract failed.`);
  }
  return { pass, viewport, direct, reload, shareCancellation, goto, invalid, malformed, ...observed };
}

async function runFailureAndHostile(browser, pass, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const observed = observe(page);
  await page.goto(origin, { waitUntil: "networkidle" });
  const retry = page.getByRole("button", { name: "다시 시도", exact: true });
  const retryBox = await retry.boundingBox();
  if (retryBox === null || retryBox.width < 44 || retryBox.height < 44) throw new Error(`${viewport.width}x${viewport.height}: retry target is below 44px.`);
  await retry.click();
  await page.getByRole("status").filter({ hasText: "다시 시도했습니다." }).waitFor({ state: "visible" });
  const hostile = '<img src=x onerror="window.__injected=true">';
  await page.locator("#place-search").fill(hostile);
  await page.waitForFunction((expected) => document.querySelector("#place-search")?.value === expected, hostile);
  await page.waitForFunction(() => document.querySelectorAll('#catalog-list [id^="place-"]').length === 0);
  const hostileResult = await page.evaluate(() => ({
    imgCount: document.querySelectorAll("img").length,
    injected: Reflect.get(window, "__injected") === true,
    placeButtonCount: document.querySelectorAll('#catalog-list [id^="place-"]').length,
  }));
  await context.close();
  if (hostileResult.imgCount !== 0 || hostileResult.injected || hostileResult.placeButtonCount !== 0) throw new Error(`${viewport.width}x${viewport.height}: hostile search input was not inert.`);
  return { pass, viewport, retryBox, hostile, hostileResult, ...observed };
}

let browser;
let report;
try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const historyJourneys = [];
  const directInvalidAndShare = [];
  const failureAndHostile = [];
  for (const pass of [1, 2]) {
    for (const viewport of viewports) {
      historyJourneys.push(await runHistoryJourney(browser, pass, viewport));
      directInvalidAndShare.push(await runDirectInvalidAndShare(browser, pass, viewport));
      failureAndHostile.push(await runFailureAndHostile(browser, pass, viewport));
    }
  }
  const scenarios = [...historyJourneys, ...directInvalidAndShare, ...failureAndHostile];
  const requestfailed = scenarios.flatMap((scenario) => scenario.requestfailed);
  const responseErrors = scenarios.flatMap((scenario) => scenario.responseErrors);
  const consoleErrors = scenarios.flatMap((scenario) => scenario.consoleErrors);
  const pageErrors = scenarios.flatMap((scenario) => scenario.pageErrors);
  const rscFailures = requestfailed.filter((event) => event.url.includes(".rsc"));
  const hardFailures = [...requestfailed, ...responseErrors];
  const summary = {
    failedCount: requestfailed.length,
    hardFailureCount: hardFailures.length,
    rscFailureCount: rscFailures.length,
    consoleErrorCount: consoleErrors.length,
    pageErrorCount: pageErrors.length,
    unexpectedRequestErrors: hardFailures.length,
  };
  report = {
    candidate,
    browser: { adapter: "cached Playwright", executable: chromePath, version: await browser.version() },
    server: { origin, command: `${process.execPath} node_modules/vinext/dist/cli.js dev --host localhost --port ${port}` },
    viewports,
    repetitions: 2,
    actions: ["page.click", "Enter", "Escape", "Back", "direct", "reload", "invalid goto", "malformed route/query", "retry", "share cancel", "hostile input"],
    historyJourneys,
    directInvalidAndShare,
    failureAndHostile,
    diagnostics: { requestfailed, responseErrors, consoleErrors, pageErrors, rscFailures },
    summary,
    verdict: Object.values(summary).every((count) => count === 0) ? "PASS" : "FAIL",
  };
  if (report.verdict !== "PASS") process.exitCode = 1;
} catch (error) {
  report = {
    candidate,
    failure: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    verdict: "FAIL",
  };
  process.exitCode = 1;
} finally {
  await writeFile(resolve(evidenceDir, "browser-full-matrix.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser?.close();
  server.kill();
  await new Promise((resolveExit) => {
    if (server.exitCode !== null) resolveExit();
    else {
      server.once("exit", resolveExit);
      setTimeout(resolveExit, 5_000);
    }
  });
  await writeFile(resolve(evidenceDir, "vinext-full.log"), serverOutput.join(""));
}
