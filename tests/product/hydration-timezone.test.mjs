import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const cachedPlaywright = createRequire("D:\\DevWorkCache\\npm\\_npx\\a5b920f00216d246\\node_modules\\playwright\\package.json");
const { chromium } = cachedPlaywright("playwright");
const rootPath = fileURLToPath(new URL("../../", import.meta.url));
const routes = ["/", "/places/POI001"];
const evidenceDirectory = process.env.HYDRATION_EVIDENCE_DIR;
const catalogProps = {
  status: "READY",
  catalog: [{ areaCode: "POI001", areaName: "강남 MICE 관광특구", availability: "available", crowdLevel: "NORMAL", populationMin: 1200, populationMax: 1800, sourceUpdatedAt: "2026-08-06T00:00:00.000Z", fetchedAt: "2026-08-06T00:00:00.000Z", freshness: "fresh", freshnessBasis: "source_updated_at" }],
  snapshotStatus: "READY",
  sourceTime: "2026-08-06T00:00:00.000Z",
  recommendations: {
    now: { mode: "NOW", status: "READY", results: [{ areaCode: "POI001", variant: "base", historyMaturity: "ACCUMULATING", selectedTimestamp: "2026-08-06T00:00:00.000Z", sourceTimestamps: {}, reasons: [] }] },
    next: { mode: "NEXT", status: "READY", results: [{ areaCode: "POI001", variant: "base", historyMaturity: "ACCUMULATING", selectedTimestamp: "2026-08-06T01:00:00.000Z", sourceTimestamps: {}, reasons: [] }] },
  },
};
const detailProps = {
  areaCode: "POI001",
  payload: {
    status: "READY",
    areaCode: "POI001",
    areaName: "강남 MICE 관광특구",
    snapshot: { areaName: "강남 MICE 관광특구", availability: "available", crowdLevel: "NORMAL", populationMin: 1200, populationMax: 1800, sourceUpdatedAt: "2026-08-06T00:00:00.000Z", fetchedAt: "2026-08-06T00:00:00.000Z", freshness: "fresh", freshnessBasis: "source_updated_at" },
    forecast: Array.from({ length: 6 }, (_, index) => ({ timestamp: `2026-08-06T0${index}:00:00.000Z`, crowdLevel: "NORMAL", populationMin: 1200 + index * 100, populationMax: 1800 + index * 100, sourceUpdatedAt: "2026-08-06T00:00:00.000Z" })),
    history: [],
  },
};
let browser;
let vite;
let httpServer;
let serverPort;

function visibleTimes(text) {
  return [...text.matchAll(/(?:\uC624\uC804|\uC624\uD6C4)\s*\d{1,2}:\d{2}/g)].map(([value]) => value.replace(/\s+/g, " "));
}

function visibleTimeValues(times) {
  return [...new Set(times)].sort();
}

function virtualModules() {
  return {
    name: "hydration-timezone-exact-component-seam",
    enforce: "pre",
    resolveId(id) {
      if (id === "next/link" || id === "virtual:hydration-next-link") return "\0virtual:hydration-next-link";
      if (["virtual:hydration-fixture", "/__hydration-client.tsx", "/__hydration-server.tsx"].includes(id)) return `\0${id}`;
      return null;
    },
    load(id) {
      if (id === "\0virtual:hydration-fixture") return `export const catalogProps = ${JSON.stringify(catalogProps)}; export const detailProps = ${JSON.stringify(detailProps)};`;
      if (id === "\0virtual:hydration-next-link") return 'import React from "react"; export default function Link({ href, children, ...props }) { return React.createElement("a", { href, ...props }, children); }';
      if (id === "\0/__hydration-server.tsx") return [
        'import React from "react";',
        'import { renderToString } from "react-dom/server";',
        'import { CatalogSurface } from "/app/_catalog/CatalogSurface.tsx";',
        'import { PlaceDetailClient } from "/app/places/[areaCode]/PlaceDetailClient.tsx";',
        'import { catalogProps, detailProps } from "virtual:hydration-fixture";',
        'export function renderRoute(pathname) { return renderToString(pathname === "/places/POI001" ? React.createElement(PlaceDetailClient, detailProps) : React.createElement(CatalogSurface, catalogProps)); }',
      ].join("\n");
      if (id === "\0/__hydration-client.tsx") return [
        'import React from "react";',
        'import { hydrateRoot } from "react-dom/client";',
        'import { CatalogSurface } from "/app/_catalog/CatalogSurface.tsx";',
        'import { PlaceDetailClient } from "/app/places/[areaCode]/PlaceDetailClient.tsx";',
        'import { catalogProps, detailProps } from "virtual:hydration-fixture";',
        'const component = window.location.pathname === "/places/POI001" ? React.createElement(PlaceDetailClient, detailProps) : React.createElement(CatalogSurface, catalogProps);',
        'hydrateRoot(document.getElementById("root"), component);',
        'window.__HYDRATION_TIMEZONE_SEAM_READY__ = true;',
      ].join("\n");
      return null;
    },
  };
}

