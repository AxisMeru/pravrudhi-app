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

test("referReason: uncertain_second_judge and second_judge_unavailable read as different situations", () => {
  const uncertainSecond = referReasonPresentation("uncertain_second_judge");
  const unavailable = referReasonPresentation("second_judge_unavailable");
  assert.notEqual(uncertainSecond.message, unavailable.message);
  // A second opinion was actually reached in one case and not at all in the other -- the wording must not
  // collapse that distinction back into one generic "the second check had a problem" sentence.
  assert.doesNotMatch(unavailable.message, /couldn't confirm/);
  assert.doesNotMatch(uncertainSecond.message, /temporarily unavailable/);
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


test("referReason: second_judge_defeater_disagreement is recognised (the ninth reason), not 'not one this app recognises'", () => {
  const p = referReasonPresentation("second_judge_defeater_disagreement");
  assert.equal(p.unknown, false);
  assert.equal(p.reason, "second_judge_defeater_disagreement");
  assert.equal(p.twoJudgesOnly, true);
  assert.doesNotMatch(p.message, /not one this app recognises/);
});

test("referReason: a reason the signed table marks 'two judges only' says so beside the sentence, not inside it", () => {
  for (const r of ["second_judge_defeater_disagreement", "uncertain_second_judge", "second_judge_unavailable"]) {
    const p = referReasonPresentation(r);
    assert.equal(p.twoJudgesOnly, true, r);
    assert.doesNotMatch(p.message, /deployments that use two judges/i, r);
  }
  for (const r of ["uncertain", "denial_unquotable", "gate1_unavailable", "gate1_not_entailed", "gate1_contradiction", "contract_not_validated"]) {
    assert.equal(referReasonPresentation(r).twoJudgesOnly, false, r);
  }
});
