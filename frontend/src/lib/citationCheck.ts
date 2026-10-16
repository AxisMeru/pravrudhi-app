// The citation check (#539): POST /api/v1/verify-citations answers one of five fixed statuses and a fixed note. The status is shown VERBATIM as the
// engine sent it, never reworded and never turned into a verdict about the citation; the page carries a "preview" label until the accuracy study reports. The engine's note is shown as sent, except that a note containing the word "fake" is not shown (the product never says it; see NOTE_BANNED).

import { INTERNAL_ERROR_LINE, internalErrorLine, isInternalError } from "./internalError";
import { ApiError } from "./api";
import { CASE_NAME_NOT_COMPARED, CITATION_EXISTENCE_ONLY, CONFLICT_HEADING, NAME_MISMATCH_HEADING, NAME_MISMATCH_TEXT, UNKNOWN_STATUS_HEADING, UNKNOWN_STATUS_TEXT, CONFLICT_TEXT, CONFLICT_TEXT_WITH_NAME, DETAIL_422_TEXT, IN_INDEX_LABEL, MALFORMED_HEADING, MALFORMED_TEXT, NOT_IN_INDEX_NOTE, QUOTE_NOT_SERVED_TEXT, SIGNED_OUT_401_TEXT } from "./citationExistence";
import { CITATION_ERROR_TEXT, SERVICE_ERROR_TEXT, SESSION_401_TEXT } from "./signedStrings";

export const CITATION_CHECK_TITLE = "Citation check";
export const PREVIEW_LABEL = "preview: existence check only";

/** The five statuses the engine can return (application/verify.py VerifyResult), in the engine's order. */
export const VERIFY_STATUSES = ["VERIFIED", "EXISTS_QUOTE_NOT_FOUND", "IN_INDEX", "NOT_IN_INDEX", "MALFORMED", "CONFLICT", "NAME_MISMATCH"] as const;
export type VerifyStatus = (typeof VERIFY_STATUSES)[number];

export interface VerifyReply {
  result: string;
  note: string;
  /** Product status fields the engine adds (#533, additive; absent on an engine that predates them). */
  status?: string;
  label?: string;
  preview?: boolean;
  verified?: boolean;
  /** pravrudhi#509: present and true ONLY when the engine compared the typed case name with the index (IN_INDEX = matched, or NAME_MISMATCH); absent on older engines, when no name was typed, and on other results. */
  name_compared?: boolean;
}

/**
 * The product status wording (#533) is wired but OFF: it shows only when the build sets NEXT_PUBLIC_CITATION_PRODUCT_STATUS=1 AND the engine
 * sent the fields. Off, the page shows the engine's `result` and `note` exactly as before. The engine's mapping is the only place wording is made.
 */
export const PRODUCT_STATUS_ENABLED = process.env.NEXT_PUBLIC_CITATION_PRODUCT_STATUS === "1";

/** The product statuses the engine can send (application/citation_status.py), in its order. */
export const PRODUCT_STATUSES = ["verified", "quote_not_found", "in_index", "not_in_index", "conflict", "malformed", "name_mismatch"] as const;
/** Words that never appear in a status label shown by this page. */
const LABEL_BANNED = /\b(fake|fabricated|hallucinated|invalid|false)\b/i;

/** The one product status each engine result maps to (application/citation_status.py); a reply whose pair differs is not shown as a product status. */
const RESULT_TO_STATUS: Record<string, string> = {
  VERIFIED: "verified",
  EXISTS_QUOTE_NOT_FOUND: "quote_not_found",
  IN_INDEX: "in_index",
  NOT_IN_INDEX: "not_in_index",
  CONFLICT: "conflict",
  MALFORMED: "malformed",
  NAME_MISMATCH: "name_mismatch",
};
/** Positive-claim words; a label carrying one anywhere is refused on every status but "verified". */
const LABEL_POSITIVE = /\b(verif\w*|confirm\w*|authentic\w*|genuine|valid|correct|accurate|real|exists?|resolves?|appears)\b/;
/**
 * The ONE sanctioned exception to the positive-claim guard (#832, R1): the engine's existence-only label says the word "verification" only to deny it
 * ("... so this is not a verification."). It is accepted for status in_index when it matches the engine's text exactly (fixtures/engineCitationLabels.json
 * pins this copy to the engine), and nothing else is exempt: any other label, or the same words on another status, is still refused.
 */
export const IN_INDEX_ENGINE_LABEL = "Found in the index (existence only): no quote was checked, so this is not a verification.";
/** Case, width and invisible-character tricks must not slip a banned or positive word past the guards. */
const foldLabel = (label: string): string => label.normalize("NFKC").replace(/[\p{Cf}]/gu, "").toLowerCase();

/** Words the product never uses in its own text; an engine note that carries one is withheld rather than reworded. */
const NOTE_BANNED = /\bfake\b/i;

export interface ProductStatus {
  status: string;
  label: string;
  /** Always true while the preview badge applies; the page shows the badge whenever this is not explicitly false. */
  preview: boolean;
}

