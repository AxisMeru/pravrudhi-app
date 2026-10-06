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
      "Two parts work on each contract: a judge model reads your facts and quotes the passages it relies on, and a Lean " +
      "structural check confirms the right elements were addressed. The Lean check does not read your facts or the quotes.",
  },
  {
    id: "validated",
    text:
      "A contract marked \"not validated, verify\" has not been validated; its answer is referred to a lawyer. The mark is " +
      "read from the engine's registry when this page loads.",
  },
  { id: "statute", text: STATUTE_NOTICE },
];

export const NOT_VALIDATED_LABEL = "not validated, verify";

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

/** Whether to mark a contract "not validated, verify": anything the registry did not positively list as validated. */
export function showNotValidated(validated: ReadonlyMap<string, boolean>, contractId: string): boolean {
  return validated.size > 0 && validated.get(contractId) !== true;
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
