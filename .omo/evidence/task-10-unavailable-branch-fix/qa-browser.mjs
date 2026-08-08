import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const evidenceDir = new URL("./browser/", import.meta.url);
const cachedPlaywright = createRequire("D:\\DevWorkCache\\npm\\_npx\\a5b920f00216d246\\node_modules\\playwright\\package.json");
const { chromium } = cachedPlaywright("playwright");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 51100 + (process.pid % 700);
const root = process.cwd();
const viewports = [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1616, height: 923 }];
const failures = [];
const consoleErrors = [];
const pageErrors = [];
const serverOutput = [];
const captures = [];

function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`http://localhost:${port}/places/alpha`)).status === 200) return; } catch { /* compilation is in progress */ }
    await wait(250);
  }
  throw new Error(`server startup timed out: ${serverOutput.join("")}`);
}
async function main() {
  await mkdir(evidenceDir, { recursive: true });
  const server = spawn("npm.cmd", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], { cwd: root, env: { ...process.env, NODE_ENV: "development" }, stdio: ["ignore", "pipe", "pipe"], shell: true, windowsHide: true });
  server.stdout.setEncoding("utf8"); server.stderr.setEncoding("utf8");
  server.stdout.on("data", (chunk) => serverOutput.push(chunk)); server.stderr.on("data", (chunk) => serverOutput.push(chunk));
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ executablePath: chromePath, headless: true });
    for (let pass = 1; pass <= 2; pass += 1) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport });
        page.on("requestfailed", (request) => failures.push({ pass, viewport, url: request.url(), failure: request.failure()?.errorText ?? "unknown" }));
        page.on("console", (message) => { if (message.type() === "error") consoleErrors.push({ pass, viewport, text: message.text() }); });
        page.on("pageerror", (error) => pageErrors.push({ pass, viewport, message: error.message }));
        await page.goto(`http://localhost:${port}/places/alpha`, { waitUntil: "networkidle" });
        const unavailable = page.locator("[data-detail-unavailable]");
        const retry = unavailable.getByRole("button");
        const unavailableState = {
          areaCode: await page.locator("main[data-area-code]").getAttribute("data-area-code"),
          detailVisible: await unavailable.isVisible(),
          live: await unavailable.getAttribute("aria-live"),
          retryVisible: await retry.isVisible(),
          retryBox: await retry.boundingBox(),
          rscRequests: await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name).filter((url) => url.includes("_rsc"))),
        };
        if (unavailableState.areaCode !== "alpha" || !unavailableState.detailVisible || unavailableState.live !== "polite" || !unavailableState.retryVisible) throw new Error(`unavailable contract failed at ${viewport.width}x${viewport.height}`);
        const retryNavigation = page.waitForNavigation({ waitUntil: "networkidle" });
        await retry.click();
        await retryNavigation;
        const unavailableScreenshot = new URL(`unavailable-pass${pass}-${viewport.width}x${viewport.height}.png`, evidenceDir);
        await page.screenshot({ path: fileURLToPath(unavailableScreenshot), fullPage: true });
        captures.push({ pass, viewport: `${viewport.width}x${viewport.height}`, unavailable: unavailableState, unavailableScreenshot: unavailableScreenshot.pathname });
        await page.close();
      }
    }
    await writeFile(new URL("browser-observations.json", evidenceDir), JSON.stringify({ verdict: "PASS_UNAVAILABLE_ONLY", port, captures, failures, consoleErrors, pageErrors, blocked: "READY catalog fixture is not exposed by this dev route; invalid/history journey cannot be observed without a real READY read model." }, null, 2));
  } finally {
    await browser?.close();
    if (server.exitCode === null) server.kill();
    await writeFile(new URL("cleanup.json", evidenceDir), JSON.stringify({ serverPid: server.pid, serverExitCode: server.exitCode, browserClosed: true, port }, null, 2));
  }
}
await main();
