import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyseFactsContract, AnalyseFactsResult } from "../api";
import contractElements from "../fixtures/contractElements.json";
import { EXAMPLES } from "../demo/example";
import { NO_CHECK_NOTE } from "./copy";
import { HEARING_PREP_STRINGS, buildHearingPrep } from "./hearingPrep";
import { memoBlockHeading } from "./memo";
import { whatToCheckFor } from "./model";

// The two public examples' facts are the app's real example texts. The RESULTS below are shape fixtures built from the contract sources in
// fixtures/contractElements.json (the real element names): which element is supported is chosen per test, it is not a recorded run.
const EX = Object.fromEntries(EXAMPLES.map((e) => [e.id, e]));
const els = (id: string): string[] => (contractElements.contracts as Record<string, { elements: string[] }>)[id].elements;

function contract(id: string, supported: (i: number) => string, citations: AnalyseFactsContract["citations"] = []): AnalyseFactsContract {
  return {
    contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    citations,
    elements: els(id).map((e, i) => ({ element: e, is_denial: false, status: supported(i), claimed: true, p_established: 0.5, fact_id: null, quote: null })),
  } as unknown as AnalyseFactsContract;
}
const result = (facts: readonly string[], contracts: AnalyseFactsContract[]): AnalyseFactsResult =>
  ({ run_id: "shape-fixture", judge: "fixture", score_sha256: "a".repeat(64), provenance: "fixture", facts: facts.map((t, i) => ({ id: `F${i + 1}`, text: t, sha256: "b".repeat(64) })), contracts }) as unknown as AnalyseFactsResult;

const PROV405 = [{ act: "Indian Penal Code", section: "405", corpus_id: "x", in_corpus: true, title: "Of criminal breach of trust" }];
const PROV415 = [{ act: "Indian Penal Code", section: "415", corpus_id: "y", in_corpus: true, title: "Cheating" }];
const MADRAS_IDS = ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers", "ipc415_property", "ipc415_damaging_act"];
const TOKENS = /REFER_TO_LAWYER|\bipc\d+_|\bbns\d+_|\bni\d+|reason code|second_judge_not_confirmed|missing_element|not_established|not_confirmed|\bnot_evaluated/i;

// ---- the Madras public example: five blocks (three ways of breach of trust, two of cheating) ----
const madras = result(EX["madras-public-order-2024"].facts, MADRAS_IDS.map((id, k) => contract(id, (i) => (k === 0 && i === 0 ? "established" : i % 2 ? "not_established" : "not_confirmed"), id.startsWith("ipc405") ? PROV405 : PROV415)));

test("Madras (5 blocks): block titles and alternate-way flags are the screen's; an ingredient is open unless established; its text is its own What to check", () => {
  const p = buildHearingPrep(madras);
  assert.equal(p.blocks.length, 5);
  assert.deepEqual(p.blocks.map((b) => b.title), MADRAS_IDS.map(memoBlockHeading));
  assert.deepEqual(p.blocks.map((b) => b.alternateWay), [false, true, true, false, true]);
  assert.deepEqual(p.blocks.map((b) => b.index), [1, 2, 3, 4, 5]);
  assert.equal(p.blocks[0].open.length, els(MADRAS_IDS[0]).length - 1, "the one established ingredient is not listed");
  assert.ok(!p.blocks[0].open.some((o) => o.ingredient === els(MADRAS_IDS[0])[0]));
  MADRAS_IDS.forEach((id, k) => {
    for (const o of p.blocks[k].open) {
      const own = whatToCheckFor(id, els(id).find((e) => e === o.ingredient) ?? "");
      assert.equal(o.whatToCheck, own ?? NO_CHECK_NOTE, `${id}: ${o.ingredient}`);
    }
  });
  assert.equal(p.nothingOpen, false);
});

test("Madras: citations are the contracts' provisions, deduplicated, with their source; nothing is invented", () => {
  const p = buildHearingPrep(madras);
  assert.deepEqual(p.citations, [
    { text: "Indian Penal Code, section 405", source: "screening" },
    { text: "Indian Penal Code, section 415", source: "screening" },
  ]);
});

// ---- the Karnataka public example: two blocks (the two ways of cheating) ----
const karnataka = result(EX["karnataka-cheating-2025"].facts, ["ipc415_property", "ipc415_damaging_act"].map((id) => contract(id, (i) => (i === 0 ? "established" : "not_confirmed"), PROV415)));

test("Karnataka (2 blocks): two titles, the second flagged as an alternate way, each lists its open ingredients", () => {
  const p = buildHearingPrep(karnataka);
  assert.equal(p.blocks.length, 2);
  assert.deepEqual(p.blocks.map((b) => b.alternateWay), [false, true]);
  assert.equal(p.blocks[0].open.length, els("ipc415_property").length - 1);
  assert.equal(p.blocks[1].open.length, els("ipc415_damaging_act").length - 1);
  assert.deepEqual(p.citations, [{ text: "Indian Penal Code, section 415", source: "screening" }]);
});

test("all supported: no open ingredient in any block, nothingOpen is true, the blocks and citations are still listed", () => {
  const all = result(EX["karnataka-cheating-2025"].facts, [contract("ipc415_property", () => "established", PROV415)]);
  const p = buildHearingPrep(all);
  assert.equal(p.nothingOpen, true);
  assert.deepEqual(p.blocks.map((b) => b.open), [[]]);
  assert.equal(p.citations.length, 1);
});

