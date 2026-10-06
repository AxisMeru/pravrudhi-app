import type { AnalyseFactsContract, AnalyseFactsElement, AnalyseFactsResult } from "./api";
import { elementStatusPresentation } from "./elementStatus";
import { referReasonPresentation } from "./referReason";
import { STATUTE_NOTICE, provisionSourceLink } from "./statuteNotice";

export const MEMO_DISCLAIMER =
  "This memo is an analysis aid, not legal advice. A REFER_TO_LAWYER outcome means a lawyer must decide; " +
  "no verdict was reached. A quote is verbatim text from the submitted facts, not proof that it is relevant.";

export const MEMO_VALIDATION_TIER =
  "Validation tier: the judge behind this memo was validated on constructed, in-distribution sets (pipeline-measured). " +
  "That is not a measure of its accuracy on real matters, and a contract outside the validated set gets REFER_TO_LAWYER, not a verdict.";

export const PROVISION_HEADING = "Provision text (for reference)";
export const PROVISION_HEADING_NO_SOURCE = "Provision text (source not stated)";
// R1's wording (6 Oct): "contract" can read as a legal term, and the judge sees only its own configured text, so the line says
// whose list the conditions are and that they were not extracted from the text below; "findings were made against".
export const PROVISION_ELEMENTS_LINE =
  "The conditions above (and any defences) come from the contract this tool uses for the provision. They were not extracted from the text below, and the contract is this tool's reading of the provision.";
export const PROVISION_MISMATCH_LINE =
  "The judge was shown this version of the provision, which is shorter or different from the provision text above; its findings were made against this version, which may be cut short:";

export interface MemoOptions {
  engineVersion: string | null;
  generatedAt: string;
}

const cell = (s: string): string => s.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");

function elementRow(e: AnalyseFactsElement): string {
  const st = elementStatusPresentation(e.status);
  const p = e.p_established === null ? "n/a" : e.p_established.toFixed(2);
  const quote = e.quote ? `"${cell(e.quote)}"${e.fact_id ? ` (${cell(e.fact_id)})` : ""}` : "no supporting quote";
  return `| ${cell(e.element)}${e.is_denial ? " (defence)" : ""} | ${cell(st.label)} | ${p} | ${quote} |`;
}

const quoteBlock = (text: string): string[] => text.split(/\r?\n/).map((l) => `> ${l}`);

// One block per contract, only when the engine sent the provision text; nothing is invented or fetched. Under the heading, the
// line that says the conditions are the tool's own list; after the text, the unofficial-text notice with its source link (the
// licence condition on showing statute text). The judge's own version appears only when the engine sent one (it differs from or is shorter than the
// provision text above), with the line that says its findings were made against that version.
function provisionBlock(c: AnalyseFactsContract): string[] {
  const text = (c.rule_text ?? "").trim();
  if (!text) return [];
  const source = (c.rule_text_source ?? "").trim();
  // Provenance comes ONLY from the engine's `rule_text_source`; nothing here names a source the engine did not (Lead-2, 6 Oct).
  const lines = [`### ${source ? PROVISION_HEADING : PROVISION_HEADING_NO_SOURCE}`, "", PROVISION_ELEMENTS_LINE, "", ...quoteBlock(text), ""];
  if (source) lines.push(`Recorded source: ${cell(source)}`, "");
  // The notice AND a source link always travel together (the licence condition on showing statute text).
  const link = provisionSourceLink(source);
  lines.push(`${STATUTE_NOTICE} ${link.recorded ? "India Code" : "India Code (home page)"}: ${link.href}`, "");
  const judged = (c.judge_rule_text ?? "").trim();
  if (judged) lines.push(PROVISION_MISMATCH_LINE, "", ...quoteBlock(judged), "");
  return lines;
}

function contractSection(c: AnalyseFactsContract): string {
  const lines = [`## ${c.contract_id}`, "", `Outcome: ${c.outcome}`, ""];
  if (c.outcome === "REFER_TO_LAWYER") {
    const r = referReasonPresentation(c.reason);
    lines.push(`A lawyer must decide this matter: ${r.message}. No verdict was reached.`, `Engine reason code: ${c.reason || "none"}`, "");
  } else if (c.outcome === "ABSTAIN") {
    lines.push(
      "The engine did not reach a verdict on this contract. No verdict was reached and nothing here is a finding.",
      `Engine reason code: ${c.reason || "none"}`,
      "",
    );
  } else if (c.outcome === "PROOF") {
    lines.push("Every element was judged established from the submitted facts, each with a quote.", "");
  } else if (c.outcome === "DENIAL") {
    lines.push("A defence element was judged established from the submitted facts, with a quote.", "");
  } else {
    lines.push(`The engine sent an outcome ("${c.outcome}") that is not an outcome this app recognises. Treat it as no verdict.`, "");
  }
  if (c.elements.length > 0) {
    lines.push("| Element | Status | p(established) | Supporting quote |", "|---|---|---|---|", ...c.elements.map(elementRow), "");
  }
  if (c.lean) {
    lines.push(
      `Lean structural check: ${cell(c.lean.verdict)}. This is a structural check by a pinned checker of how the judged elements fit the contract; it does not establish that the facts are true or the law is correctly applied.`,
      "",
    );
  }
  lines.push(...provisionBlock(c));
  return lines.join("\n");
}

export function buildMemo(result: AnalyseFactsResult, opts: MemoOptions): string {
  const out = [
    "# Analysis memo",
    "",
    `> ${MEMO_DISCLAIMER}`,
    "",
    `> ${MEMO_VALIDATION_TIER}`,
    "",
    `- Run id: ${result.run_id}`,
    `- Judge: ${result.judge}`,
    `- Score sha256: ${result.score_sha256}`,
    `- Engine version: ${opts.engineVersion ?? "unknown"}`,
    `- Generated: ${opts.generatedAt}`,
    "",
    "## Facts submitted",
    "",
  ];
  for (const f of result.facts) {
    out.push(`**${f.id}** (sha256 ${f.sha256})`, "", ...f.text.split(/\r?\n/).map((l) => `> ${l}`), "");
  }
  for (const c of result.contracts) out.push(contractSection(c));
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
