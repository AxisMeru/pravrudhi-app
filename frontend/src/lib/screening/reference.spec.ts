import { strict as assert } from "node:assert";
import test from "node:test";

import type { AnalyseFactsContract, AnalyseFactsElement, AnalyseFactsResult } from "../api";
import { buildMemo } from "../memo";
import { buildRunRecord, buildScreeningMemo } from "./memo";
import { rowsFor } from "./model";
import { OFFENCES, offenceLabel } from "./offences";
import { REFERENCE_WHAT_TO_CHECK, displayElementName, referenceRowLabel } from "./reference";
import contractElements from "../fixtures/contractElements.json";

// Operator 13 Oct (via Lead-2, R1's strings): for the contract shown by its reference only, no engine element wording, rule text or statute line is displayed on screen or in a memo; the run record keeps the engine's text.
const REF = contractElements.contracts.bns69;
const ENGINE_NAMES = [...REF.elements, ...REF.denials];
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null, quote_source: "whole_fact", p_established: 0.5, p_established_second: 0.5, fact_id: "F1" };
const el = (element: string, over: Partial<AnalyseFactsElement> = {}) => ({ ...base, element, status: "established", ...over }) as AnalyseFactsElement;
const contract = (id: string, elements: AnalyseFactsElement[], over: Partial<AnalyseFactsContract> = {}) =>
  ({ contract_id: id, outcome: "ABSTAIN", reason: "missing_element", elements, assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, citations: [], rule_text: "RULE-TEXT-MARKER", rule_text_source: "src", judge_rule_text: "JUDGE-RULE-MARKER", ...over }) as AnalyseFactsContract;
const FACTS = [{ id: "F1", text: "The user's own fact.", sha256: "a".repeat(64) }];
const result = (c: AnalyseFactsContract) => ({ run_id: "r1", judge: "j", score_sha256: "a".repeat(64), provenance: "p", facts: FACTS, contracts: [c] }) as AnalyseFactsResult;
const EXPLICIT = /sexual|intercourse|rape|deceitful|marry|marriage|woman|employment|promotion|RULE-TEXT-MARKER|JUDGE-RULE-MARKER/i;

test("R1's labels: the exact ingredient, defence and what-to-check strings", () => {
  assert.equal(referenceRowLabel("BNS 69", 1, false, 0), "BNS 69 · ingredient 1");
  assert.equal(referenceRowLabel("BNS 69", 2, false, 0), "BNS 69 · ingredient 2");
  assert.equal(referenceRowLabel("BNS 69", 1, true, 1), "BNS 69 · a fact that may defeat the claim");
  assert.equal(referenceRowLabel("BNS 69", 2, true, 3), "BNS 69 · a fact that may defeat the claim 2");
  assert.equal(REFERENCE_WHAT_TO_CHECK, "Check the cited fact against the section.");
  assert.match(referenceRowLabel("BNS 69", 1, false, 0), /^BNS 69 · ingredient 1$/); // U+00B7, single spaces
});

test("the offence is shown as 'BNS 69' alone: the picker row, the heading and the guide list carry no descriptive title", () => {
  const o = OFFENCES.find((x) => x.contracts.includes("bns69"))!;
  assert.equal(o.title, "BNS 69");
  assert.equal(offenceLabel(o), "BNS 69");
  assert.doesNotMatch(JSON.stringify(OFFENCES), /intercourse|deceitful|marry/i);
});

test("for bns69 every row shows its label, the chip and the user's own cited fact, with R1's what-to-check line", () => {
  const c = contract("bns69", [el(REF.elements[0]), el(REF.elements[1], { status: "not_established" }), el(REF.denials[0], { is_denial: true })]);
  const rows = rowsFor(c, FACTS);
  assert.deepEqual(rows.ingredients.map((r) => r.element), ["BNS 69 · ingredient 1", "BNS 69 · ingredient 2"]);
  assert.deepEqual(rows.defences.map((r) => r.element), ["BNS 69 · a fact that may defeat the claim"]);
  for (const r of [...rows.ingredients, ...rows.defences]) assert.equal(r.whatToCheck, REFERENCE_WHAT_TO_CHECK);
  assert.equal(rows.ingredients[0].factText, FACTS[0].text);
  assert.deepEqual(rows.ingredients.map((r) => r.chip), ["supported", "not_supported"]);
});

test("any other contract still shows its own element wording and its own what-to-check line", () => {
  const c = contract("bns85", [el(contractElements.contracts.bns85.elements[0])]);
  const r = rowsFor(c, FACTS).ingredients[0];
  assert.equal(r.element, contractElements.contracts.bns85.elements[0]);
  assert.notEqual(r.whatToCheck, REFERENCE_WHAT_TO_CHECK);
  assert.equal(displayElementName(c, c.elements[0]), null);
});

test("no engine element name or rule text appears in either memo for bns69; the run record keeps the engine's text unchanged", () => {
  const c = contract("bns69", [el(REF.elements[0]), el(REF.elements[1]), el(REF.denials[0], { is_denial: true, status: "established" })]);
  const screening = buildScreeningMemo(result(c), { engineVersion: "0", generatedAt: "t" });
  const matters = buildMemo(result(c), { engineVersion: "0", generatedAt: "t" });
  for (const memo of [screening, matters]) {
    for (const name of ENGINE_NAMES) assert.ok(!memo.includes(name), `the engine's wording is in a memo: ${name.slice(0, 40)}`);
    assert.doesNotMatch(memo, EXPLICIT);
    assert.ok(memo.includes("BNS 69 · ingredient 1"));
  }
  assert.ok(screening.includes(REFERENCE_WHAT_TO_CHECK));
  assert.ok(!matters.includes("Provision text"), "no provision block for a reference-only contract");
  const record = buildRunRecord({ facts: ["x"], contractIds: ["bns69"] }, result(c), { engineVersion: "0", generatedAt: "t" });
  for (const name of ENGINE_NAMES) assert.ok(record.includes(JSON.stringify(name).slice(1, -1)), `the run record lost the engine's text: ${name.slice(0, 40)}`);
});

test("several defence rows are numbered from 1; a contract without a reference never reads as one", () => {
  const c = contract("bns69", [el(REF.elements[0]), el(REF.denials[0], { is_denial: true }), el(REF.denials[0] + " ", { is_denial: true })]);
  assert.deepEqual(rowsFor(c, FACTS).defences.map((r) => r.element), ["BNS 69 · a fact that may defeat the claim 1", "BNS 69 · a fact that may defeat the claim 2"]);
  assert.equal(displayElementName(contract("ipc416", []), el("x")), null);
});

// EXPLICIT is used in the e2e spec as well; keep a copy of the words here so a change shows in both.
test("the explicit-word list reads as intended", () => {
  assert.match("sexual intercourse", EXPLICIT);
  assert.doesNotMatch("BNS 69 · ingredient 1", EXPLICIT);
});
