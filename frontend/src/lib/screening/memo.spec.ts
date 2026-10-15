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

test("referral line with a reason that is undefined or null (a malformed-but-accepted answer): no throw, the signed empty-reason sentence, no parenthesis", () => {
  const EMPTY = "Needs your review: This ingredient needs a lawyer's look. The screening gave no reason for it.";
  const noReason = (v: unknown): AnalyseFactsResult => ({ ...RESULT, contracts: [{ ...(RESULT.contracts[0] as object), reason: v }] } as unknown as AnalyseFactsResult);
  for (const v of [undefined, null]) assert.equal(referralLine(noReason(v)), EMPTY, String(v));
  // the key absent altogether
  const rest = Object.fromEntries(Object.entries(RESULT.contracts[0] as unknown as Record<string, unknown>).filter(([k]) => k !== "reason"));
  assert.equal(referralLine({ ...RESULT, contracts: [rest] } as unknown as AnalyseFactsResult), EMPTY);
});

// R1, 15 Oct: the memo heading of a way of a multi-way offence is the SAME string as the screen's block title, with the alternate-way note under every way after the first.
test("the memo heading of each way equals the screen's block title; the alternate note follows every way after the first; a single-way offence keeps its plain heading", async () => {
  const { OFFENCES, blockTitle } = await import("./offences");
  const { ALTERNATE_LIMB_NOTE } = await import("./copy");
  const ids = OFFENCES.filter((o) => o.contracts.length > 1).flatMap((o) => [...o.contracts]);
  const one = (id: string) => ({ ...(RESULT.contracts[0] as object), contract_id: id, outcome: "ABSTAIN", reason: "missing_element" });
  const r = { ...RESULT, contracts: [...ids.map(one), one("ni138")] } as unknown as AnalyseFactsResult;
  const lines = buildScreeningMemo(r, { engineVersion: "0.6.3", generatedAt: "2026-10-14T00:00:00Z" }).split("\n");
  for (const o of OFFENCES.filter((x) => x.contracts.length > 1)) {
    o.contracts.forEach((id, i) => {
      const at = lines.indexOf(`## ${blockTitle(id)}`);
      assert.ok(at >= 0, `${id}: no heading equal to its screen title`);
      assert.equal(lines[at + 2] === ALTERNATE_LIMB_NOTE, i > 0, `${id}: alternate note ${i > 0 ? "missing" : "present on the first way"}`);
    });
  }
  assert.ok(lines.some((l) => l.startsWith("## Dishonour of a cheque")));
});
