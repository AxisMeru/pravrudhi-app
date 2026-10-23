import assert from "node:assert/strict";
import test from "node:test";

import type { WakeView } from "./wake";
import { DEFAULT_MAX_MS, runWake, type WakeIO } from "./wakeRun";
import * as C from "./wakeCopy";

// The 0.6.31 wake status body: {wake: {state, models, reason, deadline_s, poll_after_s}, ticket?: {value, mode: "partial", expires_in_s}}.
const body = (state: string, first: string, second: string, reason: string | null = null, extra: Record<string, unknown> = {}) => ({
  wake: { state, reason, deadline_s: 330, poll_after_s: 5, models: [{ role: "first", state: first, progress: null }, { role: "second", state: second, progress: null }] },
  ...extra,
});
function io(polls: Array<unknown | Error>, over: Partial<WakeIO> = {}) {
  const views: WakeView[] = [];
  const sleeps: number[] = [];
  let i = 0;
  let t = 0;
  let starts = 0;
  const base: WakeIO = {
    start: async () => { starts++; return { kind: "started", body: body("waking", "waiting", "waiting") }; },
    poll: async () => { const j = polls[Math.min(i++, polls.length - 1)]; if (j instanceof Error) throw j; return j; },
    sleep: async (ms) => { sleeps.push(ms); t += ms; },
    onView: (v) => views.push(v),
    now: () => t,
    ...over,
  };
  return { base, views, sleeps, starts: () => starts };
}

test("not allowed: no view, the caller keeps today's refusal", async () => {
  const { base, views } = io([], { start: async () => ({ kind: "not_allowed" }) });
  assert.deepEqual(await runWake(base), { kind: "not_allowed" });
  assert.equal(views.length, 0);
});

test("both ready: views walk waiting -> first ready -> scoring, polled at the engine's cadence; the page then sends the screening (outcome ready)", async () => {
  const { base, views, sleeps } = io([body("waking", "ready", "starting"), body("ready", "ready", "ready")]);
  assert.deepEqual(await runWake(base), { kind: "ready", ticket: null });
  assert.deepEqual(views.map((v) => v.line).filter(Boolean), [C.WAKE_PROGRESS_ALL, C.WAKE_PROGRESS_FIRST_READY, C.WAKE_DONE_BOTH]);
  assert.deepEqual(sleeps, [5000, 5000]);
});

test("already up: the start answers ready at once and nothing is polled", async () => {
  const { base, sleeps } = io([], { start: async () => ({ kind: "started", body: body("ready", "ready", "ready") }) });
  assert.deepEqual(await runWake(base), { kind: "ready", ticket: null });
  assert.deepEqual(sleeps, []);
});

test("partial: the outcome carries the ticket from the status body (partial only); a ticket on any other state is ignored", async () => {
  const t = { ticket: { value: "tkt-invented", mode: "partial", expires_in_s: 600 } };
  const a = io([body("partial", "ready", "failed", "second_judge_unavailable", t)]);
  assert.deepEqual(await runWake(a.base), { kind: "partial", ticket: "tkt-invented" });
  assert.equal(a.views.at(-1)?.warning, C.WAKE_WARN_SECOND_FAILED);
  const b = io([body("partial", "ready", "failed", "second_judge_unavailable")]);
  assert.deepEqual(await runWake(b.base), { kind: "partial", ticket: null });
  const c = io([body("ready", "ready", "ready", null, t)]);
  assert.deepEqual(await runWake(c.base), { kind: "ready", ticket: null }, "a partial-mode ticket on a ready wake is ignored");
  const c2 = io([body("ready", "ready", "ready", null, { ticket: { value: "tkt-full", mode: "full", expires_in_s: 600 } })]);
  assert.deepEqual(await runWake(c2.base), { kind: "ready", ticket: "tkt-full" }, "a full ticket on a ready wake is kept (optional: it only extends the judge leases)");
  const e2 = io([body("partial", "ready", "failed", "second_judge_unavailable", { ticket: { value: "tkt-full", mode: "full" } })]);
  assert.deepEqual(await runWake(e2.base), { kind: "partial", ticket: null }, "a full ticket on a partial wake is not accepted");
  const d = io([body("partial", "ready", "failed", "second_judge_unavailable", { ticket: { value: "x", mode: "full" } })]);
  assert.deepEqual(await runWake(d.base), { kind: "partial", ticket: null });
});

