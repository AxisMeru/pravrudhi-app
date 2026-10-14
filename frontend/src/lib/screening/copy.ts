// Every NEW user-visible string of the Screening view lives here, so R1 reviews one list before any push (O8, #830). Strings the view reuses
// (signed REFER and element texts, the cited-fact notes) are NOT repeated here. Rules: never "proved" or "established" at row level, never
// "verbatim", never "the offence is made out", never advice; "Needs your review" is never styled as an error.
/** The three export buttons under the checklist; the guide names them with these same strings. */
export const EXPORT_LABELS = { memo: "Download memo (.md)", print: "Print / save as PDF", runRecord: "Download run record (.json)" } as const;

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
/** One phrase for a denial, in both views and the memo (R1, #97; reaffirmed 13 Oct): a DENIAL is a fact the judge found that may defeat the claim, never "not established". */
export const DEFENCE_PHRASE = "a fact that may defeat the claim";
export const DEFENCE_HEADING = DEFENCE_PHRASE.charAt(0).toUpperCase() + DEFENCE_PHRASE.slice(1);
/** R1's value wording (Lead-2 decision 5, 13 Oct), shown wherever a defence is shown (checklist, memo, guide, Matters). One constant, no digits. */
export const DEFENCE_PROMPT_NOTE = "Facts that may defeat the claim are shown as prompts for your review, not as findings.";
/** Beside an offence whose contracts are not on the validated list (#99): the engine refers on them. */
export const NOT_VALIDATED_OFFENCE_NOTE = "Not on the validated list: for this offence the screening does not give a result; a lawyer decides.";
export const NO_CHECK_NOTE = "This ingredient is not screened yet; a lawyer should read the facts for it.";

/** The standing line beside every summary banner. */
export const BANNER_STANDING_LINE = "This is a screening aid, not legal advice. A lawyer decides.";
/** R1, 14 Oct: on an example screen the banner is an agenda, with no counts. */
export const SAMPLE_BANNER_TEXT = "Review agenda: what each ingredient needs, and which facts to look for.";
/** R1, 14 Oct: on a user's own run, shown with the banner when no ingredient is supported by a cited fact. */
export const NONE_SUPPORTED_LINE =
  "None of these ingredients is supported by a cited fact in what you gave. Below is what each one needs, and the kind of fact to look for.";
/** For the four offences the engine judges through their IPC-family contracts: the BNS counterpart is not on the validated list (R1, 8 Oct; #825). */
export function ipcDisclosure(ipcSection: string): string {
  return `Checked against the IPC text (s.${ipcSection}); the BNS counterpart is not validated.`;
}
/** Shown below the standing line whenever the all-supported line is shown: what the structure check is (R1, 8 Oct). */
export const STRUCTURE_NOTE = "A Lean check confirmed the right ingredients were addressed; it does not read your facts.";
export const ALL_SUPPORTED_TEXT = "All ingredients supported (structure checked)";

/**
 * The summary line (R1, 13 Oct, for #115): it names every state in the row vocabulary, in this order, joined with " · ": supported of total always, then (only when the
 * count is not 0) suggested, needs your review, not supported, and facts that may defeat the claim. No "established", "proved" or "made out".
 */
export function bannerText(supported: number, total: number, suggested: number, review: number, notSupported: number, defences: number): string {
  const parts = [`${supported} of ${total} ingredients supported by a fact`];
  if (suggested > 0) parts.push(`${suggested} suggested by the screening judge (check it)`);
  if (review > 0) parts.push(`${review} ${review === 1 ? "needs" : "need"} your review`);
  if (notSupported > 0) parts.push(`${notSupported} not supported by these facts`);
  if (defences > 0) parts.push(`${defences} ${defences === 1 ? "fact" : "facts"} that may defeat the claim`);
  return parts.join(" · ");
}

export const CONTRACT_REVIEW_HEADING = "Needs your review";
