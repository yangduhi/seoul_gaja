import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { chromium } from "playwright";

const root = new URL("../../", import.meta.url);
const rootPath = decodeURIComponent(root.pathname).replace(/^\/(?:[A-Za-z]:)/, (match) => match.slice(1));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let server;
let serverOutput = "";
let serverPort;
let browser;

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
      ctaCount: (cardHtml.match(/추천 장소 자세히 보기/g) ?? []).length,
      currentClassCount: (cardHtml.match(/sg-current-decision-cta/g) ?? []).length,
      currentMarkerCount: (cardHtml.match(/data-current-decision="true"/g) ?? []).length,
    };
  });
}

test.before(async () => {
  await startServer();
  browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
});

test.after(async () => {
  await browser?.close();
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
  assert.equal(cards.reduce((sum, card) => sum + card.currentClassCount, 0), 1);
  assert.equal(cards.find(({ mode }) => mode === "NOW")?.currentClassCount, 1);
  assert.equal(cards.find(({ mode }) => mode === "NEXT")?.currentClassCount, 0);
});

test("only NOW CTA carries the decision gradient while NEXT stays neutral", async () => {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await page.goto(`http://localhost:${serverPort}/?visualFixture=ready-v1`, { waitUntil: "networkidle" });
  const styles = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".sg-recommendation")].map((card) => {
    const mode = card.querySelector("h2")?.textContent?.trim();
    const button = mode === "NOW" ? card.querySelector("[data-current-decision]") : card.querySelector("button[class*='detailAction']");
    const computed = button ? getComputedStyle(button) : null;
    return [mode, { backgroundImage: computed?.backgroundImage ?? "", backgroundColor: computed?.backgroundColor ?? "" }];
  })));
  await page.close();
  assert.notEqual(styles.NOW?.backgroundImage, styles.NEXT?.backgroundImage);
  assert.match(styles.NOW?.backgroundImage ?? "", /linear-gradient/);
  assert.doesNotMatch(styles.NEXT?.backgroundImage ?? "", /linear-gradient/);
});

test("Given the recommendation surface, when each supported viewport activates NEXT, then the CTA stays visible and operable", async () => {
  for (const viewport of [
    { width: 390, height: 844, layout: "mobile" },
    { width: 430, height: 932, layout: "mobile" },
    { width: 768, height: 1024, layout: "mobile" },
    { width: 1616, height: 923, layout: "desktop" },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://localhost:${serverPort}/?visualFixture=ready-v1`, { waitUntil: "networkidle" });

    const observed = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".sg-recommendation")];
      const card = (mode) => cards.find((candidate) => candidate.querySelector("h2")?.textContent?.trim() === mode);
      const button = (mode) => card(mode)?.querySelector("button");
      const rect = (element) => {
        const { bottom, height, left, right, top, width } = element.getBoundingClientRect();
        return { bottom, height, left, right, top, width };
      };
      const now = button("NOW");
      const next = button("NEXT");
      const nowStyle = now ? getComputedStyle(now) : null;
      const nextStyle = next ? getComputedStyle(next) : null;
      const nextRect = next ? rect(next) : null;
      const visibleTargets = [...document.querySelectorAll("button, a, summary, input, select, textarea")]
        .filter((element) => element.getClientRects().length > 0)
        .map(rect);
      const recommendationRects = cards.map(rect);

      return {
        documentOverflow: document.documentElement.scrollWidth > window.innerWidth,
        next: nextRect,
        nextHitTarget: nextRect ? document.elementFromPoint(nextRect.left + (nextRect.width / 2), nextRect.top + (nextRect.height / 2))?.closest("button") === next : false,
        nextCurrent: next?.dataset.currentDecision === "true",
        nextGradient: nextStyle?.backgroundImage ?? "",
        now: now ? rect(now) : null,
        nowCurrent: now?.dataset.currentDecision === "true",
        nowGradient: nowStyle?.backgroundImage ?? "",
        oneColumn: recommendationRects.length === 2 && recommendationRects[0].left === recommendationRects[1].left,
        targetsAtLeast44: visibleTargets.every((target) => target.width >= 44 && target.height >= 44),
      };
    });

    assert.ok(observed.now, `${viewport.width}x${viewport.height}: NOW CTA is rendered`);
    assert.ok(observed.next, `${viewport.width}x${viewport.height}: NEXT CTA is rendered`);
    assert.equal(observed.next.left >= 0 && observed.next.right <= viewport.width && observed.next.top >= 0 && observed.next.bottom <= viewport.height, true, `${viewport.width}x${viewport.height}: NEXT CTA remains fully in the viewport`);
    assert.equal(observed.nextHitTarget, true, `${viewport.width}x${viewport.height}: NEXT CTA owns its hit target`);
    assert.equal(observed.documentOverflow, false, `${viewport.width}x${viewport.height}: no horizontal overflow`);
    assert.match(observed.nowGradient, /linear-gradient/, `${viewport.width}x${viewport.height}: NOW keeps decision emphasis`);
    assert.doesNotMatch(observed.nextGradient, /linear-gradient/, `${viewport.width}x${viewport.height}: NEXT remains neutral`);
    assert.equal(observed.nowCurrent, true, `${viewport.width}x${viewport.height}: NOW remains current`);
    assert.equal(observed.nextCurrent, false, `${viewport.width}x${viewport.height}: NEXT is not current`);
    assert.equal(observed.targetsAtLeast44, true, `${viewport.width}x${viewport.height}: visible controls retain touch size`);
    assert.equal(observed.oneColumn, viewport.layout === "mobile", `${viewport.width}x${viewport.height}: recommendation layout matches the responsive contract`);

    await page.click(".sg-recommendation:nth-child(2) button");
    await page.waitForFunction(() => window.location.pathname === "/places/alpha");
    await page.keyboard.press("Tab");
    assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), "BODY", `${viewport.width}x${viewport.height}: keyboard focus remains operable after CTA activation`);
    await page.close();
  }
});
