import { strict as assert } from "node:assert";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { AnalyseFactsContract } from "@/lib/api";
import contractElements from "@/lib/fixtures/contractElements.json";
import { blockTitle, offenceOf } from "@/lib/screening/offences";
import { IngredientChecklist } from "./IngredientChecklist";

// #206 R8 and R9 (explorer's result review, 15 Oct): no empty list is announced, and a block title that already ends in its sections is not followed by the same sections again.
const els = (id: string): string[] => (contractElements.contracts as Record<string, { elements: string[] }>)[id]?.elements ?? ["an ingredient"];
const contract = (id: string, status: (i: number) => string): AnalyseFactsContract =>
  ({ contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, citations: [],
    elements: els(id).map((e, i) => ({ element: e, is_denial: false, status: status(i), claimed: true, p_established: 0.5, fact_id: null, quote: null })) }) as unknown as AnalyseFactsContract;
const html = (c: AnalyseFactsContract): string => renderToStaticMarkup(createElement(IngredientChecklist, { contract: c, facts: [] }));
const empties = (h: string): number => (h.match(/<ul[^>]*>\s*<\/ul>/g) ?? []).length;

test("R8: a block whose ingredients are all in the 'no fact' group does not render an empty Ingredients list", () => {
  const h = html(contract("ipc415_property", () => "not_established"));
  assert.doesNotMatch(h, /<ul[^>]*aria-label="Ingredients"/);
  assert.match(h, /data-testid="no-fact-group"/);
  assert.equal(empties(h), 0);
});

test("R8: a block with no ingredient rows (a referral) renders no list at all", () => {
  const c = contract("ni138", () => "established");
  (c as unknown as { elements: unknown[] }).elements = [];
  assert.doesNotMatch(html(c), /<ul/);
});

test("R8: a block with supported or review rows keeps its Ingredients list, with every such row in it", () => {
  const h = html(contract("ipc415_property", (i) => (i === 0 ? "established" : "not_established")));
  assert.match(h, /<ul[^>]*aria-label="Ingredients"/);
  assert.equal((h.match(/data-chip="supported"/g) ?? []).length, 1);
});

test("R8: a block whose rows are all 'needs review' keeps its Ingredients list", () => {
  const h = html(contract("ipc415_property", () => "not_confirmed"));
  assert.match(h, /<ul[^>]*aria-label="Ingredients"/);
  assert.equal((h.match(/data-chip="review"/g) ?? []).length, els("ipc415_property").length);
});

test("R9: a way's title already ends in its sections, so the sections are not repeated on the next line", () => {
  for (const id of ["ipc415_property", "ipc405_misappropriation", "bns46_conspiracy", "ipc182_abuse_of_power"]) {
    const off = offenceOf(id)!;
    assert.ok(blockTitle(id).includes(off.sections), `${id}: the title carries the sections`);
    const h = html(contract(id, () => "established"));
    assert.ok(!h.includes(`>${off.sections}<`), `${id}: no line of its own repeats the sections`);
    assert.ok(h.includes(`${off.sections}`), `${id}: the sections stay in the title`);
  }
});

test("R9 (R1, #310 F1: one label rule): a single-way offence's heading carries its sections ('<title> \u00b7 <sections>'), so there is no second sections line under it; one with no sections shows no empty line", () => {
  const personation = html(contract("ipc416", () => "established"));
  assert.ok(personation.includes(`>Cheating by personation \u00b7 ${offenceOf("ipc416")!.sections}<`), "the heading is the offence label");
  assert.ok(!personation.includes('data-testid="offence-sections"'), "the sections are not repeated on a line of their own");
  const bns69 = html(contract("bns69", () => "established"));
  assert.doesNotMatch(bns69, /<p class="[^"]*">\s*<\/p>/);
});
