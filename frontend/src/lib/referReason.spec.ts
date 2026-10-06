// R1's finding (2026-09-27): the matters page showed the same "the judge could not reach a confident
// established/not-established reading" banner for every REFER_TO_LAWYER, including reasons that are not
// uncertainty at all (second_judge_unavailable, contract_not_validated, ...). These tests are about
// truthfulness rather than styling, same as elementStatus.spec.ts.

import { strict as assert } from "node:assert";
import test from "node:test";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REFER_REASONS, referReasonPresentation, isReferReason } from "./referReason";

test("referReason: every canonical reason has a mapping (trips if a tenth is added without one)", () => {
  for (const reason of REFER_REASONS) {
    assert.doesNotThrow(() => referReasonPresentation(reason), `${reason} has no message mapping`);
    assert.equal(isReferReason(reason), true);
  }
  assert.equal(REFER_REASONS.length, 9, "the canonical reason list changed — review the mapping and these tests");
});

test("referReason: the nine canonical reasons each get a distinct, non-empty message", () => {
  const messages = new Set<string>();
  for (const reason of REFER_REASONS) {
    const p = referReasonPresentation(reason);
    assert.equal(p.reason, reason);
    assert.equal(p.unknown, false);
    assert.ok(p.message.length > 0, `${reason} has no message`);
    messages.add(p.message);
  }
  assert.equal(messages.size, REFER_REASONS.length, "two reasons share a message");
});

test("referReason: uncertain reads as model uncertainty, not availability", () => {
  const p = referReasonPresentation("uncertain");
  assert.equal(p.message, "an element couldn't be judged confidently from these facts");
});

test("referReason: second_judge_unavailable reads as an availability gap, not uncertainty, and invites a retry", () => {
  const p = referReasonPresentation("second_judge_unavailable");
  assert.match(p.message, /temporarily unavailable/);
  assert.match(p.message, /try again/);
  assert.doesNotMatch(p.message, /confiden(t|tly)/);
});

test("referReason: contract_not_validated reads as a coverage gate, not uncertainty or unavailability", () => {
  const p = referReasonPresentation("contract_not_validated");
  assert.equal(p.message, "this provision isn't yet cleared for automatic decisions");
  assert.doesNotMatch(p.message, /confiden(t|tly)/);
  assert.doesNotMatch(p.message, /unavailable/);
});

test("referReason: uncertain_second_judge and second_judge_unavailable read as different situations", () => {
  const uncertainSecond = referReasonPresentation("uncertain_second_judge");
  const unavailable = referReasonPresentation("second_judge_unavailable");
  assert.notEqual(uncertainSecond.message, unavailable.message);
  // A second opinion was actually reached in one case and not at all in the other -- the wording must not
  // collapse that distinction back into one generic "the second check had a problem" sentence.
  assert.doesNotMatch(unavailable.message, /couldn't confirm/);
  assert.doesNotMatch(uncertainSecond.message, /temporarily unavailable/);
});

test("referReason: gate1_unavailable and gate1_not_entailed read as different situations", () => {
  const unavailable = referReasonPresentation("gate1_unavailable");
  const notEntailed = referReasonPresentation("gate1_not_entailed");
  assert.match(unavailable.message, /temporarily unavailable/);
  assert.doesNotMatch(notEntailed.message, /unavailable/);
});

test("referReason: an unknown reason fails closed but still names the reason code, never hidden", () => {
  for (const junk of ["reason_from_the_future", "REFER_ELSEWHERE", "0"]) {
    const p = referReasonPresentation(junk);
    assert.equal(p.reason, null);
    assert.equal(p.unknown, true);
    assert.ok(p.message.includes(junk), `unknown-reason message must name the reason code, got: ${p.message}`);
  }
});

test("referReason: a missing or empty reason fails closed without a code to name, and says so honestly", () => {
  for (const empty of [null, undefined, "", "   "]) {
    const p = referReasonPresentation(empty);
    assert.equal(p.reason, null);
    assert.equal(p.unknown, true);
    assert.doesNotMatch(p.message, /""/, "must not render an empty-string code as if it were a real one");
  }
});

test("referReason: near-miss spellings of a real reason do not silently borrow its message", () => {
  for (const nearMiss of ["Uncertain", "uncertain_second_judgee", "not_validated", "gate1"]) {
    const p = referReasonPresentation(nearMiss);
    assert.equal(p.unknown, true, `"${nearMiss}" must not match a real reason by accident`);
  }
});

test("referReason: whitespace around an otherwise-valid reason is tolerated (same convention as elementStatus)", () => {
  const p = referReasonPresentation("  uncertain  ");
  assert.equal(p.reason, "uncertain");
  assert.equal(p.unknown, false);
});

// The engine's own lists, copied with their source into a checked-in fixture (the app cannot import the engine):
// see the fixture's `_source` for the file, commit and lines. A drift in either direction fails here.
const ENGINE = JSON.parse(readFileSync(join(__dirname, "fixtures", "engineContractReasons.json"), "utf8")) as {
  all: string[];
  refer: string[];
};

test("referReason: the app's REFER reasons equal the engine's REFER reasons, no more and no fewer", () => {
  assert.deepEqual([...REFER_REASONS].sort(), [...ENGINE.refer].sort());
});

test("referReason: every engine REFER reason is a known reason of the engine's own list", () => {
  assert.equal(new Set(ENGINE.all).size, ENGINE.all.length);
  for (const r of ENGINE.refer) assert.ok(ENGINE.all.includes(r), `${r} is not in the engine's reason list`);
});

test("referReason: second_judge_defeater_disagreement is recognised and says what the judges did", () => {
  const p = referReasonPresentation("second_judge_defeater_disagreement");
  assert.equal(p.unknown, false);
  assert.equal(p.reason, "second_judge_defeater_disagreement");
  assert.match(p.message, /first and second judges disagree on whether a fact defeats this claim/);
  assert.match(p.message, /refer it to a lawyer/);
  assert.doesNotMatch(p.message, /not one this app recognises/);
});
