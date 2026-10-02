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

// pravrudhi#220: the response's own `standard` object, read as sent. No inference: a missing object means the
// engine did not report one, and the line says so rather than assuming a default.
export interface StandardInfo {
  applied: string;
  source: string;
  proceeding_posture?: string | null;
}

const STANDARD_LABEL: Record<string, string> = { prima_facie_disclosed: "prima facie disclosed", proved: "proved" };
const SOURCE_LABEL: Record<string, string> = {
  proceeding_posture: "from proceeding posture",
  proceeding_type: "from proceeding type",
  default: "default",
};

// An unrecognised `applied` or `source` is shown verbatim and marked unknown, never mapped to a known value.
export function standardLine(std?: StandardInfo | null): { text: string; known: boolean } {
  if (!std) return { text: "standard: not reported by this engine", known: false };
  const name = STANDARD_LABEL[std.applied] ?? std.applied;
  const src = SOURCE_LABEL[std.source] ?? `source: ${std.source}`;
  const posture = std.proceeding_posture ? `: ${std.proceeding_posture}` : "";
  const known = std.applied in STANDARD_LABEL && std.source in SOURCE_LABEL;
  return { text: `standard: ${name} (${src}${std.source === "proceeding_posture" ? posture : ""})`, known };
}