export interface VerifyView {
  /** The product status and label, only when the product status is enabled and the engine's fields passed every check; else null. */
  product: ProductStatus | null;
  /** The status as the engine sent it (kept in the data; an unknown one is never printed raw: the page shows R1's neutral heading and sentence). */
  status: string;
  known: boolean;
  /** The engine's note, or null when it is withheld. */
  note: string | null;
  noteWithheld: boolean;
  /** #509: the sentence shown after the note on a found line that carries a case name (R1: "not compared", or "compared, except common words" when name_compared is true); null otherwise (a bare citation, any other status, the arm off). */
  nameNote: string | null;
}

/**
 * The product status for a reply, or null. Fail closed: the flag must be on; the status must be one of the six; the label must be non-empty and
 * free of the banned words; a positive-claim word (verified, confirmed, exists, ...) may appear in a label ONLY for status "verified"; `result` and `status` must be the engine's own pair; `verified` must agree with the status. Anything
 * else falls back to the engine's `result` and `note`, never to a positive wording.
 */
export function productStatus(reply: VerifyReply, enabled: boolean = PRODUCT_STATUS_ENABLED): ProductStatus | null {
  if (!enabled) return null;
  const status = typeof reply.status === "string" ? reply.status.trim() : "";
  const label = typeof reply.label === "string" ? reply.label.trim() : "";
  if (!(PRODUCT_STATUSES as readonly string[]).includes(status) || !label) return null;
  const folded = foldLabel(label);
  if (LABEL_BANNED.test(folded)) return null;
  const sanctioned = status === "in_index" && folded === foldLabel(IN_INDEX_ENGINE_LABEL);
  if (status !== "verified" && !sanctioned && LABEL_POSITIVE.test(folded)) return null;
  if (RESULT_TO_STATUS[reply.result] !== status) return null;
  if (status === "verified" ? reply.verified === false : reply.verified === true) return null;
  return { status, label, preview: reply.preview !== false };
}

/** R1 14 Oct (#128 D4): the code token NOT_IN_INDEX stays in the data and never on screen; the result is shown as this label. Every other status is shown as the engine sent it. */
export const NOT_IN_INDEX_LABEL = "Not found in our index";
/** While the index is existence-only (flag): CONFLICT and MALFORMED have plain headings (#223 D2a) and IN_INDEX reads "Found in our index"; every other status is as before. */
export const statusLabel = (status: string, existenceOnly: boolean = CITATION_EXISTENCE_ONLY): string =>
  status === "NOT_IN_INDEX"
    ? NOT_IN_INDEX_LABEL
    : status === "NAME_MISMATCH"
      ? NAME_MISMATCH_HEADING
      : status !== "" && !(VERIFY_STATUSES as readonly string[]).includes(status)
        ? UNKNOWN_STATUS_HEADING // never the raw token (R1, 16 Oct)
        : existenceOnly && status === "CONFLICT"
          ? CONFLICT_HEADING
          : existenceOnly && status === "MALFORMED"
            ? MALFORMED_HEADING
            : existenceOnly && status === "IN_INDEX"
              ? IN_INDEX_LABEL
              : status;

/**
 * app#347 (R1's rule, no engine change): the citation names a case iff the text before its "(year)" part contains " v. ", " v ", " vs. " or " versus " (case-insensitive). Anything else, and any doubt
 * (no "(year)" part, an empty line, a non-string), counts as absent.
 */
export function citationHasCaseName(line: unknown): boolean {
  if (typeof line !== "string") return false;
  const year = /\(\s*\d{4}\s*\)/.exec(line);
  if (!year) return false;
  return /\s(?:v\.?|vs\.?|versus)\s/i.test(line.slice(0, year.index) + " ");
}

/** pravrudhi#509 (R1): the case-name sentence for a found citation, by the same rule as #350 (citationHasCaseName); existence-only arm and IN_INDEX only. One rule for /citations, the panel and Intake. */
export function caseNameNote(status: string, citation: unknown, existenceOnly: boolean = CITATION_EXISTENCE_ONLY, nameCompared?: unknown): string | null {
  if (!existenceOnly || !citationHasCaseName(citation)) return null;
  // the engine says EVERY typed party matched (name_compared true only then, 0.6.19 three-state): nothing to add; absent or any non-true value (no name compared, or only partly matched) keeps R1's "not confirmed" sentence
  if (nameCompared === true) return null;
  return status === "IN_INDEX" || status === "VERIFIED" ? CASE_NAME_NOT_COMPARED : null;
}

