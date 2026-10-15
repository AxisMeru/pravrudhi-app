// The screening memo (markdown; print-to-PDF from the page) and the run record download. The memo is a screening aid, not advice: it lists each
// ingredient's chip, the cited fact in full, the review items, the engine and checker versions and the standing disclaimer. Pure functions.
import type { AnalyseFactsResult } from "../api";
import contractElements from "../fixtures/contractElements.json";
import { buildDocx } from "../docxWriter";
import { MEMO_DISCLAIMER } from "../memo";
import { ALTERNATE_LIMB_NOTE, CHIP_LABEL, DEFENCE_HEADING, DEFENCE_PROMPT_NOTE, ipcDisclosure, STRUCTURE_NOTE, WHAT_TO_CHECK_LABEL, BANNER_STANDING_LINE } from "./copy";
import { contractReferral, rowsFor, summarize, type ScreeningRow } from "./model";
import { CONTRACT_BLOCK_TITLES, blockTitle, isAlternateLimb, offenceLabel, offenceOf } from "./offences";
import { STEP_LABELS, STEP_TRACE_HEADING, stepCheckText } from "../assistantRun";

const line = (s: string): string => s.replace(/\r?\n/g, " ");

function rowLines(r: ScreeningRow): string[] {
  const out = [`- **${CHIP_LABEL[r.chip]}**: ${line(r.element)}`];
  if (r.reason) out.push(`  - Reason: ${line(r.reason)}`);
  if (r.note) out.push(`  - ${line(r.note)}`);
  if (r.factText) out.push(`  - ${r.factId}: ${line(r.factText)}`);
  if (r.quote) out.push(`  - "${line(r.quote.text)}"${r.quote.check ? ` (${line(r.quote.check)})` : ""}`);
  out.push(`  - ${WHAT_TO_CHECK_LABEL}: ${r.whatToCheck ?? "not screened yet"}`);
  return out;
}

export interface ScreeningMemoOptions {
  engineVersion: string | null;
  generatedAt: string;
  /** R3 (15 Oct): a run of a public example carries the page's label and the order's citation into the memo, so a memo shared on its own says the facts are a court's recited allegations, not findings. */
  example?: { label: string; citation: string } | null;
}

/** The memo's heading for a block: a way of a multi-way offence carries its own title, any other known offence its label with sections, and a contract the app does not know the neutral "Offence", NEVER the contract id (R2, #210). */
export function memoBlockHeading(contractId: string): string {
  const off = offenceOf(contractId);
  return CONTRACT_BLOCK_TITLES[contractId] ?? (off ? offenceLabel(off) : blockTitle(contractId));
}

export function buildScreeningMemo(result: AnalyseFactsResult, opts: ScreeningMemoOptions): string {
  const out = ["# Screening memo", "", `> ${MEMO_DISCLAIMER}`, "", `> ${BANNER_STANDING_LINE}`, ""];
  out.push(`- Run id: ${result.run_id}`, `- Engine version: ${opts.engineVersion ?? "unknown"}`, `- Score sha256: ${result.score_sha256}`);
  out.push(`- Contract checker pin (sha256): ${contractElements._binary_sha256}`, `- Generated: ${opts.generatedAt}`, "", "## Facts", "");
  if (opts.example) out.push(`> ${line(opts.example.label)}`, `> ${line(opts.example.citation)}`, "");
  for (const f of result.facts) out.push(f.text ? `- **${f.id}**: ${line(f.text)}` : `- **${f.id}** (sha256 ${f.sha256})`);
  out.push("");
  for (const c of result.contracts) {
    const rows = rowsFor(c, result.facts);
    const s = summarize(c, rows);
    const off = offenceOf(c.contract_id);
    // R1 (15 Oct): a way of a multi-way offence carries the same title as on the screen (and the same alternate-way note under it), so the blocks of one offence do not read alike.
    const wayTitle = CONTRACT_BLOCK_TITLES[c.contract_id];
    out.push(`## ${memoBlockHeading(c.contract_id)}`, "");
    if (wayTitle && isAlternateLimb(c.contract_id)) out.push(ALTERNATE_LIMB_NOTE, ""); // R1 (15 Oct): no "Contract: <id>" line; the id stays in the run record
    if (off?.ipcChecked) out.push(ipcDisclosure(off.ipcChecked), "");
    // The banner sentence never appears without the standing line directly under it (R1).
    out.push(`**${s.text}**`, BANNER_STANDING_LINE, ...(s.allSupported ? [STRUCTURE_NOTE] : []), "");
    const ref = contractReferral(c);
    if (ref) out.push(`Needs your review: ${line(ref.message)}`, ""); // R1 14 Oct: one label for known and unknown reasons; an empty reason has no code to name
    out.push("### Ingredients", "", ...rows.ingredients.flatMap(rowLines), "");
    if (rows.defences.length > 0) out.push(`### ${DEFENCE_HEADING}`, "", DEFENCE_PROMPT_NOTE, "", ...rows.defences.flatMap(rowLines), "");
    const att = c.lean_attestation;
    if (att?.binary_sha256) out.push(`Lean checker: binary sha256 ${att.binary_sha256}${att.wire_sha256 ? `, wire sha256 ${att.wire_sha256}` : ""}`, "");
  }
  // #169 (R1): the steps of an assisted run, as on the screen: the signed label, then ": " and the signed check wording only for a step that carries a check. Nothing when there is no appendix.
  if (result.appendix && result.appendix.steps.length > 0) {
    out.push(`## ${STEP_TRACE_HEADING}`, "");
    for (const s of result.appendix.steps) {
      const check = stepCheckText(s);
      out.push(`- ${STEP_LABELS[s.name]}${check ? `: ${check}` : ""}`);
    }
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** The run record download (v1, client side): what was sent, what came back, and the versions. No new endpoint. */
export function buildRunRecord(request: { facts: string[]; contractIds: string[] }, result: AnalyseFactsResult, opts: ScreeningMemoOptions): string {
  return JSON.stringify(
    { generated_at: opts.generatedAt, engine_version: opts.engineVersion, checker_pin_sha256: contractElements._binary_sha256, request, response: result },
    null,
    2,
  );
}

/** The Word (.docx) memo: made FROM the markdown memo above, so it says exactly what the .md memo says (same facts, banner, review items, versions). */
export function buildScreeningMemoDocx(result: AnalyseFactsResult, opts: ScreeningMemoOptions): Uint8Array {
  return buildDocx(buildScreeningMemo(result, opts));
}
