// The words the law-firm surface shows around a result, and the small pure helpers behind the statute view and the
// per-contract "not validated" badge. Kept out of the components so a reviewer reads every claim-bearing string in one
// file and a test can hold the do-not-claim list against it (Lead-2 decision on #525, 2026-10-06).

import { STATUTE_NOTICE } from "@/lib/statuteNotice";

export const CAVEATS: readonly { id: string; text: string }[] = [
  {
    id: "model",
    text: "A model reads the facts you enter. Its output is not a court's finding and not legal advice; a lawyer decides.",
  },
  {
    id: "stack",
    text:
      "Each contract is handled by two judge models and a Lean check: the judge models read your facts and quote the " +
      "passages they rely on, and the Lean check confirms the right elements were addressed. The Lean check does not read " +
      "your facts or the quotes.",
  },
  {
    id: "validated",
    text:
      "\"Validated\" means the contract is on the engine registry's list of validated contracts. A contract that is not on " +
      "that list may refer to a lawyer or abstain, so verify; it is marked \"not validated, verify\". The mark is read from the " +
      "registry when this page loads; if the registry cannot be read, every contract is marked \"validation status " +
      "unavailable, verify\".",
  },
  { id: "statute", text: STATUTE_NOTICE },
];

export const NOT_VALIDATED_LABEL = "not validated, verify";
export const VALIDATION_UNAVAILABLE_LABEL = "validation status unavailable, verify";
export const WARMING_NOTE = "The analysis models are warming up; the first run can take a few minutes.";

export interface RegistryEntry {
  id: string;
  validated: boolean;
  sources?: string[] | null;
}

/** id -> validated. An id the registry did not list is absent, never assumed validated. */
export function validatedById(entries: readonly RegistryEntry[] | undefined | null): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const e of Array.isArray(entries) ? entries : []) {
    if (e && typeof e.id === "string") out.set(e.id, e.validated === true);
  }
  return out;
}

export type ValidationMark = "none" | "not-validated" | "unavailable";

/**
 * What to show beside a contract. Only a contract the registry positively lists as validated goes unmarked. A registry
 * that was not read (null: the read failed or has not finished) or that listed nothing is "unavailable": a missing mark
 * must never read as "validated" (R1, #51): the failure is shown, not hidden.
 */
export function validationMark(validated: ReadonlyMap<string, boolean> | null, contractId: string): ValidationMark {
  if (validated === null || validated.size === 0) return "unavailable";
  return validated.get(contractId) === true ? "none" : "not-validated";
}

export function validationLabel(mark: ValidationMark): string | null {
  return mark === "not-validated" ? NOT_VALIDATED_LABEL : mark === "unavailable" ? VALIDATION_UNAVAILABLE_LABEL : null;
}

export interface CitationRef {
  act: string;
  section: string | null;
  corpus_id: string | null;
  in_corpus: boolean;
  title: string | null;
}

/** The corpus search that names a section ("BNS section 69"): the engine's named-section match returns it first. */
export function citationQuery(c: CitationRef): string | null {
  return c.in_corpus && c.corpus_id && c.section ? `${c.act} section ${c.section}` : null;
}

export function pickCorpusHit<T extends { id: string }>(hits: readonly T[] | undefined | null, corpusId: string): T | null {
  return (Array.isArray(hits) ? hits : []).find((h) => h.id === corpusId) ?? null;
}

/** Strings the surface must never show (Lead-2's do-not-claim list): comparisons with other products, coverage or
 *  time-saved figures, "verified spans", "hallucination-free", legal correctness, anything on NI 138 proofs. */
export const DO_NOT_CLAIM: readonly RegExp[] = [
  /harvey|thomson|lexis|cocounsel|manupatra|scc online/i,
  /better than|faster than|outperform/i,
  /hallucination[- ]free|verified span|legally correct|guarantee/i,
  /saves? (you )?(hours?|time)|\d+\s*(hours?|minutes?) saved|\d+\s*%/i,
  /\bNI\s*138\b|negotiable instruments|cheque|dishonou?r/i,
];

// Before-you-submit notice (design-partner audit gap 1). The text is the engine's own RETENTION_NOTICE, word for word (drift test against
// fixtures/engineRetentionNotice.json); the page used to show it only after a result came back.
export const PRE_SUBMIT_RETENTION = "Don't submit real names or case details; anonymous submissions are kept up to 7 days for audit and are never used for training or evaluation.";
// Replaces "Files are read in your browser and never uploaded.", which read as if the text were not sent either.
export const FILE_NOTE =
  "The file itself is not uploaded; the text read from it, like any text you type, is sent to the engine when you press Analyse. Review and edit it first.";
// Under a result, only where the Citation check is offered (its nav flag).
export const CITATION_NEXT_STEP = "To check a citation, use Citation check.";
// Citation check: R1's text (checked against engine v0.5.46). The API-key and audit detail belongs in the API docs, not on this page.
export const CITATION_RETENTION = "The citation check does not save the citation or the quote you enter.";
