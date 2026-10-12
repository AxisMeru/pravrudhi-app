// The opt-in frontier reader (Lead-2's F3 ruling, 8 Oct): off by default, advisory only, switched on server-side by an organisation admin with the
// organisation's own key. Its output NEVER changes a screening status: it is a separate column. This is the one place on the Screening page that says
// "quote": a frontier model writes words, and the engine checks them against the user's facts mechanically. The house path says "cites your fact".
// Every field below is optional on the wire (the engine fields are not all there yet) and nothing is invented for a missing one.

import { QUOTE_CHECK_TEXT } from "./reasonText";

export const FRONTIER_TOGGLE_LABEL = "Use a frontier model as an additional reader";

/** Shown beside a disabled toggle when the engine gave no reason of its own. Plain; never an error. */
export const FRONTIER_UNAVAILABLE_TEXT = "Not available: this deployment has not switched the frontier reader on.";

export const FRONTIER_ADVISORY_TEXT = "Advisory only: the frontier reader never changes a status above.";

export const QUOTE_PASSED_TEXT = "passed the quote check";
export const QUOTE_NOT_FOUND_TEXT = "quote not found in your facts";

/** The consent line shown at the toggle. `provider` is the name the engine reports; without one the line names no vendor of its own. */
export function consentLine(provider?: string | null): string {
  const name = typeof provider === "string" && provider.trim() ? provider.trim() : "the provider your organisation has configured";
  return `Your facts will be sent to ${name} under your organisation's key.`;
}

export interface FrontierToggleState {
  /** The checkbox is usable only when the engine says the reader is available. */
  disabled: boolean;
  /** What is checked: never true while disabled, so a stale value cannot send facts to a model. */
  checked: boolean;
  /** The plain reason shown while disabled; null when the toggle is usable. */
  reason: string | null;
  /** The consent line, shown only once the toggle is switched on. */
  consent: string | null;
}

export function frontierToggleState(input: { available?: boolean | null; value: boolean; reason?: string | null; provider?: string | null }): FrontierToggleState {
  const usable = input.available === true;
  if (!usable) {
    const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim() : FRONTIER_UNAVAILABLE_TEXT;
    return { disabled: true, checked: false, reason, consent: null };
  }
  return { disabled: false, checked: input.value, reason: null, consent: input.value ? consentLine(input.provider) : null };
}

/** The label for a frontier quote's check: the two decided phrases, the signed sentence for any other known code, an unknown code as sent. */
export function quoteCheckLabel(check: string | null | undefined): string {
  const code = (check ?? "").trim();
  if (code === "ok") return QUOTE_PASSED_TEXT;
  if (code === "quote_not_found") return QUOTE_NOT_FOUND_TEXT;
  if (Object.prototype.hasOwnProperty.call(QUOTE_CHECK_TEXT, code)) return QUOTE_CHECK_TEXT[code];
  return code ? `The quote check gave a result this app does not recognise yet ("${code}").` : "The quote was not checked.";
}

export interface FrontierReading {
  status?: string | null;
  fact_id?: string | null;
  quote?: string | null;
  quote_check?: string | null;
}

export interface FrontierCell {
  /** What the frontier reader said about the condition, in words that claim nothing the engine did not check. */
  claim: string;
  quote: string | null;
  /** Null when there is no quote to check. */
  check: { text: string; passed: boolean } | null;
}

export function frontierCell(reading: FrontierReading | null | undefined): FrontierCell | null {
  if (!reading) return null;
  const status = (reading.status ?? "").trim();
  const claim =
    status === "established"
      ? "The frontier reader says this condition is shown."
      : status === "not_established"
        ? "The frontier reader does not find this condition shown."
        : status
          ? `The frontier reader gave a status this app does not know ("${status}").`
          : "The frontier reader gave no status.";
  const quote = typeof reading.quote === "string" && reading.quote.trim() ? reading.quote : null;
  return {
    claim,
    quote,
    check: quote === null ? null : { text: quoteCheckLabel(reading.quote_check), passed: (reading.quote_check ?? "").trim() === "ok" },
  };
}
