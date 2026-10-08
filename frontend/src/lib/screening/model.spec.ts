import assert from "node:assert/strict";
import test from "node:test";

import leanOutcome from "../fixtures/leanOutcome.json";
import whatToCheck from "../fixtures/whatToCheck.json";
import contractElements from "../fixtures/contractElements.json";
import type { AnalyseFactsContract, AnalyseFactsElement, AnalyseFactsResult } from "../api";
import { CHIP_LABEL } from "./copy";
import { OFFENCES, offenceOf } from "./offences";
import { LEAN_PASS_OUTCOME, contractReferral, rowsFor, summarize, whatToCheckFor } from "./model";

const FACTS: AnalyseFactsResult["facts"] = [
  { id: "F1", text: "Invented: Ravi told Meena the toy lorry was his and sold it to her.", sha256: "a".repeat(64) },
  { id: "F2", text: "Invented: Meena paid Ravi 500 for the toy lorry on the same day.", sha256: "b".repeat(64) },
];
const CID = "ipc415_property";
const ELS = contractElements.contracts[CID].elements;

const el = (i: number, over: Partial<AnalyseFactsElement> = {}): AnalyseFactsElement =>
  ({
    element: ELS[i], is_denial: false, status: "established", claimed: true, p_established: 0.9, p_established_second: 0.8, fact_id: `F${(i % 2) + 1}`,
    quote: "x", start: null, end: null, quote_check: "ok", attempts: 1, occurrences: 1, offsets_source: null, quote_source: "whole_fact", error: null, ...over,
  }) as AnalyseFactsElement;
const contract = (elements: AnalyseFactsElement[], over: Partial<AnalyseFactsContract> = {}): AnalyseFactsContract =>
  ({ contract_id: CID, outcome: "PROOF", reason: "all_elements_established", elements, assertions: null, lean: null, lean_outcome: "PROOF", uncertain: [], statute_text_mismatch: null, ...over }) as AnalyseFactsContract;

test("data: every element and defence of the 14 contracts has exactly one what-to-check line, and no line is orphaned", () => {
  const keys = new Set(Object.keys(whatToCheck.checks));
  let n = 0;
  for (const [id, c] of Object.entries(contractElements.contracts)) {
    for (const e of [...c.elements, ...c.denials]) {
      assert.ok(keys.delete(`${id}|${e}`), `${id}: no line for "${e}"`);
      n += 1;
    }
  }
  assert.equal(keys.size, 0, `orphans: ${[...keys].join(" | ")}`);
  assert.equal(n, 38);
  for (const t of Object.values(whatToCheck.checks)) assert.match(t, /^Check /);
});

test("data: the offence table covers the 14 validated contracts exactly once, each has its sections on one line", () => {
  const ids = OFFENCES.flatMap((o) => [...o.contracts]);
  assert.deepEqual([...ids].sort(), Object.keys(contractElements.contracts).sort());
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(offenceOf("bns85")?.sections, "BNS 85, 86 · IPC 498A");
  assert.equal(offenceOf("bns69")?.sections, "BNS 69 · no IPC equivalent");
  // the sources the pinned checker lists agree with the pair on each line
  assert.match(contractElements.contracts.ipc405_misappropriation.sources, /Indian Penal Code §405/);
  assert.match(contractElements.contracts.bns85.sources, /Bharatiya Nyaya Sanhita §85/);
});

test("the Lean pass value is pinned to the engine's openapi enum", () => {
  assert.equal(LEAN_PASS_OUTCOME, leanOutcome.lean_pass);
  assert.ok(leanOutcome.lean_outcome_enum.includes(LEAN_PASS_OUTCOME));
  assert.deepEqual([...leanOutcome.lean_outcome_enum].sort(), ["ABSTAIN", "DENIAL", "PROOF", "REFER_TO_LAWYER"]);
});

test("chips read each element status in plain words; only the judges' decision makes a row 'supported'; not_confirmed is a review item, never an error", () => {
  const c = contract([el(0), el(1, { status: "not_established" }), el(2, { status: "not_confirmed" })], { outcome: "ABSTAIN", reason: "missing_element" });
  const { ingredients } = rowsFor(c, FACTS);
  assert.deepEqual(ingredients.map((r) => CHIP_LABEL[r.chip]), ["Supported by a fact", "Not supported by these facts", "Needs your review"]);
  assert.ok(ingredients[2].reason && /did not reach the level we require/.test(ingredients[2].reason));
  for (const r of ingredients) assert.doesNotMatch(`${CHIP_LABEL[r.chip]} ${r.reason ?? ""}`, /proved|establish(ed)? at|verbatim|offence is made out/i);
});

test("an unrecognised status and an 'uncertain' element are review items with a reason", () => {
  const c = contract([el(0, { status: "something_new" as never }), el(1)], { uncertain: [ELS[1]] });
  const { ingredients } = rowsFor(c, FACTS);
  assert.equal(ingredients[0].chip, "review");
  assert.ok(ingredients[0].reason);
  assert.equal(ingredients[1].chip, "review");
  assert.match(ingredients[1].reason ?? "", /not sure/i);
});

