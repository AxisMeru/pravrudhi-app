// Pure helpers for the matters results view (AxisMeru/pravrudhi-app#15). No React, so node:test can cover them.

import type { AnalyseFactsCitation, AnalyseFactsElement, RegistryContractEntry } from "./api";

export interface QuoteSegments {
  before: string;
  mark: string;
  after: string;
}

// Split the fact the quote came from around the engine's returned offsets. Offsets are only trusted when the
// slice at [start, end) is exactly the quote: a mismatch (stale offsets, a different fact) returns null so the
// caller shows the bare quote rather than highlighting the wrong words.
export function quoteSegments(
  el: Pick<AnalyseFactsElement, "quote" | "start" | "end" | "fact_id">,
  facts: readonly { id: string; text: string }[],
): QuoteSegments | null {
  if (!el.quote || el.start === null || el.end === null || el.fact_id === null) return null;
  if (!Number.isInteger(el.start) || !Number.isInteger(el.end) || el.start < 0 || el.end <= el.start) return null;
  const fact = facts.find((f) => f.id === el.fact_id);
  if (!fact || el.end > fact.text.length) return null;
  if (fact.text.slice(el.start, el.end) !== el.quote) return null;
  return { before: fact.text.slice(0, el.start), mark: el.quote, after: fact.text.slice(el.end) };
}

// Coverage from the registry listing. Null means the engine sent no per-contract flags, so coverage is unknown;
// callers must not treat unknown as covered or as uncovered.
export function coverageById(entries: readonly RegistryContractEntry[] | null): Map<string, boolean> | null {
  if (!entries || entries.length === 0) return null;
  return new Map(entries.map((e) => [e.id, e.validated]));
}

export function isUncovered(contractId: string, coverage: Map<string, boolean> | null): boolean {
  return coverage?.get(contractId) === false;
}

export type CitationState = "in_corpus" | "unresolved";

export function citationLabel(c: AnalyseFactsCitation): string {
  return c.section ? `${c.act} s. ${c.section}` : c.act;
}

export function citationState(c: AnalyseFactsCitation): CitationState {
  return c.in_corpus ? "in_corpus" : "unresolved";
}

export function shortSha(sha: string): string {
  return sha.length > 12 ? `${sha.slice(0, 12)}…` : sha;
}

// pravrudhi#220/#222: the response's own `standard` object, read as sent. No inference: a missing object means the
// engine did not report one, and the line says so rather than assuming a default. `requested` is the standard the
// posture asks for; `applied` is the standard the judge's prompt actually stated, or null when it stated none. An
// older engine sends only `applied` (as the standard in force); that shape is still read as before.
export interface StandardInfo {
  requested?: string;
  applied?: string | null;
  source: string;
  proceeding_posture?: string | null;
  // false = the basis is recorded but the judge's prompt never stated it. Absent on older engines.
  in_judge_prompt?: boolean;
}

const STANDARD_LABEL: Record<string, string> = { prima_facie_disclosed: "prima facie disclosed", proved: "proved" };
const SOURCE_LABEL: Record<string, string> = {
  proceeding_posture: "from proceeding posture",
  proceeding_type: "from proceeding type",
  default: "default",
};

// An unrecognised `requested`, `applied` or `source` is shown verbatim and marked unknown, never mapped to a known
// value. A standard the judge was never told is never shown as applied, and "null" is never printed.
export function standardLine(std?: StandardInfo | null): { text: string; known: boolean } {
  if (!std) return { text: "standard: not reported by this engine", known: false };
  const named = std.requested ?? std.applied;
  if (named === undefined || named === null) return { text: "standard: not reported by this engine", known: false };
  const name = STANDARD_LABEL[named] ?? named;
  const src = SOURCE_LABEL[std.source] ?? `source: ${std.source}`;
  const posture = std.proceeding_posture ? `: ${std.proceeding_posture}` : "";
  const known = named in STANDARD_LABEL && std.source in SOURCE_LABEL;
  const basis = `${src}${std.source === "proceeding_posture" ? posture : ""}`;
  if (std.applied === null || std.in_judge_prompt === false) {
    return { text: `standard requested: ${name} (${basis}); not applied, the judge was never told it`, known };
  }
  return { text: `standard: ${name} (${basis})`, known };
}
