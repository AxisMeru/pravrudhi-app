import type { AnalyseFactsContract, AnalyseFactsElement, AnalyseFactsResult } from "./api";
import { elementStatusPresentation } from "./elementStatus";
import { referReasonPresentation } from "./referReason";

export const MEMO_DISCLAIMER =
  "This memo is an analysis aid, not legal advice. A REFER_TO_LAWYER outcome means a lawyer must decide; " +
  "no verdict was reached. A quote is verbatim text from the submitted facts, not proof that it is relevant.";

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
  return lines.join("\n");
}

export function buildMemo(result: AnalyseFactsResult, opts: MemoOptions): string {
  const out = [
    "# Analysis memo",
    "",
    `> ${MEMO_DISCLAIMER}`,
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