test("an unknown contract: the neutral title 'Offence', never its id; ingredients with no What to check get the screen's own sentence", () => {
  const unk = result(["A fact."], [{ ...contract("ipc415_property", () => "not_established"), contract_id: "ipc999_future_offence", elements: [{ element: "an element the app does not know", is_denial: false, status: "not_established", claimed: true, p_established: 0.1, fact_id: null, quote: null }] } as unknown as AnalyseFactsContract]);
  const p = buildHearingPrep(unk);
  assert.equal(p.blocks[0].title, "Offence");
  assert.equal(p.blocks[0].alternateWay, false);
  assert.deepEqual(p.blocks[0].open, [{ ingredient: "an element the app does not know", whatToCheck: NO_CHECK_NOTE }]);
  assert.ok(!JSON.stringify(p).includes("ipc999"));
});

test("open means not supported by the judges: suggested, needs-review, not-supported, not-evaluated and an unknown status are all open; an established one and a fact that may defeat the claim are not listed", () => {
  const c = contract("ipc415_property", () => "established", PROV415);
  const e = c.elements as unknown as Record<string, unknown>[];
  e[0].status = "not_established";
  e[1].status = "something_a_newer_engine_sends";
  e[2] = { ...e[2], status: "not_established", screening_signal: { p: 0.9, supported: true } }; // suggested by the signal, still not supported by the judges
  e.push({ element: "good faith", is_denial: true, status: "established", claimed: true, p_established: 0.9, fact_id: null, quote: null });
  const d = contract("ipc415_damaging_act", (i) => (i === 0 ? "not_evaluated_second_unavailable" : i === 1 ? "established" : "not_confirmed"), PROV415);
  const p = buildHearingPrep(result(["A fact."], [c, d]));
  assert.deepEqual(p.blocks[0].open.map((o) => o.ingredient), els("ipc415_property"));
  assert.ok(!p.blocks[0].open.some((o) => o.ingredient === "good faith"));
  assert.deepEqual(p.blocks[1].open.map((o) => o.ingredient), [els("ipc415_damaging_act")[0], els("ipc415_damaging_act")[2]]);
});

test("intake citations follow the screening's provisions, in order, deduplicated (case and spacing ignored); an empty or malformed entry is skipped", () => {
  const p = buildHearingPrep(karnataka, [{ text: "(1977) 3 SCC 247" }, { text: "  (1977)   3 scc 247 " }, { text: "" }, { text: "Indian Penal Code, Section 415" }, null as unknown as { text: string }]);
  assert.deepEqual(p.citations, [
    { text: "Indian Penal Code, section 415", source: "screening" },
    { text: "(1977) 3 SCC 247", source: "intake" },
  ]);
  assert.deepEqual(buildHearingPrep(result(["A fact."], [])).citations, []);
});

test("deterministic and pure: the same result gives the same output, and the input is not changed", () => {
  const frozen = JSON.stringify(madras);
  const a = JSON.stringify(buildHearingPrep(madras));
  assert.equal(a, JSON.stringify(buildHearingPrep(JSON.parse(frozen))));
  assert.equal(JSON.stringify(madras), frozen);
});

test("a malformed contract (no elements, no citations, null citations) does not throw", () => {
  const bad = result(["A fact."], [{ contract_id: "ipc415_property" } as unknown as AnalyseFactsContract, { contract_id: "ipc415_damaging_act", elements: [], citations: null } as unknown as AnalyseFactsContract]);
  const p = buildHearingPrep(bad);
  assert.equal(p.blocks.length, 2);
  assert.deepEqual(p.blocks.map((b) => b.open), [[], []]);
  assert.equal(buildHearingPrep({ ...bad, contracts: undefined } as unknown as AnalyseFactsResult).blocks.length, 0);
});

// R1 (15 Oct, #204): no internal token reaches a user-visible text. The output carries no contract id by design; this scans every string in it, and the module's own words.
test("no internal token in any output string or in the module's own words: no contract id, reason code, engine status or REFER_TO_LAWYER", () => {
  const many = result(["A fact."], [...MADRAS_IDS, "ni138", "bns69", "bns85", "ipc999_future_offence"].map((id) => ({ ...contract("ipc415_property", () => "not_confirmed", PROV415), contract_id: id, outcome: "REFER_TO_LAWYER", reason: "second_judge_not_confirmed" }) as unknown as AnalyseFactsContract));
  for (const p of [buildHearingPrep(madras), buildHearingPrep(karnataka), buildHearingPrep(many, [{ text: "(2001) 4 SCC 1" }])]) {
    const strings: string[] = [];
    (function walk(v: unknown): void { if (typeof v === "string") strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); })(p);
    for (const s of strings) assert.doesNotMatch(s, TOKENS, s);
  }
  for (const s of Object.values(HEARING_PREP_STRINGS)) assert.doesNotMatch(s, TOKENS, s);
});

// The words this module owns, pinned exactly so R1 signs them at the head (PROPOSED wording).
test("the module's own words are pinned", () => {
  assert.deepEqual({ ...HEARING_PREP_STRINGS }, {
    heading: "Hearing preparation",
    openHeading: "Ingredients still open",
    noneOpen: "Every ingredient in this block is supported by a fact the screening found.",
    citationsHeading: "Citations to check",
    noCitations: "The screening and intake found no citations to check.",
    citationFromScreening: "Provision the screening applied",
    citationFromIntake: "Found in the text you pasted",
    allSupportedNote: "Nothing is open in any block. This checklist is a screening aid: read the supported facts yourself before you rely on them.",
    checkLabel: "What to check",
    standingLine: "This is a screening aid, not legal advice. A lawyer decides.",
  });
});