export function verifyView(reply: VerifyReply, enabled: boolean = PRODUCT_STATUS_ENABLED, existenceOnly: boolean = CITATION_EXISTENCE_ONLY, citation?: string): VerifyView {
  const status = typeof reply.result === "string" ? reply.result.trim() : "";
  const note = typeof reply.note === "string" ? reply.note.trim() : "";
  const withheld = !note || NOTE_BANNED.test(note);
  // Existence-only index (R1 14 Oct): the engine's note "The case was not found in our index" is inexact under the stricter match rule (several matches or a longer title also give NOT_IN_INDEX), so R1's note replaces it.
  const override = existenceOnly && status === "NOT_IN_INDEX";
  // #223 (R1, 15 Oct): with the arm ON a CONFLICT and a MALFORMED each show R1's sentence under their plain heading; the engine's notes ("maps to conflicting indexed cases; verify by hand", "Exactly one parseable citation is required.") are replaced.
  const explained = existenceOnly && (status === "CONFLICT" || status === "MALFORMED");
  const mismatch = status === "NAME_MISMATCH";
  const unknown = status !== "" && !(VERIFY_STATUSES as readonly string[]).includes(status);
  const explanation = status === "CONFLICT" ? (citationHasCaseName(citation) ? CONFLICT_TEXT_WITH_NAME : CONFLICT_TEXT) : MALFORMED_TEXT;
  return {
    status,
    known: (VERIFY_STATUSES as readonly string[]).includes(status),
    note: mismatch ? NAME_MISMATCH_TEXT : unknown ? UNKNOWN_STATUS_TEXT : override ? NOT_IN_INDEX_NOTE : explained ? explanation : withheld ? null : note,
    noteWithheld: !mismatch && !unknown && !override && !explained && withheld && !!note,
    nameNote: caseNameNote(status, citation, existenceOnly, reply.name_compared),
    product: productStatus(reply, enabled),
  };
}

export type VerifyErrorKind = "quote_not_served" | "invalid_request" | "timeout" | "cancelled" | "rate_limited" | "signed_out" | "index_unavailable" | "at_capacity" | "server" | "network";

/** The page's message for a failed check: the signed sentence for each coded refusal, the existing wording for the generic cases. */
export function classifyVerifyError(e: unknown, existenceOnly: boolean = CITATION_EXISTENCE_ONLY, internalLine: string | null = INTERNAL_ERROR_LINE): { kind: VerifyErrorKind; message: string } {
  const name = (e as { name?: string } | null)?.name;
  if (name === "TimeoutError") return { kind: "timeout", message: CITATION_ERROR_TEXT.verify_timeout };
  if (name === "AbortError") return { kind: "cancelled", message: "Citation check cancelled." };
  if (e instanceof ApiError) {
    if (e.status === 429) {
      const wait = e.retryAfter ? ` Seconds to wait: ${e.retryAfter}.` : "";
      return { kind: "rate_limited", message: `${SERVICE_ERROR_TEXT.rate_limited}${wait}` };
    }
    if (e.status === 401) return { kind: "signed_out", message: existenceOnly ? SIGNED_OUT_401_TEXT : SESSION_401_TEXT };
    if (e.status === 503 && e.code === "verify_timeout") return { kind: "timeout", message: CITATION_ERROR_TEXT.verify_timeout };
    if (e.status === 503 && e.code === "verify_at_capacity") return { kind: "at_capacity", message: CITATION_ERROR_TEXT.verify_at_capacity };
    if (e.status === 503 && e.code === "citation_index_unavailable") return { kind: "index_unavailable", message: CITATION_ERROR_TEXT.citation_index_unavailable };
    if (existenceOnly && e.status === 422) {
      // quote_not_served (a quote reached the existence-only index) or a validation detail (blank citation, over length): plain words, never the code
      return e.code === "quote_not_served" ? { kind: "quote_not_served", message: QUOTE_NOT_SERVED_TEXT } : { kind: "invalid_request", message: DETAIL_422_TEXT };
    }
    const generic = `The engine answered with an error (HTTP ${e.status}). No result was returned.`;
    return { kind: "server", message: isInternalError(e) ? internalErrorLine(generic, internalLine) : generic };
  }
  return { kind: "network", message: "Could not reach the engine. Check your connection and try again." };
}

/** Limits the engine enforces on the request (api/partner.py VerifyCitationRequest). */
export const CITATION_MAX = 500;
export const QUOTE_MAX = 4000;

export function checkInputs(citation: string, quote: string | null): { ok: true } | { ok: false; message: string } {
  if (!citation.trim()) return { ok: false, message: "Enter one citation." };
  // A null quote is an existence-only check (the panel sends it); an empty or blank one is still refused, never turned into null.
  if (quote !== null && !quote.trim()) return { ok: false, message: "Enter the quote to look for." };
  if (citation.length > CITATION_MAX) return { ok: false, message: `The citation is longer than ${CITATION_MAX} characters.` };
  if (quote !== null && quote.length > QUOTE_MAX) return { ok: false, message: `The quote is longer than ${QUOTE_MAX} characters.` };
  return { ok: true };
}

/** The example citation in the citation boxes (R1, 15 Oct): invented, with a future year so it cannot be a real entry. */
export const CITATION_PLACEHOLDER = "(2014) 8 SCC 273";
