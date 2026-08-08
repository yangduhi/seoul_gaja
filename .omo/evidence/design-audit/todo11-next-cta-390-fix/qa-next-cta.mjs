import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const port = Number(process.env.QA_PORT);
const evidencePath = fileURLToPath(new URL("./qa-next-cta-result.json", import.meta.url));
const route = `http://localhost:${port}/?visualFixture=ready-v1`;
const viewports = [[390, 844], [430, 932], [768, 1024], [1616, 923]];
const result = { route, status: "FAIL", rows: [] };
let browser;

function bounded(promise, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), 20_000)),
  ]);
}

try {
  assert.ok(Number.isInteger(port) && port > 0, "QA_PORT must be a positive integer");
  browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
  result.browser = browser.version();

  for (const [width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height } });
    const row = { viewport: `${width}x${height}`, status: "FAIL" };
    result.rows.push(row);
    try {
      await bounded(page.goto(route, { waitUntil: "networkidle" }), `${row.viewport}: route did not become idle`);
      row.before = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".sg-recommendation")];
        const button = (mode) => cards.find((card) => card.querySelector("h2")?.textContent?.trim() === mode)?.querySelector("button");
        const rect = (element) => {
          const { bottom, height, left, right, top, width } = element.getBoundingClientRect();
          return { bottom, height, left, right, top, width };
        };
        const now = button("NOW");
        const next = button("NEXT");
        const visibleTargets = [...document.querySelectorAll("button, a, summary, input, select, textarea")]
          .filter((element) => element.getClientRects().length > 0)
          .map(rect);
        const cardRects = cards.map(rect);
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          next: next ? rect(next) : null,
          nextCurrent: next?.dataset.currentDecision === "true",
          nextGradient: next ? getComputedStyle(next).backgroundImage : "",
          now: now ? rect(now) : null,
          nowCurrent: now?.dataset.currentDecision === "true",
          nowGradient: now ? getComputedStyle(now).backgroundImage : "",
          oneColumn: cardRects.length === 2 && cardRects[0].left === cardRects[1].left,
          targetsAtLeast44: visibleTargets.every((target) => target.width >= 44 && target.height >= 44),
        };
      });
      assert.ok(row.before.now, `${row.viewport}: NOW CTA missing`);
      assert.ok(row.before.next, `${row.viewport}: NEXT CTA missing`);
      assert.equal(row.before.next.left >= 0 && row.before.next.right <= width && row.before.next.top >= 0 && row.before.next.bottom <= height, true, `${row.viewport}: NEXT CTA clipped`);
      assert.equal(row.before.overflow, false, `${row.viewport}: horizontal overflow`);
      assert.match(row.before.nowGradient, /linear-gradient/, `${row.viewport}: NOW lost emphasis`);
      assert.doesNotMatch(row.before.nextGradient, /linear-gradient/, `${row.viewport}: NEXT gained emphasis`);
      assert.equal(row.before.nowCurrent, true, `${row.viewport}: NOW current marker missing`);
      assert.equal(row.before.nextCurrent, false, `${row.viewport}: NEXT current marker present`);
      assert.equal(row.before.targetsAtLeast44, true, `${row.viewport}: undersized visible target`);
      assert.equal(row.before.oneColumn, width < 900, `${row.viewport}: wrong recommendation grid`);

      await bounded(page.click(".sg-recommendation:nth-child(2) button"), `${row.viewport}: NEXT page.click timed out`);
      await bounded(page.waitForURL(/\/places\/alpha(?:\?.*)?$/), `${row.viewport}: NEXT click did not change route`);
      await page.keyboard.press("Tab");
      row.after = await page.evaluate(() => ({ activeElement: document.activeElement?.tagName, path: location.pathname }));
      assert.equal(row.after.path, "/places/alpha", `${row.viewport}: NEXT did not open alpha`);
      assert.notEqual(row.after.activeElement, "BODY", `${row.viewport}: focus lost after NEXT activation`);
      row.status = "PASS";
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
      row.failureState = await page.evaluate(() => ({ path: location.pathname, htmlLength: document.documentElement.outerHTML.length }));
      throw error;
    } finally {
      await page.close();
    }
  }
  result.status = "PASS";
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(result));