test("failed and timeout stop with the engine's wake words and are terminal; nothing is screened", async () => {
  const f = await runWake(io([body("failed", "failed", "starting", "first_judge_unavailable")]).base);
  assert.equal(f.kind === "stopped" && f.terminal, true);
  assert.equal(f.kind === "stopped" && f.view.warning, C.WAKE_WARN_FIRST_FAILED);
  const t = await runWake(io([body("timeout", "starting", "starting", "start_timeout")]).base);
  assert.equal(t.kind === "stopped" && t.view.warning, C.failBothLine(true));
});

test("an unreadable status, an unknown state and three failed polls stop with the poll-error line, not terminal", async () => {
  for (const polls of [[{}], [{ wake: { state: "weird" } }], [new Error("x"), new Error("x"), new Error("x")]] as Array<Array<unknown | Error>>) {
    const o = await runWake(io(polls).base);
    assert.equal(o.kind === "stopped" && o.view.warning, C.WAKE_POLL_ERROR);
    assert.equal(o.kind === "stopped" && o.terminal, false);
  }
});

test("resume follows an open wake without a start call; one failed poll is retried; the page's limit (the engine's deadline plus a margin) stops it; cancel throws", async () => {
  const r = io([body("ready", "ready", "ready")], { resume: true });
  assert.deepEqual(await runWake(r.base), { kind: "ready", ticket: null });
  assert.equal(r.starts(), 0);
  const ok = await runWake(io([new Error("x"), body("ready", "ready", "ready")]).base);
  assert.deepEqual(ok, { kind: "ready", ticket: null });
  const slow = await runWake(io([body("waking", "starting", "starting")]).base);
  assert.equal(slow.kind === "stopped" && slow.view.warning, C.failBothLine(true));
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(runWake(io([body("waking", "waiting", "waiting")], { signal: ac.signal }).base), { name: "AbortError" });
});

test("the status is allowlist-gated like the start: a poll that answers not allowed ends as not_allowed (today's refusal), never as a state or a poll error", async () => {
  const gated = new Error("wake not allowed");
  gated.name = "WakeNotAllowedError";
  const { base, views } = io([gated]);
  assert.deepEqual(await runWake(base), { kind: "not_allowed" });
  assert.equal(views.filter((v) => v.warning).length, 0);
});

test("#549 (R2): a start that takes 550 s under the engine's 570 s deadline is waited for (the old 480 s cap would have stopped it); a never-ready wake stops at the deadline + margin", async () => {
  assert.equal(DEFAULT_MAX_MS, 600_000);
  const slow = (state: string) => ({ wake: { state, reason: null, deadline_s: 570, poll_after_s: 5, models: [{ role: "first", state: state === "ready" ? "ready" : "starting", progress: null }, { role: "second", state: state === "ready" ? "ready" : "starting", progress: null }] } });
  const polls: unknown[] = Array.from({ length: 109 }, () => slow("waking"));
  polls.push(slow("ready"));
  const startSlow = async () => ({ kind: "started" as const, body: slow("waking") });
  const { base } = io(polls, { start: startSlow });
  assert.deepEqual(await runWake(base), { kind: "ready", ticket: null });
  const never = io([slow("waking")], { start: startSlow });
  const out = await runWake(never.base);
  assert.equal(out.kind, "stopped");
  assert.ok(never.sleeps.reduce((a, b) => a + b, 0) <= 605_000);
});
