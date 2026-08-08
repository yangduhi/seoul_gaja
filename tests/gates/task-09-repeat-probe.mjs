import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Given the focused recommendation suite, when it is repeated with a bounded timeout, then both runs finish green without flaking", () => {
  for (let run = 1; run <= 2; run += 1) {
    const result = spawnSync(process.execPath, [
      "--test",
      "tests/gates/task-09-happy.test.mjs",
      "tests/gates/task-09-failure.test.mjs",
      "tests/product/data/recommendation-route-model.test.mjs",
    ], { encoding: "utf8", timeout: 60_000 });

    assert.equal(result.error?.code, undefined, `run ${run} exceeded its timeout`);
    assert.equal(result.signal, null, `run ${run} ended by signal`);
    assert.equal(result.status, 0, `run ${run} failed:\n${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(result.stdout, /fail [1-9]/u);
  }
});
