import { strict as assert } from "node:assert";
import test from "node:test";

import { ASSISTANT_PAUSED_TEXT, PAUSED_REASONS, assistantStateOf, isGreyed, pausedTreatment, readAssistantState } from "./assistantTier";
import { frontierToggleState } from "./frontierReader";

const tier = (state: unknown, reason?: unknown) => ({ ok: true, assistant_tier: { state, reason } });

test("the paused line is exactly the agreed words, with no reason code in it", () => {
  assert.equal(ASSISTANT_PAUSED_TEXT, "The assistant features are paused; screening works as normal");
  assert.doesNotMatch(ASSISTANT_PAUSED_TEXT, /no_key|upstream_error|quota|budget_floor|disabled|\d/);
});

test("PAUSED only for a configured tier that is refused or over budget: upstream_error, quota, budget_floor", () => {
  assert.deepEqual([...PAUSED_REASONS], ["upstream_error", "quota", "budget_floor"]);
  for (const reason of PAUSED_REASONS) assert.equal(assistantStateOf(tier("unavailable", reason)), "paused", reason);
});

test("NOT CONFIGURED (nothing shown): no_key, disabled, null, any unknown reason, a field that is absent or malformed", () => {
  for (const reason of ["no_key", "disabled", null, undefined, "", "something_new", "QUOTA", 5, {}]) assert.equal(assistantStateOf(tier("unavailable", reason)), "not_configured", String(reason));
  assert.equal(assistantStateOf({ ok: true }), "not_configured", "the field absent (an older engine, production today)");
  assert.equal(assistantStateOf({ ok: true, assistant_tier: null }), "not_configured");
  assert.equal(assistantStateOf({ ok: true, assistant_tier: "available" }), "not_configured");
  assert.equal(assistantStateOf({ ok: true, assistant_tier: {} }), "not_configured");
  assert.equal(assistantStateOf(tier("paused", "quota")), "not_configured", "an unknown state is not paused");
  assert.equal(assistantStateOf(tier(true, "quota")), "not_configured");
  assert.equal(assistantStateOf({ ok: true, frontier_reader_available: false }), "not_configured");
  for (const bad of [null, undefined, "available", 1, []]) assert.equal(assistantStateOf(bad), "not_configured");
});

test("AVAILABLE only when the engine says exactly 'available'", () => {
  assert.equal(assistantStateOf(tier("available", null)), "available");
  assert.equal(assistantStateOf(tier("available", "quota")), "available");
  assert.equal(assistantStateOf(tier("AVAILABLE")), "not_configured");
});

test("a health read that fails or times out is unreachable (greyed, no line); a good read passes through", async () => {
  assert.equal(await readAssistantState(async () => tier("available")), "available");
  assert.equal(await readAssistantState(async () => tier("unavailable", "budget_floor")), "paused");
  assert.equal(await readAssistantState(async () => tier("unavailable", "no_key")), "not_configured");
  assert.equal(await readAssistantState(async () => { throw new Error("network"); }), "unreachable");
  assert.equal(await readAssistantState(() => new Promise(() => undefined), 20), "unreachable", "a read that never answers");
});

test("greyed = paused or unreachable only; the paused line is for paused alone", () => {
  assert.deepEqual((["available", "paused", "not_configured", "unreachable"] as const).map(isGreyed), [false, true, false, true]);
});

test("a paused tier greys the frontier toggle and never leaves it checked; any other state leaves the toggle as before", () => {
  assert.deepEqual(frontierToggleState({ available: true, value: true, provider: "a provider", paused: true }), { disabled: true, checked: false, reason: null, consent: null });
  assert.equal(frontierToggleState({ available: true, value: true, provider: "p" }).checked, true);
  assert.equal(frontierToggleState({ available: null, value: true }).disabled, true);
});

test("the paused reasons are matched exactly: a near miss is not paused", () => {
  for (const reason of ["quota_x", "upstream_errors", "upstream_error_x", "xquota", "budget_floor ", " quota", "budget", "Budget_Floor"]) assert.equal(assistantStateOf(tier("unavailable", reason)), "not_configured", reason);
});

test("R1 14 Oct: the paused line and the row greying apply ONLY with the entry flag on: flag off shows neither, whatever the tier says (both arms)", () => {
  for (const st of ["available", "paused", "not_configured", "unreachable"] as const) assert.deepEqual(pausedTreatment(st, false), { line: false, grey: false }, `flag off, ${st}`);
  assert.deepEqual(pausedTreatment("paused", true), { line: true, grey: true });
  assert.deepEqual(pausedTreatment("unreachable", true), { line: false, grey: true }, "unreachable greys with no line");
  assert.deepEqual(pausedTreatment("available", true), { line: false, grey: false });
  assert.deepEqual(pausedTreatment("not_configured", true), { line: false, grey: false });
});

