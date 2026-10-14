import assert from "node:assert/strict";
import test from "node:test";

import leanOutcome from "../fixtures/leanOutcome.json";
import whatToCheck from "../fixtures/whatToCheck.json";
import contractElements from "../fixtures/contractElements.json";
import type { AnalyseFactsContract, AnalyseFactsElement, AnalyseFactsResult } from "../api";
import { CHIP_LABEL, DEFENCE_PROMPT_NOTE, STRUCTURE_NOTE, ipcDisclosure } from "./copy";
import { buildScreeningMemo } from "./memo";
import { OFFENCES, offenceOf } from "./offences";
import { bannerText } from "./copy";
import { referenceOf } from "./reference";
import { LEAN_PASS_OUTCOME, contractReferral, defenceShown, rowsFor, summarize, whatToCheckFor } from "./model";

const FACTS: AnalyseFactsResult["facts"] = [
  { id: "F1", text: "Invented: Ravi told Meena the toy lorry was his and sold it to her.", sha256: "a".repeat(64) },
  { id: "F2", text: "Invented: Meena paid Ravi 500 for the toy lorry on the same day.", sha256: "b".repeat(64) },
];
const CID = "ipc415_property";
const ELS = contractElements.contracts[CID].elements;

const ofN = (n: number, m: number) => `${n} of ${m} ingredients supported by a fact`;
const el = (i: number, over: Partial<AnalyseFactsElement> = {}): AnalyseFactsElement =>
  ({
    element: ELS[i], is_denial: false, status: "established", claimed: true, p_established: 0.9, p_established_second: 0.8, fact_id: `F${(i % 2) + 1}`,
    quote: "x", start: null, end: null, quote_check: "ok", attempts: 1, occurrences: 1, offsets_source: null, quote_source: "whole_fact", error: null, ...over,
  }) as AnalyseFactsElement;
const contract = (elements: AnalyseFactsElement[], over: Partial<AnalyseFactsContract> = {}): AnalyseFactsContract =>
  ({ contract_id: CID, outcome: "PROOF", reason: "all_elements_established", elements, assertions: null, lean: null, lean_outcome: "PROOF", uncertain: [], statute_text_mismatch: null, ...over }) as AnalyseFactsContract;

test("data: every element and defence of the 18 contracts has exactly one what-to-check line, and no line is orphaned", () => {
  const keys = new Set(Object.keys(whatToCheck.checks));
  let n = 0;
  for (const [id, c] of Object.entries(contractElements.contracts)) {
    if (referenceOf(id)) continue; // a reference-only contract shows no engine wording and has no what-to-check lines of its own (reference.ts)
    for (const e of [...c.elements, ...c.denials]) {
      assert.ok(keys.delete(`${id}|${e}`), `${id}: no line for "${e}"`);
      n += 1;
    }
  }
  assert.equal(keys.size, 0, `orphans: ${[...keys].join(" | ")}`);
  assert.equal(n, 49);
  for (const t of Object.values(whatToCheck.checks)) assert.match(t, /^Check /);
});

