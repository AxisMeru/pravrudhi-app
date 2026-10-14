// Intake (pravrudhi#414, route on engine main since #430): pasted text in, numbered facts out, each tied to the words it came from, plus the citations found. This file reads the
// engine's answer (the bundle of machine tokens) and turns each token into R1's plain sentence; the engine's own per-fact reason strings are never shown (R1, 14 Oct).
// The shape read here: { run_id, client_data, bundle: { clean_status, facts: [{ id, text, status }], not_citable: [{ status }], citations: [{ text, verifier_status, fact_ids }], ... } }.

export interface IntakeFact { id: string; text: string; status: "span" | "raw_fallback" }
export interface IntakeCitation { text: string; verifierStatus: string; factIds: string[] }
export interface IntakeView {
  runId: string;
  cleanStatus: "cleaned" | "served_raw";
  facts: IntakeFact[];
  /** How many candidates were not facts (duplicates are noted; paraphrases are never shown as facts). */
  duplicates: number;
  citations: IntakeCitation[];
  /** Lines intake left out of the facts (#437: the heading/caption, repeated page lines, lines with no words): how many, and whether any of them contains a digit. */
  leftOut: number;
  leftOutHasDigit: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The intake answer as the app uses it, or null for an answer off the contract (shown as the generic could-not-read line, never guessed at). */
export function parseIntake(raw: unknown): IntakeView | null {
  if (!isObj(raw) || typeof raw.run_id !== "string" || !isObj(raw.bundle)) return null;
  const b = raw.bundle;
  if (!Array.isArray(b.facts) || !Array.isArray(b.citations)) return null;
  const facts: IntakeFact[] = [];
  for (const f of b.facts) {
    if (!isObj(f) || typeof f.id !== "string" || typeof f.text !== "string") return null;
    facts.push({ id: f.id, text: f.text, status: f.status === "raw_fallback" ? "raw_fallback" : "span" });
  }
  const citations: IntakeCitation[] = [];
  for (const c of b.citations) {
    if (!isObj(c) || typeof c.text !== "string") return null;
    citations.push({ text: c.text, verifierStatus: typeof c.verifier_status === "string" ? c.verifier_status : "NOT_CHECKED", factIds: Array.isArray(c.fact_ids) ? c.fact_ids.filter((x): x is string => typeof x === "string") : [] });
  }
  const dups = Array.isArray(b.not_citable) ? b.not_citable.filter((n) => isObj(n) && n.status === "duplicate").length : 0;
  // #437 reports what it left out as not_citable entries with status caption / repeated_line / no_words and the cleaned-text span; the digit test is computed here from that span.
  const cleaned = typeof b.cleaned === "string" ? b.cleaned : "";
  let leftOut = 0;
  let leftOutHasDigit = false;
  if (Array.isArray(b.not_citable)) {
    for (const n of b.not_citable) {
      if (!isObj(n)) continue;
      const known = n.status === "caption" || n.status === "repeated_line" || n.status === "no_words";
      const spanned = typeof n.cleaned_start === "number" && typeof n.cleaned_end === "number";
      const statusMissing = typeof n.status !== "string" && spanned; // an excluded span the engine did not name: counted, and it fires the digit line (R1: fail towards telling)
      if (!known && !statusMissing) continue;
      leftOut++;
      // R1 (14 Oct): the digit line fires for a repeated line or a line with no words that holds a digit, never for the caption (a header always carries dates and case numbers), and for a span with no status
      if (n.status === "caption") continue;
      if (statusMissing || (spanned && /\d/.test(cleaned.slice(n.cleaned_start as number, n.cleaned_end as number)))) leftOutHasDigit = true;
    }
  }
  return { runId: raw.run_id, cleanStatus: b.clean_status === "served_raw" ? "served_raw" : "cleaned", facts, duplicates: dups, citations, leftOut, leftOutHasDigit };
}

// ---- R1's plain sentences (14 Oct, exact) ----
export const INTAKE_SIGNED_IN_ONLY = "Intake is offered only to signed-in users.";
export const INTAKE_SERVED_RAW = "We could not clean this text safely, so your original text is shown.";
export const INTAKE_RAW_FALLBACK = "Shown as you wrote it.";
export const INTAKE_DUPLICATE = "Same as an earlier fact; not counted again.";
export const INTAKE_LIMIT_SENTENCE = "Intake only joins broken lines, removes repeated page headers and tidies spacing; it never changes a number.";
export const CITATION_FOUND = "Found in our index";
export const CITATION_NOT_FOUND = "Not found in our index: this does not show whether the citation is real";
export const CITATION_UNAVAILABLE = "The citation check was unavailable for this citation.";
export const CITATION_NOT_CHECKED = "Not checked.";

/** One plain line for a citation's machine status; a status this build does not know reads "Not checked." (never a guess). */
export function citationLine(status: string): string {
  switch (status) {
    case "IN_INDEX":
    case "VERIFIED":
      return CITATION_FOUND;
    case "NOT_IN_INDEX":
      return CITATION_NOT_FOUND;
    case "CHECK_UNAVAILABLE":
      return CITATION_UNAVAILABLE;
    default:
      return CITATION_NOT_CHECKED;
  }
}
