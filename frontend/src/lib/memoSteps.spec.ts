import assert from "node:assert/strict";
import test from "node:test";

import mammoth from "mammoth";

import type { AnalyseFactsResult } from "./api";
import { parseAppendix } from "./assistantRun";
import contractElements from "./fixtures/contractElements.json";
import { buildScreeningMemo, buildScreeningMemoDocx, buildRunRecord } from "./screening/memo";

// #169 (Lead-2, R1 14 Oct): the memo carries the steps of an assisted run, as on the screen. R1's rules: heading "Steps of this screening"; one line per appendix step in the engine's order = the signed
// STEP_LABELS label, then ": " and the signed check wording only for a step that carries a check; no counts, no per_contract lines, no refused_calls, no version, no invented step; absent or malformed = nothing.
const CID = "ipc415_property";
const ELS = contractElements.contracts[CID].elements;
const FACT = "Invented: a seller said a plot was his own and sold it for a sum paid in cash.";
const el = (i: number) => ({ element: ELS[i], is_denial: false, status: "established", claimed: true, p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote: null, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote_check: null, binding_leg: null, quote_source: "whole_fact", screening_signal: null, citation_note: null });
const BASE = {
  run_id: "r-invented-steps", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented",
  facts: [{ id: "F1", text: FACT, sha256: "b".repeat(64) }],
  contracts: [{ contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", elements: [el(0), el(1), el(2)], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null }],
};
// the real shape of a finished assisted answer's appendix (production engine 0.6.8; invented matter here)
const APPENDIX_WIRE = {
  appendix_version: 1,
  steps: [
    { name: "ingest", calls: 1 }, { name: "select_contracts", calls: 1 }, { name: "describe_contract", calls: 1 }, { name: "judge_element", calls: 3 },
    { name: "assemble", calls: 1 }, { name: "lean_check", check: "agrees", calls: 1 }, { name: "decide", calls: 1 },
  ],
  per_contract: [{ contract_id: CID, elements_judged: 3, quotes_checked: 0, quotes_valid: 0, lean_agrees: true }],
  refused_calls: 0,
};
const OPTS = { engineVersion: "0.6.8", generatedAt: "2026-10-14T00:00:00Z" };
const withAppendix = (a: unknown): AnalyseFactsResult => ({ ...BASE, appendix: parseAppendix(a) } as unknown as AnalyseFactsResult);
const EXPECTED = [
  "## Steps of this screening", "",
  "- Read the facts", "- Chose the offences", "- Read the offence's ingredients", "- Read each ingredient", "- Assembled the table", "- Ran the structure check: passed", "- Decided",
];

test("parseAppendix keeps the version and the known steps in order; absent, malformed or empty is no appendix, never an error", () => {
  const a = parseAppendix(APPENDIX_WIRE);
  assert.equal(a?.appendix_version, 1);
  assert.deepEqual(a?.steps.map((s) => s.name), ["ingest", "select_contracts", "describe_contract", "judge_element", "assemble", "lean_check", "decide"]);
  assert.equal(a?.steps[5].check, "agrees");
  for (const bad of [undefined, null, 7, "x", [], {}, { appendix_version: 2, steps: [{ name: "ingest" }] }, { appendix_version: 1 }, { appendix_version: 1, steps: "no" }, { appendix_version: 1, steps: [] }, { appendix_version: 1, steps: [{ name: "not_a_step" }, 5, null] }]) {
    assert.equal(parseAppendix(bad), undefined, JSON.stringify(bad));
  }
  // an unknown step or check is left out, the readable ones stay
  const mixed = parseAppendix({ appendix_version: 1, steps: [{ name: "ingest" }, { name: "new_step_from_a_newer_engine" }, { name: "lean_check", check: "something_new" }] });
  assert.deepEqual(mixed?.steps, [{ name: "ingest" }, { name: "lean_check" }]);
});

test("the memo has the steps section with the signed labels, the signed check wording and no counts, when the appendix is present", () => {
  const md = buildScreeningMemo(withAppendix(APPENDIX_WIRE), OPTS);
  const lines = md.split("\n");
  const at = lines.indexOf("## Steps of this screening");
  assert.ok(at > 0, "the heading is present");
  assert.deepEqual(lines.slice(at, at + EXPECTED.length), EXPECTED);
  const section = lines.slice(at).join("\n");
  assert.doesNotMatch(section, /calls?\b|\bcount|elements_judged|quotes_|refused|appendix_version|per_contract|\d/i, "no count, id or version text in the steps section");
  assert.ok(!md.includes("Checked the quotes"), "a finished screening has no quote_check step and none is invented");
});

test("a quote_check step reads with the signed wording when the engine sends one", () => {
  const md = buildScreeningMemo(withAppendix({ appendix_version: 1, steps: [{ name: "quote_check", check: "valid" }, { name: "quote_check", check: "invalid" }] }), OPTS);
  assert.match(md, /- Checked the quotes: passed\n- Checked the quotes: /);
});

test("absent or malformed appendix: no heading, no empty section, no mention", () => {
  for (const a of [undefined, null, { appendix_version: 9 }, { appendix_version: 1, steps: [] }, "junk"]) {
    const md = buildScreeningMemo(withAppendix(a), OPTS);
    assert.doesNotMatch(md, /Steps of this screening|Read the facts|Ran the structure check/);
  }
  const plain = buildScreeningMemo(BASE as unknown as AnalyseFactsResult, OPTS);
  assert.doesNotMatch(plain, /Steps of this screening/);
});

test("the .docx says exactly what the .md says, steps included, line for line", async () => {
  const r = withAppendix(APPENDIX_WIRE);
  const md = buildScreeningMemo(r, OPTS);
  const back = ((await mammoth.extractRawText({ buffer: Buffer.from(buildScreeningMemoDocx(r, OPTS)) })).value).split("\n").filter((l) => l.trim());
  const intended = md.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.replace(/^#{1,3} /, "").replace(/^> /, "").replace(/^ {2}- /, "◦ ").replace(/^(- )?\*\*([^*]+)\*\*/, (_m, b: string | undefined, label: string) => `${b ? "• " : ""}${label}`).replace(/^- /, "• "));
  assert.deepEqual(back, intended);
  assert.ok(back.includes("Steps of this screening") && back.includes("• Ran the structure check: passed"));
});

test("the run record keeps the appendix (the technical record) and the plain run record has none", () => {
  const withIt = JSON.parse(buildRunRecord({ facts: [FACT], contractIds: [CID] }, withAppendix(APPENDIX_WIRE), OPTS));
  assert.equal(withIt.response.appendix.appendix_version, 1);
  const without = JSON.parse(buildRunRecord({ facts: [FACT], contractIds: [CID] }, BASE as unknown as AnalyseFactsResult, OPTS));
  assert.equal(without.response.appendix, undefined);
});

test("the mock harness accepts the recorded appendix shape and rejects fields the engine does not send", async () => {
  const { appendixViolations } = await import("./assistantRun");
  assert.deepEqual(appendixViolations(APPENDIX_WIRE), []);
  assert.deepEqual(appendixViolations(undefined), []);
  assert.ok(appendixViolations({ ...APPENDIX_WIRE, summary: "x" }).length > 0);
  assert.ok(appendixViolations({ ...APPENDIX_WIRE, steps: [{ name: "ingest" }] }).length > 0);
});
