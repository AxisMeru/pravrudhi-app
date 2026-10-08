// The screening memo (markdown; print-to-PDF from the page) and the audit-trail download. The memo is a screening aid, not advice: it lists each
// ingredient's chip, the cited fact in full, the review items, the engine and checker versions and the standing disclaimer. Pure functions.
import type { AnalyseFactsResult } from "../api";
import contractElements from "../fixtures/contractElements.json";
import { MEMO_DISCLAIMER } from "../memo";
import { CHIP_LABEL, SUGGESTED_NOTE, WHAT_TO_CHECK_LABEL, BANNER_STANDING_LINE } from "./copy";
import { contractReferral, rowsFor, summarize, type ScreeningRow } from "./model";
import { offenceOf } from "./offences";

const line = (s: string): string => s.replace(/\r?\n/g, " ");

function rowLines(r: ScreeningRow): string[] {
  const out = [`- **${CHIP_LABEL[r.chip]}**: ${line(r.element)}`];
  if (r.suggested) out.push(`  - ${SUGGESTED_NOTE}`);
  if (r.reason) out.push(`  - Reason: ${line(r.reason)}`);
  if (r.note) out.push(`  - ${line(r.note)}`);
  if (r.factText) out.push(`  - ${r.factId}: ${line(r.factText)}`);
  if (r.quote) out.push(`  - "${line(r.quote.text)}"${r.quote.check ? ` (${line(r.quote.check)})` : ""}`);
  out.push(`  - ${WHAT_TO_CHECK_LABEL}: ${r.whatToCheck ?? "no prompt written yet"}`);
  return out;
}

export interface ScreeningMemoOptions {
  engineVersion: string | null;
  generatedAt: string;
}

export function buildScreeningMemo(result: AnalyseFactsResult, opts: ScreeningMemoOptions): string {
  const out = ["# Screening memo", "", `> ${MEMO_DISCLAIMER}`, "", `> ${BANNER_STANDING_LINE}`, ""];
  out.push(`- Run id: ${result.run_id}`, `- Engine version: ${opts.engineVersion ?? "unknown"}`, `- Score sha256: ${result.score_sha256}`);
  out.push(`- Contract checker pin (sha256): ${contractElements._binary_sha256}`, `- Generated: ${opts.generatedAt}`, "", "## Facts", "");
  for (const f of result.facts) out.push(`- **${f.id}**: ${line(f.text)}`);
  out.push("");
  for (const c of result.contracts) {
    const rows = rowsFor(c, result.facts);
    const s = summarize(c, rows);
    const off = offenceOf(c.contract_id);
    out.push(`## ${off ? `${off.title} (${off.sections})` : c.contract_id}`, "", `Contract: ${c.contract_id}`, "", `**${s.text}**`, "");
    const ref = contractReferral(c);
    if (ref) out.push(`Needs your review: ${line(ref.message)} (reason: ${ref.code})`, "");
    out.push("### Ingredients", "", ...rows.ingredients.flatMap(rowLines), "");
    if (rows.defences.length > 0) out.push("### A fact that may defeat the claim", "", ...rows.defences.flatMap(rowLines), "");
    const att = c.lean_attestation as Record<string, string> | null | undefined;
    if (att?.binary_sha256) out.push(`Lean checker: binary sha256 ${att.binary_sha256}${att.wire_sha256 ? `, wire sha256 ${att.wire_sha256}` : ""}`, "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** The audit trail download (v1, client side): what was sent, what came back, and the versions. No new endpoint. */
export function buildAuditTrail(request: { facts: string[]; contractIds: string[] }, result: AnalyseFactsResult, opts: ScreeningMemoOptions): string {
  return JSON.stringify(
    { generated_at: opts.generatedAt, engine_version: opts.engineVersion, checker_pin_sha256: contractElements._binary_sha256, request, response: result },
    null,
    2,
  );
}
