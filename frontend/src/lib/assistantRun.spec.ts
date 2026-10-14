import { strict as assert } from "node:assert";
import test from "node:test";

import { ASSISTANT_BUDGET_TEXT, ASSISTANT_COULD_NOT_USE_TEXT, ASSISTANT_TIMEOUT_TEXT, STEP_LABELS, STEP_NAMES, assistantConsentLine, assistantOutcomeLine, assistantViolations, entryState, parseAssistantBlock, stepCheckText, type AssistantBlock } from "./assistantRun";
import { ASSISTANT_PAUSED_TEXT } from "./assistantTier";
import { DH_ASSIST_SIGNIN } from "./dataHandling";

const unreadable = (): never => { throw new Error("unreadable"); };
const good = { used: true, outcome: "finished", reason: null, steps: [{ name: "ingest" }, { name: "quote_check", check: "valid" }], cost: { used_cents: 1, budget_cents: 25 }, summary: "x", session_id: null };

test("the consent line: the signed words, the engine's provider, or no vendor of our own", () => {
  assert.equal(assistantConsentLine("Anthropic"), "Running with the assistant sends your facts to Anthropic through our account. Screening without the assistant does not.");
  for (const none of [null, undefined, "", "   "]) assert.match(assistantConsentLine(none), /to an AI provider through our account/);
});

test("the three plain lines are the signed words", () => {
  assert.equal(ASSISTANT_TIMEOUT_TEXT, "The assistant did not finish in time; this is the screening result without it.");
  assert.equal(ASSISTANT_BUDGET_TEXT, "The assistant's budget for this session is used; screening works as normal.");
  assert.equal(ASSISTANT_COULD_NOT_USE_TEXT, "The assistant could not be used for this run; this is the screening result without it.");
});

test("every one of the eight stages has a plain label, and no label carries a code word", () => {
  assert.equal(STEP_NAMES.length, 8);
  for (const n of STEP_NAMES) assert.ok(STEP_LABELS[n]);
  assert.doesNotMatch(Object.values(STEP_LABELS).join(" "), /verified|confirmed|proved|proof|denial|abstain|_/i);
});

test("a block that matches the contract has no violations; the app keeps only used, outcome, reason and steps", () => {
  assert.deepEqual(assistantViolations(good), []);
  const kept = parseAssistantBlock(good, unreadable);
  assert.deepEqual(kept, { used: true, outcome: "finished", reason: null, steps: [{ name: "ingest" }, { name: "quote_check", check: "valid" }] });
  assert.ok(!("summary" in kept) && !("cost" in kept));
});

test("planted: each way off the contract is caught and the whole answer is unreadable", () => {
  const bad: Array<[string, unknown]> = [
    ["not an object", "x"], ["an unknown key", { ...good, extra: 1 }], ["bad outcome", { ...good, outcome: "great" }], ["bad reason", { ...good, reason: "because" }],
    ["reason that does not fit the outcome", { ...good, outcome: "budget", reason: "timeout" }], ["finished with a reason", { ...good, reason: "error" }],
    ["steps not a list", { ...good, steps: {} }], ["unknown stage", { ...good, steps: [{ name: "think" }] }], ["unknown check", { ...good, steps: [{ name: "lean_check", check: "PROOF" }] }],
    ["extra step key", { ...good, steps: [{ name: "ingest", note: "x" }] }], ["non-integer cost", { ...good, cost: { used_cents: 0.5, budget_cents: 25 } }], ["used not boolean", { ...good, used: "yes" }],
  ];
  for (const [name, v] of bad) {
    assert.notDeepEqual(assistantViolations(v), [], name);
    assert.throws(() => parseAssistantBlock(v, unreadable), /unreadable/, name);
  }
});

const block = (outcome: AssistantBlock["outcome"], reason: AssistantBlock["reason"]): AssistantBlock => ({ used: false, outcome, reason, steps: [] });

test("the outcome line: none when finished; timeout, session budget; the paused line for the daily ceiling or a paused tier; could-not-use for every other refusal", () => {
  assert.equal(assistantOutcomeLine(block("finished", null)), null);
  assert.equal(assistantOutcomeLine(block("timed_out", "timeout")), ASSISTANT_TIMEOUT_TEXT);
  assert.equal(assistantOutcomeLine(block("budget", "per_session_budget")), ASSISTANT_BUDGET_TEXT);
  assert.equal(assistantOutcomeLine(block("refused", "daily_ceiling")), ASSISTANT_PAUSED_TEXT);
  assert.equal(assistantOutcomeLine(block("refused", "paused")), ASSISTANT_PAUSED_TEXT);
  for (const r of ["error", "safety", "consent_required", "not_configured"] as const) assert.equal(assistantOutcomeLine(block("refused", r)), ASSISTANT_COULD_NOT_USE_TEXT, r);
});

