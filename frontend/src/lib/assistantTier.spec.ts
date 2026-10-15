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
test("#309: an unreachable (failed or slow) health read is retried in seconds; every other state keeps the slow poll", () => {
  assert.equal(nextTierPollDelay("unreachable"), TIER_RETRY_MS);
  for (const s of ["available", "paused", "not_configured"] as const) assert.equal(nextTierPollDelay(s), TIER_POLL_MS);
  assert.ok(TIER_RETRY_MS < TIER_POLL_MS && TIER_RETRY_MS <= 10_000);
});
