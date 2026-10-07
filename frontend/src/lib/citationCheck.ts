// The citation check (#539): POST /api/v1/verify-citations answers one of five fixed statuses and a fixed note. The status is shown VERBATIM as the
// engine sent it, never reworded and never turned into a verdict about the citation; the page carries a "preview" label until the accuracy study reports. The engine's note is shown as sent, except that a note containing the word "fake" is not shown (the product never says it; see NOTE_BANNED).

import { ApiError } from "./api";
import { CITATION_ERROR_TEXT, SERVICE_ERROR_TEXT, SESSION_401_TEXT } from "./signedStrings";

export const CITATION_CHECK_TITLE = "Citation check";
export const PREVIEW_LABEL = "preview: accuracy not yet measured";

/** The five statuses the engine can return (application/verify.py VerifyResult), in the engine's order. */
export const VERIFY_STATUSES = ["VERIFIED", "EXISTS_QUOTE_NOT_FOUND", "NOT_IN_INDEX", "MALFORMED", "CONFLICT"] as const;
export type VerifyStatus = (typeof VERIFY_STATUSES)[number];

export interface VerifyReply {
  result: string;
  note: string;
}

/** Words the product never uses in its own text; an engine note that carries one is withheld rather than reworded. */
const NOTE_BANNED = /\bfake\b/i;

export interface VerifyView {
  /** The status as the engine sent it (an unknown one is shown as sent, flagged). */
  status: string;
  known: boolean;
  /** The engine's note, or null when it is withheld. */
  note: string | null;
  noteWithheld: boolean;
}

export function verifyView(reply: VerifyReply): VerifyView {
  const status = typeof reply.result === "string" ? reply.result.trim() : "";
  const note = typeof reply.note === "string" ? reply.note.trim() : "";
  const withheld = !note || NOTE_BANNED.test(note);
  return { status, known: (VERIFY_STATUSES as readonly string[]).includes(status), note: withheld ? null : note, noteWithheld: withheld && !!note };
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
