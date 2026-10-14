// Plain-language text for the contract reasons that are not referrals, for the quote check on an element, and for which
// judge's threshold an element failed. The words come from the team's signed partner string table (R1's wording check
// applied); each says what the judge or the code DID, never the fact itself. No Sanskrit label reaches a partner.
// referReason.ts keeps the referral reasons. A code this build does not know is shown as itself, never reworded.

export const NON_REFER_REASON_TEXT: Readonly<Record<string, string>> = {
  all_elements_established:
    "The screening found a cited fact for every ingredient this provision requires.",
  denial_established: "The screening found a fact in your case that may defeat this claim, and cited it.",
  missing_element: "The screening did not find a cited fact for at least one required ingredient.",
  no_training_statute_text: "We have no statute text for this provision, so we did not screen it.",
  judge_error: "The screening could not complete this check. Please try again, or have a lawyer look.",
  assembly_lean_mismatch: "Two checks inside the screening disagreed, so we hand this ingredient back to you.",
};

/** The plain sentence for a PROOF / DENIAL / ABSTAIN reason code, or null when this build does not know it. */
export function nonReferReasonText(reason: string | null | undefined): string | null {
  const key = (reason ?? "").trim();
  return Object.prototype.hasOwnProperty.call(NON_REFER_REASON_TEXT, key) ? NON_REFER_REASON_TEXT[key] : null;
}

export const QUOTE_CHECK_TEXT: Readonly<Record<string, string>> = {
  ok: "The cited text appears exactly once in the fact named (the quoted words, or, when only the fact is named, the fact itself).",
  not_established: "The screening did not find this condition shown in your facts.",
  no_quote: "The screening said this condition holds but gave no words to show it.",
  unknown_fact: "The screening pointed to a fact that is not among yours.",
  empty_quote: "The screening's quote was empty.",
  non_evidential_quote: "The screening's quote was too short or only punctuation to count as evidence.",
  quote_not_found:
    "The screening's quote does not appear word for word (same capital letters and spacing) in the fact it named.",
  ambiguous_quote:
    "The screening's quote appears more than once in that fact, so we cannot tell which passage it meant. The condition is not counted as shown.",
};

export interface QuoteCheckPresentation {
  /** Whether the cause is worth showing: a rejected or absent quote. `ok` needs no explanation. */
  show: boolean;
  text: string;
  /** True when the engine sent a code this build does not know; the text then names the raw code. */
  unknown: boolean;
}

export function quoteCheckPresentation(code: string | null | undefined): QuoteCheckPresentation | null {
  const raw = (code ?? "").trim();
  if (!raw) return null;
  if (Object.prototype.hasOwnProperty.call(QUOTE_CHECK_TEXT, raw)) return { show: raw !== "ok", text: QUOTE_CHECK_TEXT[raw], unknown: false };
  return { show: true, text: `The check of the cited text gave a result this app does not recognise yet ("${raw}").`, unknown: true };
}

/** Which judge's confidence threshold a non-established element failed (`binding_leg`), in plain words; null for anything else. */
export function bindingLegText(leg: string | null | undefined): string | null {
  if (leg === "primary") return "Not supported at the first check's confidence threshold.";
  if (leg === "second") return "Not supported at the second check's confidence threshold.";
  return null;
}
