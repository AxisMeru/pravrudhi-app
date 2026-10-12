// The citation check (#539): POST /api/v1/verify-citations answers one of five fixed statuses and a fixed note. The status is shown VERBATIM as the
// engine sent it, never reworded and never turned into a verdict about the citation; the page carries a "preview" label until the accuracy study reports. The engine's note is shown as sent, except that a note containing the word "fake" is not shown (the product never says it; see NOTE_BANNED).

import { ApiError } from "./api";
import { CITATION_ERROR_TEXT, SERVICE_ERROR_TEXT, SESSION_401_TEXT } from "./signedStrings";

export const CITATION_CHECK_TITLE = "Citation check";
export const PREVIEW_LABEL = "preview: accuracy not yet measured";

/** The five statuses the engine can return (application/verify.py VerifyResult), in the engine's order. */
export const VERIFY_STATUSES = ["VERIFIED", "EXISTS_QUOTE_NOT_FOUND", "IN_INDEX", "NOT_IN_INDEX", "MALFORMED", "CONFLICT"] as const;
export type VerifyStatus = (typeof VERIFY_STATUSES)[number];

export interface VerifyReply {
  result: string;
  note: string;
  /** Product status fields the engine adds (#533, additive; absent on an engine that predates them). */
  status?: string;
  label?: string;
  preview?: boolean;
  verified?: boolean;
}

/**
 * The product status wording (#533) is wired but OFF: it shows only when the build sets NEXT_PUBLIC_CITATION_PRODUCT_STATUS=1 AND the engine
 * sent the fields. Off, the page shows the engine's `result` and `note` exactly as before. The engine's mapping is the only place wording is made.
 */
export const PRODUCT_STATUS_ENABLED = process.env.NEXT_PUBLIC_CITATION_PRODUCT_STATUS === "1";

/** The product statuses the engine can send (application/citation_status.py), in its order. */
export const PRODUCT_STATUSES = ["verified", "quote_not_found", "in_index", "not_in_index", "conflict", "malformed"] as const;
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
  /** The status as the engine sent it (an unknown one is shown as sent, flagged). */
  status: string;
  known: boolean;
  /** The engine's note, or null when it is withheld. */
  note: string | null;
  noteWithheld: boolean;
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

export function verifyView(reply: VerifyReply, enabled: boolean = PRODUCT_STATUS_ENABLED): VerifyView {
  const status = typeof reply.result === "string" ? reply.result.trim() : "";
  const note = typeof reply.note === "string" ? reply.note.trim() : "";
  const withheld = !note || NOTE_BANNED.test(note);
  return {
    status,
    known: (VERIFY_STATUSES as readonly string[]).includes(status),
    note: withheld ? null : note,
    noteWithheld: withheld && !!note,
    product: productStatus(reply, enabled),
  };
}

export type VerifyErrorKind = "timeout" | "cancelled" | "rate_limited" | "signed_out" | "index_unavailable" | "at_capacity" | "server" | "network";

/** The page's message for a failed check: the signed sentence for each coded refusal, the existing wording for the generic cases. */
export function classifyVerifyError(e: unknown): { kind: VerifyErrorKind; message: string } {
  const name = (e as { name?: string } | null)?.name;
  if (name === "TimeoutError") return { kind: "timeout", message: CITATION_ERROR_TEXT.verify_timeout };
  if (name === "AbortError") return { kind: "cancelled", message: "Citation check cancelled." };
  if (e instanceof ApiError) {
    if (e.status === 429) {
      const wait = e.retryAfter ? ` Seconds to wait: ${e.retryAfter}.` : "";
      return { kind: "rate_limited", message: `${SERVICE_ERROR_TEXT.rate_limited}${wait}` };
    }
    if (e.status === 401) return { kind: "signed_out", message: SESSION_401_TEXT };
    if (e.status === 503 && e.code === "verify_timeout") return { kind: "timeout", message: CITATION_ERROR_TEXT.verify_timeout };
    if (e.status === 503 && e.code === "verify_at_capacity") return { kind: "at_capacity", message: CITATION_ERROR_TEXT.verify_at_capacity };
    if (e.status === 503 && e.code === "citation_index_unavailable") return { kind: "index_unavailable", message: CITATION_ERROR_TEXT.citation_index_unavailable };
    return { kind: "server", message: `The engine answered with an error (HTTP ${e.status}). No result was returned.` };
  }
  return { kind: "network", message: "Could not reach the engine. Check your connection and try again." };
}

/** Limits the engine enforces on the request (api/partner.py VerifyCitationRequest). */
export const CITATION_MAX = 500;
export const QUOTE_MAX = 4000;

export function checkInputs(citation: string, quote: string): { ok: true } | { ok: false; message: string } {
  if (!citation.trim()) return { ok: false, message: "Enter one citation." };
  if (!quote.trim()) return { ok: false, message: "Enter the quote to look for." };
  if (citation.length > CITATION_MAX) return { ok: false, message: `The citation is longer than ${CITATION_MAX} characters.` };
  if (quote.length > QUOTE_MAX) return { ok: false, message: `The quote is longer than ${QUOTE_MAX} characters.` };
  return { ok: true };
}
