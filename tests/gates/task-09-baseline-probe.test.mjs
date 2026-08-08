import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { evaluateRecommendations } from "../../server/recommendations.mjs";

const fixturePath = resolve(import.meta.dirname, "..", "fixtures", "task-09", "positive", "recommendations.json");

test("Given the unchanged recommendation seam, when its source-backed fixture is evaluated, then the public NOW/NEXT observable is pinned", async () => {
  const input = JSON.parse(await readFile(fixturePath, "utf8"));

  const result = evaluateRecommendations(input);

  assert.deepEqual(
    {
      now: {
        status: result.now.status,
        areaCode: result.now.results[0]?.areaCode,
        selectedTimestamp: result.now.results[0]?.selectedTimestamp,
        variant: result.now.results[0]?.variant,
      },
      next: {
        status: result.next.status,
        areaCode: result.next.results[0]?.areaCode,
        selectedTimestamp: result.next.results[0]?.selectedTimestamp,
        variant: result.next.results[0]?.variant,
      },
    },
    {
      now: {
        status: "READY",
        areaCode: "aardvark",
        selectedTimestamp: "2026-08-04T09:20:00Z",
        variant: "history-enhanced",
      },
      next: {
        status: "READY",
        areaCode: "aardvark",
        selectedTimestamp: "2026-08-04T10:00:00Z",
        variant: "history-enhanced",
      },
    },
  );
});
