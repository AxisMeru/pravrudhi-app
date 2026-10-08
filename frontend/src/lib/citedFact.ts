// How an element's support is cited (#812, #813): the wording BRANCHES on quote_source and is never one fixed claim.
//  - the engine's own citation_note, whenever it sends one, is the sentence shown (one copy of the sentences); the rest is the fallback for an older engine.
//  - "model": the frontier path, a real model quote: it is shown as the quote with the neutral "cites the supporting fact", never a stronger claim without the engine's note.
//  - "whole_fact": the house judges name the fact and do not quote words: the page says it cites that fact in full, and shows no quote.
//  - anything else: no citation claim at all.
// Nothing here claims a verbatim span or a highlighted passage.
export type CitationKind = "model" | "whole_fact" | "unstated" | "none";

export interface CitedElement {
  quote?: string | null;
  quote_source?: string | null;
  quote_check?: string | null;
  status?: string | null;
  fact_id?: string | null;
  /** The engine's own sentence for how this element cites its support (additive; absent on an older engine). */
  citation_note?: string | null;
}

export function citationKind(e: CitedElement): CitationKind {
  if (e.quote_source === "whole_fact") return "whole_fact";
  if (e.quote_source === "model" && e.quote) return "model";
  // An older engine (before #813) serving the house judge sends no quote_source, and the house judges cite a whole fact: an established element
  // with no usable source is treated like whole_fact (neutral sentence, no quote shown), never as a quote (R1, 8 Oct).
  if (e.status === "established") return "unstated";
  return "none";
}

export const NEUTRAL_NOTE = "cites the supporting fact";

/**
 * The note beside a cited fact; null when no claim may be made. The engine's own `citation_note` is used whenever it is there, so the sentences
 * live in one place. Without it (an older engine) the page never makes a quote claim: a whole fact is described as such, any other cited element
 * gets the neutral "cites the supporting fact", and an element with no citation gets nothing.
 */
export function citationNote(e: CitedElement): string | null {
  const engine = typeof e.citation_note === "string" ? e.citation_note.trim() : "";
  if (engine) return engine;
  const kind = citationKind(e);
  if (kind === "whole_fact") {
    const fact = e.fact_id ? `your fact ${e.fact_id}` : "your fact";
    return `cites ${fact} in full (the judge names the fact; it does not quote words)`;
  }
  if (kind === "model" || kind === "unstated") return NEUTRAL_NOTE;
  return null;
}

/** The memo's column header: "Supporting quote" only when every cited element carries a model quote, otherwise "Cited fact". */
export function memoCitationHeader(elements: readonly CitedElement[]): string {
  const cited = elements.filter((e) => citationKind(e) !== "none");
  return cited.length > 0 && cited.every((e) => citationKind(e) === "model") ? "Supporting quote" : "Cited fact";
}

export function memoCitationCell(e: CitedElement): string {
  const kind = citationKind(e);
  const note = citationNote(e);
  if (kind === "whole_fact") return note ?? (e.fact_id ? `cites fact ${e.fact_id} in full` : "cites the fact in full");
  if (kind === "model") return `"${e.quote}"${e.fact_id ? ` (${e.fact_id})` : ""}${note ? ` (${note})` : ""}`;
  if (kind === "unstated") return `${note}${e.fact_id ? ` (${e.fact_id})` : ""}`;
  return "no cited fact";
}
