import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

const cachedPlaywright = createRequire("D:\\DevWorkCache\\npm\\_npx\\a5b920f00216d246\\node_modules\\playwright\\package.json");
const { chromium } = cachedPlaywright("playwright");

const root = new URL("../../", import.meta.url);
const rootPath = decodeURIComponent(root.pathname).replace(/^\/(?:[A-Za-z]:)/, (match) => match.slice(1));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1616, height: 923 },
];

let server;
let serverPort;
let browser;
let serverOutput = "";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function choosePort() {
  return 49152 + ((process.pid * 17 + Date.now()) % 10000);
}

async function waitForServer(port) {
  const deadline = Date.now() + 45_000;
  const url = `http://localhost:${port}/?visualFixture=unavailable-v1`;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // Vinext is compiling the local fixture.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}. Output:\n${serverOutput}`);
}

async function startServer() {
  serverPort = choosePort();
  server = spawn(npmCommand, ["run", "dev", "--", "--host", "localhost", "--port", String(serverPort)], {
    cwd: rootPath,
    env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/task-10-map-retry-hit-test.log" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    windowsHide: true,
  });
  server.stdout.setEncoding("utf8");
  server.stderr.setEncoding("utf8");
  server.stdout.on("data", (chunk) => { serverOutput += chunk; });
  server.stderr.on("data", (chunk) => { serverOutput += chunk; });
  await waitForServer(serverPort);
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32") {
    const termination = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true });
    await Promise.race([
      new Promise((resolve) => termination.once("close", resolve)),
      sleep(5_000),
    ]);
  } else {
    server.kill("SIGTERM");
  }
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    sleep(5_000),
  ]);
}

test.before(async () => {
  await startServer();
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
});

test.after(async () => {
  await browser?.close();
  await stopServer();
});

test("Given an unavailable map, when retry is activated across supported viewports, then its target owns the hit point and updates the notice", async () => {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://localhost:${serverPort}/?visualFixture=unavailable-v1`, { waitUntil: "networkidle" });

    const retry = page.getByRole("button", { name: "다시 시도", exact: true });
    await assert.doesNotReject(retry.waitFor({ state: "visible" }));
    const hitTarget = await retry.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + (rect.width / 2), rect.top + (rect.height / 2));
      return hit?.closest("button") === button;
    });
    assert.equal(hitTarget, true, `${viewport.width}x${viewport.height}: retry owns its center hit point`);

    await retry.click();
    await page.waitForFunction(() => document.querySelector("[role=status] p")?.textContent?.includes("다시 시도했습니다.") === true);
    await page.close();
  }
});
