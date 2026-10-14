import { strict as assert } from "node:assert";
import test from "node:test";

import { ASSISTANT_PAUSED_TEXT, assistantTierOf, readAssistantTier } from "./assistantTier";
import { frontierToggleState } from "./frontierReader";

test("the paused line is exactly the agreed words, once, with no reason code in it", () => {
  assert.equal(ASSISTANT_PAUSED_TEXT, "The assistant features are paused; screening works as normal");
  assert.doesNotMatch(ASSISTANT_PAUSED_TEXT, /no_key|upstream_error|quota|budget_floor|disabled|\d/);
});

test("the tier is available only when the engine says so in so many words; every other answer reads as unavailable (fail closed)", () => {
  assert.equal(assistantTierOf({ ok: true, assistant_tier: { state: "available", reason: null } }), "available");
  for (const reason of ["no_key", "upstream_error", "quota", "budget_floor", "disabled", null]) {
    assert.equal(assistantTierOf({ ok: true, assistant_tier: { state: "unavailable", reason } }), "unavailable", String(reason));
  }
  // absent (an older engine), malformed, or not the exact word
  assert.equal(assistantTierOf({ ok: true }), "unavailable");
  assert.equal(assistantTierOf({ ok: true, assistant_tier: null }), "unavailable");
  assert.equal(assistantTierOf({ ok: true, assistant_tier: "available" }), "unavailable");
  assert.equal(assistantTierOf({ ok: true, assistant_tier: {} }), "unavailable");
  assert.equal(assistantTierOf({ ok: true, assistant_tier: { state: "AVAILABLE" } }), "unavailable");
  assert.equal(assistantTierOf({ ok: true, assistant_tier: { state: true } }), "unavailable");
  assert.equal(assistantTierOf({ ok: true, frontier_reader_available: true }), "unavailable", "frontier_reader_available alone does not open the tier");
  for (const bad of [null, undefined, "available", 1, []]) assert.equal(assistantTierOf(bad), "unavailable");
});

test("a health read that fails or times out is unavailable; a good read passes through", async () => {
  assert.equal(await readAssistantTier(async () => ({ assistant_tier: { state: "available" } })), "available");
  assert.equal(await readAssistantTier(async () => ({ assistant_tier: { state: "unavailable", reason: "quota" } })), "unavailable");
  assert.equal(await readAssistantTier(async () => { throw new Error("network"); }), "unavailable");
  assert.equal(await readAssistantTier(() => new Promise(() => undefined), 20), "unavailable", "a read that never answers");
});

test("a paused tier greys the frontier toggle and never leaves it checked", () => {
  const s = frontierToggleState({ available: true, value: true, provider: "a provider", paused: true });
  assert.deepEqual(s, { disabled: true, checked: false, reason: null, consent: null });
  // not paused: the toggle behaves as before
  assert.equal(frontierToggleState({ available: true, value: true, provider: "p" }).checked, true);
  assert.equal(frontierToggleState({ available: null, value: true }).disabled, true);
});