import { TIER_POLL_MS, TIER_RETRY_MS, nextTierPollDelay } from "./assistantTier";
test("#309/#311: an unreachable read is retried soon, then backs off 5, 10, 20, 40 s to the 60 s poll (+-20% jitter); every other state keeps the 60 s poll", () => {
  const seq = [1, 2, 3, 4, 5, 6, 20].map((n) => nextTierPollDelay("unreachable", n, 0.5));
  assert.deepEqual(seq, [5_000, 10_000, 20_000, 40_000, 60_000, 60_000, 60_000]);
  assert.equal(nextTierPollDelay("unreachable", 1, 0), 4_000);   // the low end of the jitter
  assert.equal(nextTierPollDelay("unreachable", 1, 1), 6_000);   // the high end
  assert.equal(nextTierPollDelay("unreachable", 5, 1), 72_000);  // a capped delay may be jittered above the poll (never a faster pace than the cap's low end)
  for (const s of ["available", "paused", "not_configured"] as const) assert.equal(nextTierPollDelay(s, 3, 0.9), TIER_POLL_MS);
  assert.ok(TIER_RETRY_MS < TIER_POLL_MS);
});

// R2 (#311): the loop that useAssistantState runs, tested without React and without real timers.
import { startTierPoller, type AssistantState } from "./assistantTier";
function harness(answers: AssistantState[], hiddenAtStart = false) {
  let hidden = hiddenAtStart;
  const listeners: Array<() => void> = [];
  const timers: Array<{ fn: () => void; ms: number; cancelled: boolean }> = [];
  const seen: AssistantState[] = [];
  let reads = 0;
  const stop = startTierPoller({
    read: async () => answers[Math.min(reads++, answers.length - 1)],
    onState: (s) => seen.push(s),
    setTimer: (fn, ms) => { const t = { fn, ms, cancelled: false }; timers.push(t); return t; },
    clearTimer: (t) => { (t as { cancelled: boolean }).cancelled = true; },
    random: () => 0.5,
    isHidden: () => hidden,
    onVisibilityChange: (cb) => { listeners.push(cb); return () => { listeners.splice(listeners.indexOf(cb), 1); }; },
  });
  const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
  const setHidden = (h: boolean) => { hidden = h; listeners.slice().forEach((cb) => cb()); };
  return { timers, seen, stop, tick, reads: () => reads, setHidden, listeners };
}

test("the poller backs off 5, 10, 20 s while the read fails and starts over at 5 s after one that answers", async () => {
  const h = harness(["unreachable", "unreachable", "unreachable", "available", "unreachable"]);
  await h.tick();
  assert.deepEqual(h.timers.map((t) => t.ms), [5_000]);
  h.timers[0].fn(); await h.tick();
  h.timers[1].fn(); await h.tick();
  assert.deepEqual(h.timers.map((t) => t.ms), [5_000, 10_000, 20_000]);
  h.timers[2].fn(); await h.tick(); // answers: the slow poll
  assert.equal(h.timers[3].ms, 60_000);
  h.timers[3].fn(); await h.tick(); // fails again: the count started over
  assert.equal(h.timers[4].ms, 5_000);
  assert.deepEqual(h.seen, ["unreachable", "unreachable", "unreachable", "available", "unreachable"]);
  h.stop();
});

test("stop() cancels the pending timer, and a read still in flight does nothing after it", async () => {
  const h = harness(["unreachable"]);
  await h.tick();
  h.stop();
  assert.equal(h.timers[0].cancelled, true);
  const h2 = harness(["available"]);
  h2.stop(); // stopped before the first read answers
  await h2.tick();
  assert.deepEqual(h2.seen, []);
  assert.deepEqual(h2.timers, []);
});

test("#323: a hidden tab makes no read; a read that fell due is made once when the tab is shown, then the loop goes on", async () => {
  const h = harness(["available", "available", "available"]);
  await h.tick();
  assert.equal(h.reads(), 1);
  h.setHidden(true);
  h.timers[0].fn(); await h.tick(); // the 60 s poll falls due while hidden
  assert.equal(h.reads(), 1, "no read while hidden");
  h.setHidden(false); await h.tick(); // shown again: one read now
  assert.equal(h.reads(), 2);
  h.setHidden(true); h.setHidden(false); await h.tick(); // nothing was due: no extra read
  assert.equal(h.reads(), 2);
  assert.equal(h.timers.length, 2, "the next poll is scheduled after the read that answered");
  h.stop();
  assert.equal(h.listeners.length, 0, "stop() removes the visibility listener");
});

test("#323: a tab that starts hidden reads nothing until it is shown", async () => {
  const h = harness(["unreachable", "available"], true);
  await h.tick();
  assert.equal(h.reads(), 0);
  assert.deepEqual(h.timers, []);
  h.setHidden(false); await h.tick();
  assert.equal(h.reads(), 1);
  assert.deepEqual(h.seen, ["unreachable"]);
  h.stop();
});
