import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyseFactsResult } from "./api";
import { checkDemoResult, type DemoFixture } from "./demoCheck";

const FX: DemoFixture = { id: "toy", path: "PROOF", wording: "plain", contractId: "toy_c", expectedOutcome: "PROOF", facts: ["TOY one."] };
const el = (quote: string | null) => ({
  element: "e1", is_denial: false, status: "established", claimed: true, p_established: 0.9, fact_id: "F1", quote,
  start: 0, end: 1, quote_check: "ok", attempts: 1, occurrences: 1, offsets_source: "system", quote_source: "model", error: null,
});
const res = (outcome: string, elements: unknown[], factText = "TOY one."): AnalyseFactsResult =>
  ({
    run_id: "r1", judge: "j", score_sha256: "a".repeat(64), provenance: "toy",
    facts: [{ id: "F1", text: factText, sha256: "b".repeat(64) }],
    contracts: [{ contract_id: "toy_c", outcome, reason: "", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, elements }],
  }) as unknown as AnalyseFactsResult;

test("a matching result has no problems", () => {
  assert.deepEqual(checkDemoResult(res("PROOF", [el("TOY one")]), FX), []);
});
test("outcome differing from the recorded expectation fails", () => {
  assert.match(checkDemoResult(res("ABSTAIN", []), FX).join(), /outcome ABSTAIN/);
});
test("missing element rows, missing quote and a quote not in the facts all fail", () => {
  assert.match(checkDemoResult(res("PROOF", []), FX).join(), /no element rows/);
  assert.match(checkDemoResult(res("PROOF", [el(null)]), FX).join(), /has no quote/);
  assert.match(checkDemoResult(res("PROOF", [el("invented words")]), FX).join(), /not in the submitted facts/);
});
test("bad hashes and a missing contract fail", () => {
  const r = res("PROOF", [el("TOY one")]);
  r.score_sha256 = "xyz";
  assert.match(checkDemoResult(r, FX).join(), /score_sha256/);
  assert.match(checkDemoResult(res("PROOF", [el("TOY one")]), { ...FX, contractId: "other" }).join(), /no result for contract other/);
});
