import assert from "node:assert/strict";
import test from "node:test";

import type { WakeView } from "./wake";
import { runWake, type WakeIO, type WakeJob } from "./wakeRun";
import * as C from "./wakeCopy";

const w = (state: string, first: string, second: string, reason: string | null = null) => ({ state, reason, models: [{ role: "first", state: first, progress: null }, { role: "second", state: second, progress: null }] });
function io(jobs: Array<WakeJob | Error>, over: Partial<WakeIO> = {}) {
  const views: WakeView[] = [];
  let i = 0;
  let t = 0;
  const base: WakeIO = {
    start: async () => ({ kind: "started", jobId: "j1", pollAfterS: 3, wake: w("waking", "waiting", "waiting") }),
    poll: async () => { const j = jobs[Math.min(i++, jobs.length - 1)]; if (j instanceof Error) throw j; return j; },
    sleep: async (ms) => { t += ms; },
    onView: (v) => views.push(v),
    now: () => t,
    ...over,
  };
  return { base, views };
}

test("not allowed: no view, the caller keeps today's refusal", async () => {
  const { base, views } = io([], { start: async () => ({ kind: "not_allowed" }) });
  assert.deepEqual(await runWake(base), { kind: "not_allowed" });
  assert.equal(views.length, 0);
});

test("both ready: views walk waiting -> first ready -> scoring, then the job's result", async () => {
  const { base, views } = io([
    { status: "pending", wake: w("waking", "ready", "starting") },
    { status: "running", wake: w("ready", "ready", "ready") },
    { status: "done", wake: w("ready", "ready", "ready"), result: { run_id: "r" } },
  ]);
  const o = await runWake(base);
  assert.deepEqual(o, { kind: "done", wire: { run_id: "r" } });
  assert.deepEqual(views.map((v) => v.line).filter(Boolean), [C.WAKE_PROGRESS_ALL, C.WAKE_PROGRESS_FIRST_READY, C.WAKE_DONE_BOTH, C.WAKE_DONE_BOTH]);
});

test("partial: the done job carries the result and the warning view is the last one shown", async () => {
  const { base, views } = io([{ status: "done", wake: w("partial", "ready", "failed", "second_judge_unavailable"), result: { run_id: "r" } }]);
  assert.equal((await runWake(base)).kind, "done");
  assert.equal(views.at(-1)?.warning, C.WAKE_WARN_SECOND_FAILED);
});

test("a failed job stops with the engine's wake words; nothing is returned", async () => {
  const { base } = io([{ status: "failed", wake: w("timeout", "starting", "starting", "start_timeout") }]);
  const o = await runWake(base);
  assert.equal(o.kind, "stopped");
  assert.equal(o.kind === "stopped" && o.view.warning, C.failBothLine(true));
});

test("a done job without a result, an unknown status and three failed polls all stop with the poll-error line", async () => {
  for (const jobs of [[{ status: "done", wake: w("ready", "ready", "ready") }], [{ status: "weird", wake: null }], [new Error("x"), new Error("x"), new Error("x")]] as Array<Array<WakeJob | Error>>) {
    const o = await runWake(io(jobs).base);
    assert.equal(o.kind === "stopped" && o.view.warning, C.WAKE_POLL_ERROR);
  }
});

test("one failed poll is retried; the page stops polling after its own limit; cancel throws AbortError", async () => {
  const ok = await runWake(io([new Error("x"), { status: "done", wake: null, result: { a: 1 } }]).base);
  assert.deepEqual(ok, { kind: "done", wire: { a: 1 } });
  const slow = await runWake(io([{ status: "pending", wake: w("waking", "starting", "starting") }], { maxMs: 20_000 }).base);
  assert.equal(slow.kind === "stopped" && slow.view.warning, C.failBothLine(true));
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(runWake(io([{ status: "pending", wake: null }], { signal: ac.signal }).base), { name: "AbortError" });
});