async function startHarness() {
  process.env.TZ = "UTC";
  vite = await createViteServer({ root: rootPath, configFile: false, appType: "custom", cacheDir: ".omo/tmp/hydration-vite-cache", server: { middlewareMode: true, watch: { ignored: ["**/.omo/evidence/**"] } }, resolve: { alias: { "next/link": "virtual:hydration-next-link" } }, optimizeDeps: { exclude: ["next/link"] }, plugins: [virtualModules()] });
  const { renderRoute } = await vite.ssrLoadModule("/__hydration-server.tsx");
  httpServer = createHttpServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`).pathname;
    if (!routes.includes(pathname)) {
      vite.middlewares(request, response, () => { response.writeHead(404); response.end("Not found"); });
      return;
    }
    try {
      const markup = await renderRoute(pathname);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html lang="ko"><body><div id="root">${markup}</div><script type="module" src="/@vite/client"></script><script type="module" src="/__hydration-client.tsx"></script></body></html>`);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.stack : String(error));
    }
  });
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => { httpServer.off("error", reject); resolve(); });
  });
  const address = httpServer.address();
  assert.ok(address && typeof address !== "string", "The UTC SSR harness must bind a local port.");
  serverPort = address.port;
}

async function stopHarness() {
  await browser?.close();
  if (httpServer?.listening) await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
  await vite?.close();
}

async function capture(page, name) {
  if (!evidenceDirectory) return;
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: join(evidenceDirectory, `${name}.png`), fullPage: true });
  await writeFile(join(evidenceDirectory, `${name}.html`), await page.content(), "utf8");
}

async function exerciseCloseAndBack(page) {
  const opener = page.getByRole("button", { name: "강남 MICE 관광특구 상세 보기" });
  await opener.focus();
  await opener.click();
  await page.getByRole("dialog", { name: "강남 MICE 관광특구 상세" }).waitFor();
  await capture(page, "root-detail-sheet");
  assert.equal(new URL(page.url()).pathname, "/places/POI001");
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await page.getByRole("dialog", { name: "강남 MICE 관광특구 상세" }).waitFor({ state: "detached" });
  assert.equal(new URL(page.url()).pathname, "/");
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(50);
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "place-POI001");
}

async function observeRoute(route) {
  const url = `http://127.0.0.1:${serverPort}${route}`;
  const serverContext = await browser.newContext({ javaScriptEnabled: false, timezoneId: "Asia/Seoul", viewport: { width: 390, height: 844 } });
  const serverPage = await serverContext.newPage();
  await serverPage.goto(url, { waitUntil: "networkidle" });
  const serverText = await serverPage.locator("body").innerText();
  const serverTimes = visibleTimes(serverText);
  await capture(serverPage, `${route === "/" ? "root" : "detail"}-server`);
  await serverContext.close();

  const clientContext = await browser.newContext({ timezoneId: "Asia/Seoul", viewport: { width: 390, height: 844 } });
  const clientPage = await clientContext.newPage();
  const hydrationEvents = [];
  const runtimeEvents = [];
  const requestFailures = [];
  clientPage.on("console", (message) => { const text = message.text(); if (/hydration|\b418\b/i.test(text)) hydrationEvents.push(`console:${message.type()}:${text}`); });
  clientPage.on("pageerror", (error) => { runtimeEvents.push(`pageerror:${error.message}`); if (/hydration|\b418\b/i.test(error.message)) hydrationEvents.push(`pageerror:${error.message}`); });
  clientPage.on("requestfailed", (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`));
  await clientPage.goto(url, { waitUntil: "networkidle" });
  await clientPage.waitForFunction(() => window.__HYDRATION_TIMEZONE_SEAM_READY__ === true);
  await clientPage.waitForTimeout(100);
  if (route === "/") {
    assert.equal(await clientPage.getByRole("heading", { name: "NOW", exact: true }).count(), 1);
    assert.equal(await clientPage.getByRole("heading", { name: "NEXT", exact: true }).count(), 1);
  }
  const clientText = await clientPage.locator("body").innerText();
  const clientTimes = visibleTimes(clientText);
  const interaction = route === "/" && process.env.HYDRATION_ASSERT_INTERACTIONS === "1" ? await exerciseCloseAndBack(clientPage).then(() => "PASS") : "NOT_RUN";
  await capture(clientPage, `${route === "/" ? "root" : "detail"}-client`);
  await clientContext.close();
  return { route, serverTimes, clientTimes, hydrationEvents, runtimeEvents, requestFailures, interaction };
}

test.before(async () => {
  await startHarness();
  browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: process.env.HYDRATION_HEADED !== "1" });
});

test.after(async () => { await stopHarness(); });

test("Given Node UTC SSR and an Asia-Seoul browser, When exact catalog and direct-detail components hydrate, Then visible timestamps stay equal without React hydration events", { timeout: 90_000 }, async () => {
  const observations = await Promise.all(routes.map(observeRoute));
  if (evidenceDirectory) await writeFile(join(evidenceDirectory, "observations.json"), `${JSON.stringify(observations, null, 2)}\n`, "utf8");
  console.log(`HYDRATION_OBSERVATIONS=${JSON.stringify(observations)}`);
  assert.ok(
    observations.every(({ serverTimes, clientTimes }) => serverTimes.length > 0 && clientTimes.length > 0),
    `Both exact render paths must expose Korean clock text. Observed: ${JSON.stringify(observations)}`,
  );
  const actual = observations.map(({ route, serverTimes, clientTimes, hydrationEvents, runtimeEvents }) => ({ route, serverTimeValues: visibleTimeValues(serverTimes), clientTimeValues: visibleTimeValues(clientTimes), hydrationEvents, runtimeEvents }));
  const expected = observations.map(({ route, serverTimes }) => ({ route, serverTimeValues: visibleTimeValues(serverTimes), clientTimeValues: visibleTimeValues(serverTimes), hydrationEvents: [], runtimeEvents: [] }));
  assert.deepEqual(actual, expected);
});
