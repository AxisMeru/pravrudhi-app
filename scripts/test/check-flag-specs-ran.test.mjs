import assert from "node:assert/strict";
import test from "node:test";

import { REQUIRED, check, countByFile } from "../check-flag-specs-ran.mjs";

const spec = (file, ...statuses) => ({ file, tests: statuses.map((status) => ({ status })) });
const report = (...specs) => ({ suites: [{ suites: [{ specs }] }] });
const GOOD = report(spec("assistant-run.spec.ts", "expected", "expected"), spec("assistant-tier.spec.ts", "expected", "skipped"), spec("intake.spec.ts", "expected"), spec("anonymous-assistant.spec.ts", "expected"), spec("your-matters.spec.ts", "expected", "expected", "skipped"));

test("a run where every required spec file ran passes (assistant-tier may skip its one deliberate test)", () => {
  assert.deepEqual(check(GOOD), []);
});

test("counts per spec file by final status, across nested suites", () => {
  const c = countByFile(report(spec("e2e/intake.spec.ts", "expected", "skipped", "unexpected")));
  assert.deepEqual(c.intake, { expected: 1, skipped: 1, unexpected: 1, flaky: 0 });
});

test("the silent-skip case: all flagged specs skipped (the flags did not reach the tests) fails every group", () => {
  const skipped = report(spec("assistant-run.spec.ts", "skipped", "skipped"), spec("assistant-tier.spec.ts", "skipped"), spec("intake.spec.ts", "skipped"), spec("anonymous-assistant.spec.ts", "skipped"), spec("your-matters.spec.ts", "skipped", "skipped", "skipped"));
  const failures = check(skipped);
  assert.equal(failures.length, 9); // not enough passed in all five files (5), plus skipped > 0 in assistant-run, intake and anonymous-assistant (3) and more than one skip in your-matters (1); assistant-tier allows skips
  for (const f of Object.keys(REQUIRED)) assert.ok(failures.some((x) => x.startsWith(`${f}:`)), f);
});

test("a spec file that is absent from the report fails; one skipped test in assistant-run or intake fails", () => {
  assert.ok(check(report(spec("intake.spec.ts", "expected"))).some((x) => x.startsWith("assistant-run:")));
  assert.ok(check(report(spec("assistant-run.spec.ts", "expected", "skipped"), spec("assistant-tier.spec.ts", "expected"), spec("intake.spec.ts", "expected"), spec("anonymous-assistant.spec.ts", "expected"), spec("your-matters.spec.ts", "expected", "expected", "skipped"))).some((x) => /assistant-run: 1 skipped/.test(x)));
});

test("a failed (unexpected) test is not a pass", () => {
  assert.ok(check(report(spec("assistant-run.spec.ts", "unexpected"), spec("assistant-tier.spec.ts", "expected"), spec("intake.spec.ts", "expected"), spec("anonymous-assistant.spec.ts", "expected"), spec("your-matters.spec.ts", "expected", "expected", "skipped"))).some((x) => /assistant-run: 0 passed/.test(x)));
});

test("your-matters: the flag-OFF build's one pass (the ON tests skipped) fails the guard; a ON run passes with its one deliberate skip", () => {
  assert.ok(check(report(spec("assistant-run.spec.ts", "expected"), spec("assistant-tier.spec.ts", "expected"), spec("intake.spec.ts", "expected"), spec("anonymous-assistant.spec.ts", "expected"), spec("your-matters.spec.ts", "expected", "skipped", "skipped"))).some((x) => /your-matters: 1 passed/.test(x)));
  assert.deepEqual(check(GOOD), []);
});
