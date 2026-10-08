// How an element's support is cited (#812, #813): the wording BRANCHES on quote_source and is never one fixed claim.
//  - "model": the frontier path, a real model quote that was checked against the fact: it is shown as a word-for-word quote that passed the quote check.
//  - "whole_fact": the house judges name the fact and do not quote words: the page says it cites that fact in full, and shows no quote.
//  - anything else: no citation claim at all.
// Nothing here claims a verbatim span or a highlighted passage.
export type CitationKind = "model" | "whole_fact" | "none";

export interface CitedElement {
  quote?: string | null;
  quote_source?: string | null;
  quote_check?: string | null;
  fact_id?: string | null;
}

export function citationKind(e: CitedElement): CitationKind {
  if (e.quote_source === "whole_fact") return "whole_fact";
  if (e.quote_source === "model" && e.quote) return "model";
  return "none";
}

export const MODEL_QUOTE_NOTE = "word-for-word quote that passed the quote check";

/** The note beside a cited fact; null when no claim may be made. A model quote is called checked only when the engine's quote check says ok. */
export function citationNote(e: CitedElement): string | null {
  const kind = citationKind(e);
  if (kind === "whole_fact") {
    const fact = e.fact_id ? `your fact ${e.fact_id}` : "your fact";
    return `cites ${fact} in full (the judge names the fact; it does not quote words)`;
  }
  if (kind === "model" && e.quote_check === "ok") return MODEL_QUOTE_NOTE;
  return null;
}

/** The memo's column header: "Supporting quote" only when every cited element carries a model quote, otherwise "Cited fact". */
export function memoCitationHeader(elements: readonly CitedElement[]): string {
  const cited = elements.filter((e) => citationKind(e) !== "none");
  return cited.length > 0 && cited.every((e) => citationKind(e) === "model") ? "Supporting quote" : "Cited fact";
}

export function memoCitationCell(e: CitedElement): string {
  const kind = citationKind(e);
  if (kind === "whole_fact") return e.fact_id ? `cites fact ${e.fact_id} in full` : "cites the fact in full";
  if (kind === "model") return `"${e.quote}"${e.fact_id ? ` (${e.fact_id})` : ""}`;
  return "no cited fact";
}
