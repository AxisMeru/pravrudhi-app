import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyseFactsResult } from "../api";
import { buildScreeningMemo } from "./memo";

// R1, 15 Oct (#204): the exported screening memo carries the screen's own referral sentence and NO engine reason code (the code stays in the run record and the legacy memo's labelled line).
const RESULT = {
  run_id: "r-invented-memo", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented",
  facts: [{ id: "F1", text: "Invented: a seller sold a plot he did not own.", sha256: "b".repeat(64) }],
  contracts: [{ contract_id: "ni138", outcome: "REFER_TO_LAWYER", reason: "contract_not_validated", elements: [], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null }],
} as unknown as AnalyseFactsResult;

test("the screening memo's referral line is the screen's sentence only: no engine reason code, no bare (reason: …)", () => {
  const md = buildScreeningMemo(RESULT, { engineVersion: "0.6.3", generatedAt: "2026-10-14T00:00:00Z" });
  assert.match(md, /^Needs your review: .*[^)]$/m);
  assert.doesNotMatch(md, /Engine reason code|contract_not_validated|\(reason: /);
});

const withReason = (reason: string): AnalyseFactsResult => ({ ...RESULT, contracts: [{ ...(RESULT.contracts[0] as object), reason }] } as unknown as AnalyseFactsResult);
const referralLine = (r: AnalyseFactsResult): string => buildScreeningMemo(r, { engineVersion: "0.6.3", generatedAt: "2026-10-14T00:00:00Z" }).split("\n").find((l) => l.startsWith("Needs your review:")) ?? "";