test("the screening signal makes a not-established row 'supported', marked as suggested, only when the engine sends it", () => {
  const withSignal = el(1, { status: "not_established", screening_signal: { p: 0.8, supported: true } });
  const without = el(1, { status: "not_established" });
  const rows = rowsFor(contract([el(0), withSignal, el(2, { status: "not_established", screening_signal: { p: 0.2, supported: false } })]), FACTS).ingredients;
  assert.deepEqual(rows.map((r) => [r.chip, r.suggested]), [["supported", false], ["supported", true], ["not_supported", false]]);
  assert.equal(rowsFor(contract([without]), FACTS).ingredients[0].chip, "not_supported");
});

test("a whole-fact citation shows the cited fact in full and no quote; a model quote carries its quote-check sentence", () => {
  const whole = rowsFor(contract([el(0)]), FACTS).ingredients[0];
  assert.equal(whole.factId, "F1");
  assert.equal(whole.factText, FACTS[0].text);
  assert.equal(whole.quote, null);
  assert.match(whole.note ?? "", /cites your fact F1 in full/);
  const model = rowsFor(contract([el(1, { quote_source: "model", quote: "words the frontier quoted", citation_note: "ENGINE SENTENCE" })]), FACTS).ingredients[0];
  assert.equal(model.quote?.text, "words the frontier quoted");
  assert.match(model.quote?.check ?? "", /exactly once/);
  assert.equal(model.note, "ENGINE SENTENCE");
  assert.equal(model.factText, null);
  // an older engine: no quote_source on an established element: neutral, no quote
  const older = rowsFor(contract([el(0, { quote_source: null })]), FACTS).ingredients[0];
  assert.equal(older.quote, null);
  assert.equal(older.note, "cites the supporting fact");
  assert.equal(older.factText, FACTS[0].text);
});

test("what-to-check comes from the contract's own element; an element this build does not know has none (and does not break the row)", () => {
  assert.match(whatToCheckFor(CID, ELS[0]) ?? "", /^Check what the facts say was said or concealed/);
  assert.equal(whatToCheckFor(CID, "an element the engine renamed"), null);
  assert.equal(rowsFor(contract([el(0, { element: "an element the engine renamed" })]), FACTS).ingredients[0].whatToCheck, null);
});

test("the banner: N of M and K, and the all-supported line only when every condition holds", () => {
  const good = contract([el(0), el(1), el(2)]);
  const s = summarize(good, rowsFor(good, FACTS));
  assert.equal(s.text, "All ingredients supported (structure checked)");
  const partial = contract([el(0), el(1, { status: "not_established" }), el(2, { status: "not_confirmed" })], { outcome: "ABSTAIN" });
  assert.equal(summarize(partial, rowsFor(partial, FACTS)).text, "1 of 3 ingredients have a supporting fact; 1 need your review.");
  const planted: [string, AnalyseFactsContract][] = [
    ["Lean does not pass", contract([el(0), el(1), el(2)], { lean_outcome: "ABSTAIN" })],
    ["no Lean result", contract([el(0), el(1), el(2)], { lean_outcome: null })],
    ["the engine did not say PROOF", contract([el(0), el(1), el(2)], { outcome: "ABSTAIN" })],
    ["the second judge did not answer on one ingredient", contract([el(0), el(1, { p_established_second: null }), el(2)])],
    ["a referral", contract([el(0), el(1), el(2)], { outcome: "REFER_TO_LAWYER", reason: "contract_not_validated" })],
    ["a defence was found", contract([el(0), el(1), el(2), el(0, { is_denial: true, element: "a defence" })])],
    ["one ingredient only suggested", contract([el(0), el(1), el(2, { status: "not_established", screening_signal: { p: 0.9, supported: true } })], { outcome: "ABSTAIN" })],
  ];
  for (const [why, c] of planted) assert.notEqual(summarize(c, rowsFor(c, FACTS)).text, "All ingredients supported (structure checked)", why);
  assert.equal(summarize(contract([]), rowsFor(contract([]), FACTS)).allSupported, false);
});

test("a found defence is a review item, an unfound one is not shown; a referral carries the signed reason sentence", () => {
  const d = contract([el(0), el(1, { is_denial: true, status: "established", element: "a defence" }), el(2, { is_denial: true, status: "not_established", element: "another" })]);
  const rows = rowsFor(d, FACTS);
  assert.equal(rows.ingredients.length, 1);
  assert.deepEqual(rows.defences.map((r) => [r.element, r.chip]), [["a defence", "review"]]);
  assert.equal(summarize(d, rows).review, 1);
  const ref = contractReferral(contract([el(0)], { outcome: "REFER_TO_LAWYER", reason: "contract_not_validated" }));
  assert.match(ref?.message ?? "", /not on the validated list/);
  assert.equal(contractReferral(contract([el(0)])), null);
});