test("data: the offence table covers the 14 validated contracts and ni138 exactly once; the three bns316 contracts are not offered as a second row (#128 D7: one row per offence); only the last offence is flagged not validated, each has its sections on one line", () => {
  const ids = OFFENCES.flatMap((o) => [...o.contracts]);
  assert.deepEqual([...ids].sort(), Object.keys(contractElements.contracts).filter((id) => !id.startsWith("bns316_")).sort());
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(OFFENCES.filter((o) => o.notValidated).map((o) => o.id), ["dishonoured-cheque"]);
  assert.match(contractElements.contracts.ni138.sources, /Negotiable Instruments Act §138/);
  assert.match(contractElements.contracts.bns316_misappropriation.sources, /Bharatiya Nyaya Sanhita §316/);
  assert.equal(offenceOf("bns85")?.sections, "BNS 85, 86 · IPC 498A");
  assert.equal(offenceOf("bns69")?.title, "BNS 69");
  assert.equal(offenceOf("bns69")?.sections, "");
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
  assert.deepEqual(ingredients.map((r) => CHIP_LABEL[r.chip]), ["Supported by a fact", "No fact cited", "Needs your review"]);
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

test("the screening signal gives a not-established row its OWN chip (suggested, not supported), only when the engine sends it", () => {
  const withSignal = el(1, { status: "not_established", screening_signal: { p: 0.8, supported: true } });
  const without = el(1, { status: "not_established" });
  const rows = rowsFor(contract([el(0), withSignal, el(2, { status: "not_established", screening_signal: { p: 0.2, supported: false } })]), FACTS).ingredients;
  assert.deepEqual(rows.map((r) => [r.chip, r.suggested]), [["supported", false], ["suggested", true], ["not_supported", false]]);
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
  assert.equal(summarize(partial, rowsFor(partial, FACTS)).text, `${ofN(1, 3)} · 1 to look for · 1 for your review`);
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
  assert.equal(summarize(d, rows).defences, 1);
  assert.equal(summarize(d, rows).review, 0, "a defence row is counted as a defence, not as a review row");
  const ref = contractReferral(contract([el(0)], { outcome: "REFER_TO_LAWYER", reason: "contract_not_validated" }));
  assert.match(ref?.message ?? "", /not on our validated list/);
  assert.equal(contractReferral(contract([el(0)])), null);
});

test("R1 (8 Oct): the IPC-text disclosure is on exactly the four IPC-family offences, with their own IPC section; the BNS-native ones have none", () => {
  const disclosed = Object.fromEntries(OFFENCES.map((o) => [o.id, o.ipcChecked]));
  assert.deepEqual(disclosed, {
    "breach-of-trust": "405", cheating: "415", "cheating-personation": "416", "false-information": "182",
    "bns-69": null, cruelty: null, abetment: null, "abetment-outside-india": null,
    "dishonoured-cheque": null,
  });
  assert.equal(ipcDisclosure("405"), "Checked against the IPC text (s.405); the BNS counterpart is not validated.");
});

test("R1 (8 Oct): the memo never shows the banner sentence without the standing line directly under it, and says 'may' for a defeater", () => {
  const c = contract([el(0), el(1, { status: "not_established" }), el(2, { status: "not_confirmed" }), el(0, { is_denial: true, element: "a defence", status: "established" })], { outcome: "ABSTAIN" });
  const memo = buildScreeningMemo({ run_id: "r1", judge: "j", score_sha256: "a".repeat(64), provenance: "p", facts: FACTS, contracts: [c] } as AnalyseFactsResult, { engineVersion: "0", generatedAt: "t" });
  const lines = memo.split("\n");
  const i = lines.findIndex((l) => /ingredients supported by a fact/.test(l));
  assert.ok(i > 0);
  assert.equal(lines[i + 1], "This is a screening aid, not legal advice. A lawyer decides.");
  assert.match(memo, /### A fact that may defeat the claim/);
  assert.match(memo, /Checked against the IPC text \(s\.415\); the BNS counterpart is not validated\./);
  // a defeater row is not an ingredient: the total stays 3, and the defence row is counted apart
  assert.ok(memo.includes(`${ofN(1, 3)} · 1 to look for · 1 for your review · 1 fact that may defeat the claim`));
});

test("R1 (8 Oct): a suggestion is not a cited fact: its own chip text, not in N, in K; the structure note appears with the all-supported line only", () => {
  assert.equal(CHIP_LABEL.suggested, "Suggested by the screening judge; check it");
  const c = contract([el(0), el(1, { status: "not_established", screening_signal: { p: 0.9, supported: true } }), el(2, { status: "not_established" })], { outcome: "ABSTAIN" });
  const s = summarize(c, rowsFor(c, FACTS));
  assert.equal(s.text, `${ofN(1, 3)} · 1 to look for · 1 to check`);
  assert.equal(s.supported, 1);
  assert.equal(STRUCTURE_NOTE, "A Lean check confirmed the right ingredients were addressed; it does not read your facts.");
  const good = contract([el(0), el(1), el(2)]);
  const gm = buildScreeningMemo({ run_id: "r1", judge: "j", score_sha256: "a".repeat(64), provenance: "p", facts: FACTS, contracts: [good] } as AnalyseFactsResult, { engineVersion: "0", generatedAt: "t" });
  assert.match(gm, /\*\*All ingredients supported \(structure checked\)\*\*\nThis is a screening aid, not legal advice\. A lawyer decides\.\nA Lean check confirmed/);
  const pm = buildScreeningMemo({ run_id: "r1", judge: "j", score_sha256: "a".repeat(64), provenance: "p", facts: FACTS, contracts: [c] } as AnalyseFactsResult, { engineVersion: "0", generatedAt: "t" });
  assert.doesNotMatch(pm, /A Lean check confirmed/);
});

test("R2 (8 Oct): the quote-check sentence is looked up by the table's OWN keys only (a prototype key finds nothing)", () => {
  for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty", "ok-but-not-a-key"]) {
    const row = rowsFor(contract([el(0, { quote_source: "model", quote: "q", quote_check: key })]), FACTS).ingredients[0];
    assert.equal(row.quote?.check, null, key);
  }
  assert.match(rowsFor(contract([el(0, { quote_source: "model", quote: "q", quote_check: "ok" })]), FACTS).ingredients[0].quote?.check ?? "", /exactly once/);
});

test("a cited fact whose text could not be paired shows no fact block text (never an empty 'Cited fact' line)", () => {
  const c = { contract_id: "bns69", outcome: "ABSTAIN", reason: "missing_element", elements: [{ element: "e", is_denial: false, status: "established", claimed: true, fact_id: "F1", quote_source: "whole_fact", quote: null }], lean: null, lean_outcome: null, uncertain: [], assertions: null, statute_text_mismatch: null } as never;
  const row = rowsFor(c, [{ id: "F1", text: "", sha256: "a".repeat(64) }]).ingredients[0];
  assert.equal(row.factText, null);
});

test("R1 (#283, 13 Oct): the defence line is one exact constant with no digits, and the memo has it under the defence heading only when a defence is shown", () => {
  assert.equal(
    DEFENCE_PROMPT_NOTE,
    "Facts that may defeat the claim are shown as prompts for your review, not as findings.",
  );
  assert.doesNotMatch(DEFENCE_PROMPT_NOTE, /\d/);
  const mk = (c: AnalyseFactsContract) => buildScreeningMemo({ run_id: "r1", judge: "j", score_sha256: "a".repeat(64), provenance: "p", facts: FACTS, contracts: [c] } as AnalyseFactsResult, { engineVersion: "0", generatedAt: "t" });
  const withDefence = mk(contract([el(0), el(1), el(2), el(0, { is_denial: true, element: "a defence", status: "established" })], { outcome: "DENIAL" })).split("\n");
  const h = withDefence.findIndex((l) => l === "### A fact that may defeat the claim");
  assert.ok(h > 0);
  assert.equal(withDefence[h + 2], DEFENCE_PROMPT_NOTE);
  assert.equal(withDefence.filter((l) => l === DEFENCE_PROMPT_NOTE).length, 1);
  assert.ok(!mk(contract([el(0), el(1), el(2)])).includes(DEFENCE_PROMPT_NOTE), "no defence row, no line");
});

test("R2 (13 Oct): defenceShown follows the checklist exactly: a suggested or an uncertain defence counts, a plain not-established one does not", () => {
  const d = (over: Partial<AnalyseFactsElement>) => el(0, { is_denial: true, element: "a defence", ...over });
  assert.equal(defenceShown(contract([el(0), d({ status: "not_established" })], { outcome: "ABSTAIN" })), false, "plain not established");
  assert.equal(defenceShown(contract([el(0), d({ status: "not_established", screening_signal: { p: 0.9, supported: true } })], { outcome: "ABSTAIN" })), true, "suggested by the screening signal");
  assert.equal(defenceShown(contract([el(0), d({ status: "not_established" })], { outcome: "ABSTAIN", uncertain: ["a defence"] })), true, "uncertain");
  assert.equal(defenceShown(contract([el(0), d({ status: "not_confirmed" })], { outcome: "REFER_TO_LAWYER" })), true, "not confirmed");
  assert.equal(defenceShown(contract([el(0)], { outcome: "DENIAL" })), true, "a DENIAL outcome");
  assert.equal(defenceShown(contract([el(0)], { outcome: "PROOF" })), false);
  // the same answer the checklist rows give
  for (const c of [contract([el(0), d({ status: "not_established" })]), contract([el(0), d({ status: "not_established", screening_signal: { p: 0.9, supported: true } })])]) {
    assert.equal(defenceShown(c), rowsFor(c, FACTS).defences.length > 0);
  }
});

test("R1 (13 Oct, #115): the summary names every state in the row vocabulary, in order, only when the count is not 0; the states add up to the total", () => {
  assert.equal(bannerText(0, 3, 2, 0, 1, 0), "No ingredient has a cited fact yet · 3 to look for");
  assert.equal(bannerText(3, 3, 0, 0, 0, 0), `${ofN(3, 3)}`);
  assert.equal(bannerText(1, 4, 1, 1, 1, 1), `${ofN(1, 4)} · 1 to look for · 1 to check · 1 for your review · 1 fact that may defeat the claim`);
  assert.equal(bannerText(0, 4, 0, 2, 2, 3), "No ingredient has a cited fact yet · 4 to look for · 3 facts that may defeat the claim");
  assert.doesNotMatch(bannerText(2, 3, 1, 0, 0, 0), /established|proved|made out/i);
  const defence = (over: Partial<AnalyseFactsElement> = {}) => el(0, { is_denial: true, element: "a defence", status: "established", ...over });
  const cases: AnalyseFactsContract[] = [
    contract([el(0), el(1, { status: "not_established", screening_signal: { p: 0.9, supported: true } }), el(2, { status: "not_established" })], { outcome: "ABSTAIN" }),
    contract([el(0), el(1, { status: "not_confirmed" }), el(2, { status: "not_established" }), defence()], { outcome: "ABSTAIN" }),
    contract([el(0), el(1, { status: "not_established" }), el(2, { status: "something_new" as never })], { outcome: "ABSTAIN", uncertain: [ELS[1]] }),
    contract([el(0), el(1), el(2)]),
  ];
  for (const c of cases) {
    const s = summarize(c, rowsFor(c, FACTS));
    assert.equal(s.supported + s.suggested + s.review + s.notSupported, s.total, s.text);
  }
});

// R1, 14 Oct: a known referral reason shows only the mapped sentence on the screening result; an unknown one keeps its code, labelled.
test("contractReferral: the code is shown only for a reason this build does not know", () => {
  const known = contractReferral(contract([el(0)], { outcome: "REFER_TO_LAWYER", reason: "uncertain" }));
  assert.equal(known?.unknown, false);
  const unknown = contractReferral(contract([el(0)], { outcome: "REFER_TO_LAWYER", reason: "a_reason_from_a_newer_engine" }));
  assert.equal(unknown?.unknown, true);
  assert.equal(unknown?.code, "a_reason_from_a_newer_engine");
});