test("a step check in plain words, short forms (the row label says what was checked): quote check, Lean only as passed / did not pass, anything else nothing", () => {
  assert.equal(stepCheckText({ name: "quote_check", check: "valid" }), "passed");
  assert.equal(stepCheckText({ name: "quote_check", check: "invalid" }), "a quote was not found in your facts");
  assert.equal(stepCheckText({ name: "lean_check", check: "agrees" }), "passed");
  assert.equal(stepCheckText({ name: "lean_check", check: "differs" }), "did not pass");
  assert.equal(stepCheckText({ name: "lean_check" }), null);
  assert.equal(stepCheckText({ name: "lean_check", check: "valid" }), null, "a quote word on the Lean stage shows nothing");
  assert.equal(stepCheckText({ name: "ingest", check: "agrees" }), null);
});

test("the entry: usable ONLY on an explicit 'available'; before the first read (not_configured) it shows nothing; paused and unreachable are greyed; the flag off hides it all", () => {
  assert.equal(entryState("available", true), "usable");
  assert.equal(entryState("not_configured", true), "hidden", "before the first read nothing is shown or enabled");
  assert.equal(entryState("paused", true), "greyed");
  assert.equal(entryState("unreachable", true), "greyed");
  for (const t of ["available", "not_configured", "paused", "unreachable"] as const) assert.equal(entryState(t, false), "hidden", t);
});

test("the entry for a signed-out or not-yet-known user: signed-in is required to use it; unknown shows nothing", () => {
  assert.equal(entryState("available", true, true), "usable");
  assert.equal(entryState("available", true, false), "signin", "an anonymous visitor sees the sign-in line, no box");
  assert.equal(entryState("available", true, null), "hidden", "before /api/me answers nothing is shown or enabled");
  assert.equal(entryState("paused", true, false), "greyed");
  assert.equal(entryState("not_configured", true, false), "hidden");
});

test("contract v1.2: refused with sign_in_required or rate_limited is a readable block (the core result is kept); an unknown reason is still unreadable", () => {
  for (const reason of ["sign_in_required", "rate_limited"]) {
    const v = { used: false, outcome: "refused", reason, steps: [], cost: null, summary: null, session_id: null };
    assert.deepEqual(assistantViolations(v), [], reason);
    assert.deepEqual(parseAssistantBlock(v, unreadable), { used: false, outcome: "refused", reason, steps: [] });
  }
  for (const reason of ["rate_limitedX", "sign_in_requiredX", "Rate_Limited", "signin_required"]) assert.notDeepEqual(assistantViolations({ used: false, outcome: "refused", reason, steps: [] }), [], reason);
});

test("rate_limited reads as the could-not-use line (no reason shown); sign_in_required reads as the one sign-in line", () => {
  assert.equal(assistantOutcomeLine(block("refused", "rate_limited")), ASSISTANT_COULD_NOT_USE_TEXT);
  assert.equal(assistantOutcomeLine(block("refused", "sign_in_required")), DH_ASSIST_SIGNIN);
  for (const r of ["rate_limited", "sign_in_required", "error"] as const) assert.doesNotMatch(assistantOutcomeLine(block("refused", r)) ?? "", /rate_limited|sign_in_required|429|\berror\b/);
});

test("the outcome and reason must fit: budget carries per_session_budget ONLY (not daily_ceiling, not null); timed_out only timeout; finished no reason", () => {
  const base = { used: false, steps: [] };
  for (const [outcome, reason] of [["budget", "daily_ceiling"], ["budget", null], ["budget", "timeout"], ["timed_out", "per_session_budget"], ["timed_out", null], ["finished", "daily_ceiling"], ["refused", "timeout"], ["refused", "per_session_budget"], ["refused", null]] as const)
    assert.notDeepEqual(assistantViolations({ ...base, outcome, reason }), [], `${outcome}+${reason}`);
  for (const [outcome, reason] of [["budget", "per_session_budget"], ["timed_out", "timeout"], ["finished", null]] as const) assert.deepEqual(assistantViolations({ ...base, outcome, reason }), [], `${outcome}+${reason}`);
});
