import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyseFactsResult } from "../api";
import { buildRunRecord, buildScreeningMemo } from "../screening/memo";

// Track C, 21 Oct (#1038): a partial load (the 4B ready, the 32B not) puts reason second_judge_unavailable on the CONTRACT (REFER_TO_LAWYER) and, on each element the first judge established,
// not_established with vetoed_by "second" and a second_skip_reason starting "second_unavailable". Invented fixture.
const PARTIAL = {
  run_id: "r-invented-partial", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented",
  facts: [{ id: "F1", text: "Invented: a seller sold a plot he did not own.", sha256: "b".repeat(64) }],
  contracts: [{
    contract_id: "ni138", outcome: "REFER_TO_LAWYER", reason: "second_judge_unavailable",
    elements: [{ element: "an invented ingredient", is_denial: false, status: "not_established", claimed: true, p_established: 0.9, fact_id: "F1", quote_source: "whole_fact", quote: null, vetoed_by: "second", second_skip_reason: "second_unavailable: did not start" }],
    assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: false,
  }],
} as unknown as AnalyseFactsResult;

test("a partial-load result: the memo refers the ingredients and shows no supported outcome; the run record keeps the reason", () => {
  const md = buildScreeningMemo(PARTIAL, { engineVersion: "0.6.30", generatedAt: "2026-10-21T00:00:00Z" });
  assert.match(md, /^Needs your review: A second check was unavailable, so we hand this ingredient back to you\.$/m);
  assert.doesNotMatch(md, /second_judge_unavailable|second_unavailable/);
  const rec = buildRunRecord({ facts: ["Invented: a seller sold a plot he did not own."], contractIds: ["ni138"] }, PARTIAL, { engineVersion: "0.6.30", generatedAt: "2026-10-21T00:00:00Z" });
  assert.match(rec, /"reason": "second_judge_unavailable"/);
  assert.match(rec, /"second_skip_reason": "second_unavailable: did not start"/);
});
