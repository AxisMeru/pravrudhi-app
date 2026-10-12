// Every NEW user-visible string of the Screening view lives here, so R1 reviews one list before any push (O8, #830). Strings the view reuses
// (signed REFER and element texts, the cited-fact notes) are NOT repeated here. Rules: never "proved" or "established" at row level, never
// "verbatim", never "the offence is made out", never advice; "Needs your review" is never styled as an error.
export type Chip = "supported" | "suggested" | "not_supported" | "review";

export const CHIP_LABEL: Readonly<Record<Chip, string>> = {
  supported: "Supported by a fact",
  // The screening signal is not a cited fact: its own chip, counted apart from the supported ingredients.
  suggested: "Suggested by the screening judge; check it",
  not_supported: "Not supported by these facts",
  review: "Needs your review",
};


export const SCREENING_TITLE = "Screening";
export const SCREENING_SUBTITLE =
  "Which ingredients of the alleged offence do your facts support, which do they not, and what to check before you rely on it.";
export const WHAT_TO_CHECK_LABEL = "What to check";
export const DEFENCE_HEADING = "A fact that may defeat the claim";
export const NO_CHECK_NOTE = "No prompt is written for this ingredient yet.";

/** The standing line beside every summary banner. */
export const BANNER_STANDING_LINE = "This is a screening aid, not legal advice. A lawyer decides.";
/** For the four offences the engine judges through their IPC-family contracts: the BNS counterpart is not on the validated list (R1, 8 Oct; #825). */
export function ipcDisclosure(ipcSection: string): string {
  return `Checked against the IPC text (s.${ipcSection}); the BNS counterpart is not validated.`;
}
/** Shown below the standing line whenever the all-supported line is shown: what the structure check is (R1, 8 Oct). */
export const STRUCTURE_NOTE = "A Lean check confirmed the right ingredients were addressed; it does not read your facts.";
export const ALL_SUPPORTED_TEXT = "All ingredients supported (structure checked)";

export function bannerText(supported: number, total: number, review: number): string {
  return `${supported} of ${total} ingredients have a supporting fact; ${review} need your review.`;
}

export const CONTRACT_REVIEW_HEADING = "Needs your review";
export const SEE_REASON = "reason";
