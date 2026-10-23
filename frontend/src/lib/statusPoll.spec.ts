import { strict as assert } from "node:assert";
import test from "node:test";

import { STATUS_FAILURES_TOLERATED, startStatusPoll, type StatusResult } from "./serviceStatus";

// #557: one failed status poll while the engine is busy (the 4B booting) must not show "The engine is not answering right now". N consecutive failures show it; a success resets the count; a failed poll is re-asked quickly, not after the full 30 s.
const OFFLINE: StatusResult = { kind: "offline" };
const UNKNOWN: StatusResult = { kind: "unknown" };

function rig(answers: StatusResult[]) {
  const shown: StatusResult[] = [];
  const timers: Array<{ ms: number; fn: () => void }> = [];
  let i = 0;
  const stop = startStatusPoll((r) => shown.push(r), {
    fetch: async () => answers[Math.min(i++, answers.length - 1)]!,
    setTimeout: ((fn: () => void, ms: number) => { timers.push({ ms, fn }); return timers.length; }) as unknown as typeof setTimeout,
    clearTimeout: (() => undefined) as unknown as typeof clearTimeout,
  });
  const next = async () => { const t = timers.shift(); if (t) { t.fn(); await new Promise((r) => setImmediate(r)); } return t?.ms; };
  return { shown, timers, stop, next, polled: () => i };
}
const tick = () => new Promise((r) => setImmediate(r));

test("N is 3", () => { assert.equal(STATUS_FAILURES_TOLERATED, 3); });

test("N-1 consecutive failures stay quiet; the Nth shows the line; the failed polls are re-asked quickly (5 s), the quiet ones at the usual 30 s", async () => {
  const r = rig([UNKNOWN, OFFLINE, OFFLINE, OFFLINE, OFFLINE]);
  await tick();
  assert.deepEqual(r.shown, [UNKNOWN]);
  assert.equal(await r.next(), 30_000);
  assert.equal(r.polled(), 2);
  assert.deepEqual(r.shown, [UNKNOWN], "1st failure: quiet");
  assert.equal(await r.next(), 5_000);
  assert.deepEqual(r.shown, [UNKNOWN], "2nd failure: quiet");
  assert.equal(await r.next(), 5_000);
  assert.deepEqual(r.shown, [UNKNOWN, OFFLINE], "3rd consecutive failure: shown");
  r.stop();
});

test("a success resets the counter: two failures, a success, two failures stay quiet", async () => {
  const r = rig([OFFLINE, OFFLINE, UNKNOWN, OFFLINE, OFFLINE, UNKNOWN]);
  await tick();
  await r.next(); await r.next(); await r.next(); await r.next();
  assert.deepEqual(r.shown, [UNKNOWN], "only the success was shown; no offline line");
  r.stop();
});

test("a result that is not 'offline' is passed on at once; stopping prevents any later call", async () => {
  const r = rig([UNKNOWN, UNKNOWN]);
  await tick();
  r.stop();
  assert.deepEqual(r.shown, [UNKNOWN]);
});
