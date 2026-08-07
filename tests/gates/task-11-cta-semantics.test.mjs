import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const rootPath = decodeURIComponent(root.pathname).replace(/^\/(?:[A-Za-z]:)/, (match) => match.slice(1));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let server;
let serverOutput = "";
let serverPort;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function choosePort() {
  return 49152 + ((process.pid * 17 + Date.now()) % 10000);
}

async function waitForServer(port) {
  const deadline = Date.now() + 45_000;
  const url = `http://localhost:${port}/?visualFixture=ready-v1`;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // The dev server is still compiling.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}. Output:\n${serverOutput}`);
}

async function startServer() {
  serverPort = choosePort();
  server = spawn(npmCommand, ["run", "dev", "--", "--host", "localhost", "--port", String(serverPort)], {
    cwd: rootPath,
    env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/task-11-cta-semantics.log" },
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
    spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true });
  } else {
    server.kill("SIGTERM");
  }
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    sleep(5_000),
  ]);
}

async function renderedRecommendationCards() {
  const response = await fetch(`http://localhost:${serverPort}/?visualFixture=ready-v1`);
  assert.equal(response.status, 200);
  const html = await response.text();
  const starts = [...html.matchAll(/<div class="[^"]*\bsg-recommendation\b[^"]*"><h2>(NOW|NEXT)<\/h2>/g)];
  return starts.map((match, index) => {
    const cardHtml = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    return {
      mode: match[1],
      ctaCount: (cardHtml.match(/sg-current-decision-cta/g) ?? []).length,
      currentMarkerCount: (cardHtml.match(/data-current-decision="true"/g) ?? []).length,
    };
  });
}

test.before(async () => {
  await startServer();
});

test.after(async () => {
  await stopServer();
});

test("the rendered recommendation carousel exposes reachable NOW and NEXT CTAs", async () => {
  const cards = await renderedRecommendationCards();
  assert.deepEqual(cards.map(({ mode }) => mode), ["NOW", "NEXT"]);
  assert.deepEqual(cards.map(({ ctaCount }) => ctaCount), [1, 1]);
});

test("the current-decision marker is unique to the NOW CTA while NEXT stays reachable", async () => {
  const cards = await renderedRecommendationCards();
  const markerCards = cards.filter(({ currentMarkerCount }) => currentMarkerCount === 1);
  assert.equal(cards.reduce((sum, card) => sum + card.currentMarkerCount, 0), 1);
  assert.deepEqual(markerCards.map(({ mode }) => mode), ["NOW"]);
  assert.equal(cards.find(({ mode }) => mode === "NEXT")?.ctaCount, 1);
});