test("referral line, three cases: known reason, unknown reason, empty reason (R1, 14 Oct)", () => {
  assert.match(referralLine(withReason("uncertain")), /^Needs your review: The screening is not sure whether a condition holds\. Please have a lawyer look\.$/);
  assert.equal(referralLine(withReason("a_reason_from_a_newer_engine")), "Needs your review: This ingredient needs a lawyer's look. The screening has no further detail for it.");
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

// R1, 15 Oct (#204): no internal token reaches the user's memo in either format: no REFER_TO_LAWYER, no contract id, no reason code. The Word file is built from the same lines, and its text is read back from the zip.
test("the screening memo (.md and .docx text) carries no internal token: REFER_TO_LAWYER, contract ids, reason codes", async () => {
  const { OFFENCES } = await import("./offences");
  // R2 (#210): ids the app's OFFENCES table does not know must not reach the memo as a heading either (a contract in the engine's registry but not offered here, a future id, a lookalike).
  const UNKNOWN = ["bns316_misappropriation", "ipc999_future_offence", "ni138_cheque_dishonour"];
  const ids = [...OFFENCES.flatMap((o) => [...o.contracts]), ...UNKNOWN];
  const one = (id: string, reason: string) => ({ ...(RESULT.contracts[0] as object), contract_id: id, outcome: "REFER_TO_LAWYER", reason });
  const r = { ...RESULT, contracts: ids.map((id, i) => one(id, ["second_judge_not_confirmed", "uncertain", "missing_element"][i % 3])) } as unknown as AnalyseFactsResult;
  const o = { engineVersion: "0.6.3", generatedAt: "2026-10-14T00:00:00Z" };
  const md = buildScreeningMemo(r, o);
  const { buildScreeningMemoDocx } = await import("./memo");
  const { inflateRawSync } = await import("node:zlib");
  const zip = Buffer.from(buildScreeningMemoDocx(r, o));
  // collect every deflated or stored part of the zip and look at all text in it
  const parts: string[] = [];
  for (let at = 0; at + 30 < zip.length && zip.readUInt32LE(at) === 0x04034b50; ) {
    const method = zip.readUInt16LE(at + 8), csize = zip.readUInt32LE(at + 18), nlen = zip.readUInt16LE(at + 26), xlen = zip.readUInt16LE(at + 28);
    const start = at + 30 + nlen + xlen;
    const data = zip.subarray(start, start + csize);
    parts.push(method === 8 ? inflateRawSync(data).toString("utf8") : data.toString("utf8"));
    at = start + csize;
  }
  const TOKENS = /REFER_TO_LAWYER|\bipc\d+_|\bbns\d+_|\bni\d+|reason code|second_judge_not_confirmed|missing_element/i;
  assert.doesNotMatch(md, TOKENS);
  for (const id of UNKNOWN) assert.ok(!md.includes(id), `${id} reached the memo`);
  assert.equal(md.split("\n").filter((l) => l === "## Offence").length, UNKNOWN.length, "each unknown contract is headed by the neutral 'Offence'");
  for (const t of parts) assert.doesNotMatch(t, TOKENS);
  assert.ok(parts.some((t) => t.includes("A lawyer decides")), "the docx carries the new disclaimer");
  assert.match(md, /^> This memo is a screening aid, not legal advice\. A lawyer decides\./m);
});

// R3 (15 Oct): a run of a public example carries R1's label and the order's citation into BOTH memo formats; a run without an example carries neither.
test("an example run's memo (.md and .docx) carries the example label and the order's citation under Facts; a plain run does not", async () => {
  const { EXAMPLES } = await import("../demo/example");
  const { buildScreeningMemoDocx } = await import("./memo");
  const ex = EXAMPLES[0];
  const o = { engineVersion: "0.6.3", generatedAt: "2026-10-14T00:00:00Z", example: { label: ex.label, citation: ex.citation } };
  const md = buildScreeningMemo(RESULT, o);
  const at = md.split("\n").indexOf("## Facts");
  const lines = md.split("\n");
  assert.equal(lines[at + 2], `> ${ex.label}`);
  assert.equal(lines[at + 3], `> ${ex.citation}`);
  const { default: mammoth } = await import("mammoth");
  const docText = (await mammoth.extractRawText({ buffer: Buffer.from(buildScreeningMemoDocx(RESULT, o)) })).value;
  assert.ok(docText.includes(ex.label) && docText.includes(ex.citation), "the Word memo carries both");
  const plain = buildScreeningMemo(RESULT, { engineVersion: "0.6.3", generatedAt: "2026-10-14T00:00:00Z" });
  assert.ok(!plain.includes(ex.citation) && !plain.includes("A public court order"), "no example, no label");
});

// #214 (a): the Matters page ships this same memo (buildScreeningMemo), so the token scan covers what Matters can hand over: EVERY outcome the engine sends (and one it does not), every reason the engine uses
// (including the ones with no sentence of their own), and contract ids the app's OFFENCES table does not know, in the .md and in the .docx text.
test("the Matters memo (.md and .docx text): no internal token for any outcome, reason or contract id", async () => {
  const { OFFENCES } = await import("./offences");
  const UNKNOWN = ["bns316_misappropriation", "ipc999_future_offence", "ni138_cheque_dishonour", "bnss187"];
  const ids = [...OFFENCES.flatMap((o) => [...o.contracts]), ...UNKNOWN];
  const OUTCOMES = ["PROOF", "DENIAL", "ABSTAIN", "REFER_TO_LAWYER", "SOMETHING_NEW"];
  const REASONS = ["", "judge_error", "missing_element", "second_judge_not_confirmed", "uncertain", "contract_not_validated", "no_training_statute_text", "a_reason_from_a_newer_engine", "all_elements_supported"];
  const el = { element: "an invented ingredient", is_denial: false, status: "not_established", p_established: 0.1, claimed: false, fact_id: null, quote: null, quote_source: null, quote_check: null, binding_leg: "primary", screening_signal: null, citation_note: null, error: null };
  const contracts = ids.map((id, i) => ({ ...(RESULT.contracts[0] as object), contract_id: id, outcome: OUTCOMES[i % OUTCOMES.length], reason: REASONS[i % REASONS.length], elements: [el] }));
  const r = { ...RESULT, contracts } as unknown as AnalyseFactsResult;
  const o = { engineVersion: "0.6.11", generatedAt: "2026-10-15T00:00:00Z" };
  const md = buildScreeningMemo(r, o);
  const { buildScreeningMemoDocx } = await import("./memo");
  const { inflateRawSync } = await import("node:zlib");
  const zip = Buffer.from(buildScreeningMemoDocx(r, o));
  const parts: string[] = [];
  for (let at = 0; at + 30 < zip.length && zip.readUInt32LE(at) === 0x04034b50; ) {
    const method = zip.readUInt16LE(at + 8), csize = zip.readUInt32LE(at + 18), nlen = zip.readUInt16LE(at + 26), xlen = zip.readUInt16LE(at + 28);
    const start = at + 30 + nlen + xlen, data = zip.subarray(start, start + csize);
    parts.push(method === 8 ? inflateRawSync(data).toString("utf8") : data.toString("utf8"));
    at = start + csize;
  }
  const TOKENS = /Engine reason code|REFER_TO_LAWYER|\bPROOF\b|\bDENIAL\b|\bABSTAIN\b|SOMETHING_NEW|\bipc\d+_|\bbns\d+_|\bbnss\d+|\bni\d+|judge_error|missing_element|second_judge_not_confirmed|contract_not_validated|no_training_statute_text|a_reason_from_a_newer_engine|all_elements_supported|\(reason: /i;
  assert.doesNotMatch(md, TOKENS);
  for (const id of UNKNOWN) assert.ok(!md.includes(id), `${id} reached the memo`);
  assert.equal(md.split("\n").filter((l) => l === "## Offence").length, UNKNOWN.length, "each unknown contract is headed by the neutral 'Offence'");
  for (const t of parts) assert.doesNotMatch(t, TOKENS);
  assert.match(md, /^> This memo is a screening aid, not legal advice\. A lawyer decides\./m);
});
