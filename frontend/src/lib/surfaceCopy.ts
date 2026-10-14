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
      "Each offence is screened ingredient by ingredient: models read your facts and cite the facts they rely on, and a " +
      "separate structure check confirms the right ingredients were covered. The structure check does not read your facts.",
  },
  {
    id: "validated",
    text:
      "Offences marked \u201cvalidated\u201d are on our validated list. An offence not on that list is marked \u201cnot validated, verify\u201d: " +
      "the screening may refer it to a lawyer or decline to give a result, so check it yourself. The marks are read when the page loads; " +
      "if the list cannot be read, every offence is marked \u201cvalidation status unavailable, verify\u201d.",
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

// Before-you-submit notice, R1's text (13 Oct). It is written here, not copied from the engine: the engine's own retention_notice still carries a training promise
// the app does not enforce, so the app never displays it (CaveatStrip). The closing "Data handling" is rendered as a link to /data-handling (RetentionBefore).
export const PRE_SUBMIT_LINK_TEXT = "Data handling";
export const PRE_SUBMIT_RETENTION =
  "Run records are kept for up to 7 days. They are removed when the next analysis runs, and can disappear earlier. A run record can include the text of facts the screening marked as supported, so do not enter real names or case details unless your firm's setup allows it. More under Data handling.";
// Replaces "Files are read in your browser and never uploaded.", which read as if the text were not sent either.
export const FILE_NOTE =
  "The file itself is not uploaded; the text read from it, like any text you type, is sent to the engine when you press Analyse. Review and edit it first.";
// Under a result, only where the Citation check is offered (its nav flag).
export const CITATION_NEXT_STEP = "To check a citation, use Citation check.";
// Citation check: R1's text (checked against engine v0.5.46). The API-key and audit detail belongs in the API docs, not on this page.
export const CITATION_RETENTION = "The citation check does not save the citation or the quote you enter.";

/** Shown while a first analysis is warming up, on Screening and Matters. Figure-free: the only timing evidence is a handful of single calls (R1, R2, Goal, 12 Oct), so none is stated. */
export const WARM_UP_NOTE = "Warming up the screening and Lean checker — a first run after idle can take a few minutes while the models start.";
/** Shown instead of sending anything when the engine says this browser is not signed in (R1 reads, 12 Oct). The anonymous demo is only ever started by the user's own choice. */
export const SIGNING_IN_TEXT = "Signing you in…";
/** #151 (R1, 14 Oct): shown only between a fetch timeout and its single retry, cleared when the retry returns. */
export const TIMEOUT_RETRY_TEXT = "The screening is taking longer than usual to start. Trying once more.";
export const NOT_SIGNED_IN_TEXT = "You are not signed in, so nothing has been sent. Sign in to screen your facts, or choose the anonymous demo instead.";
/** When the sign-in check gets no answer: nothing is sent and there is no anonymous fallback (R2). */
export const SIGN_IN_UNVERIFIED_TEXT = "We could not check your sign-in, so nothing was sent. Try again in a moment.";
/** R1's final string (13 Oct, #114): the whole answer is unreadable (a listed field of the wrong type, or an unknown assertions key). Used on Screening and Matters; no second wording. */
export const INVALID_ENGINE_ANSWER_TEXT = "The engine's answer could not be read, so no result is shown. This says nothing about your facts. Try again, or ask a lawyer to review the matter.";
export const ANONYMOUS_DEMO_BUTTON = "Use the anonymous demo";
// The retention period is taken from the notice above (PRE_SUBMIT_RETENTION), not typed here.
const ANONYMOUS_RETENTION_PHRASE = PRE_SUBMIT_RETENTION.match(/kept for up to \d+ days/)?.[0] ?? "";
export const ANONYMOUS_DEMO_NOTE = `The anonymous demo is not tied to your account, shows no second-check detail, and what you submit is ${ANONYMOUS_RETENTION_PHRASE}.`;
export const SIGN_IN_LINK_TEXT = "Sign in";
