import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyseFactsResult } from "../api";
import { buildScreeningMemo } from "./memo";

// R1, 14 Oct (D2): the exported screening memo labels the engine's reason code as such and never prints a bare "(reason: ...)".
const RESULT = {
  run_id: "r-invented-memo", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented",
  facts: [{ id: "F1", text: "Invented: a seller sold a plot he did not own.", sha256: "b".repeat(64) }],
  contracts: [{ contract_id: "ni138", outcome: "REFER_TO_LAWYER", reason: "contract_not_validated", elements: [], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null }],
} as unknown as AnalyseFactsResult;

test("the screening memo's referral line names the engine reason code with its label", () => {
  const md = buildScreeningMemo(RESULT, { engineVersion: "0.6.3", generatedAt: "2026-10-14T00:00:00Z" });
  assert.match(md, /Needs your review: .* \(Engine reason code: contract_not_validated\)/);
  assert.doesNotMatch(md, /\(reason: /);
});

const withReason = (reason: string): AnalyseFactsResult => ({ ...RESULT, contracts: [{ ...(RESULT.contracts[0] as object), reason }] } as unknown as AnalyseFactsResult);
const referralLine = (r: AnalyseFactsResult): string => buildScreeningMemo(r, { engineVersion: "0.6.3", generatedAt: "2026-10-14T00:00:00Z" }).split("\n").find((l) => l.startsWith("Needs your review:")) ?? "";

test("referral line, three cases: known reason, unknown reason, empty reason (R1, 14 Oct)", () => {
  assert.match(referralLine(withReason("uncertain")), /^Needs your review: The screening is not sure whether a condition holds\. Please have a lawyer look\. \(Engine reason code: uncertain\)$/);
  assert.equal(referralLine(withReason("a_reason_from_a_newer_engine")), "Needs your review: This ingredient needs a lawyer's look. The screening has no further detail for it. (Engine reason code: a_reason_from_a_newer_engine)");
  assert.equal(referralLine(withReason("")), "Needs your review: This ingredient needs a lawyer's look. The screening gave no reason for it.");
  assert.equal(referralLine(withReason("   ")), "Needs your review: This ingredient needs a lawyer's look. The screening gave no reason for it.");
});
