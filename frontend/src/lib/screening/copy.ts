// Every NEW user-visible string of the Screening view lives here, so R1 reviews one list before any push (O8, #830). Strings the view reuses
// (signed REFER and element texts, the cited-fact notes) are NOT repeated here. Rules: never "proved" or "established" at row level, never
// "verbatim", never "the offence is made out", never advice; "Needs your review" is never styled as an error.
/** The three export buttons under the checklist; the guide names them with these same strings. */
/** R1, 14 Oct (P6): the export group is labelled "Download the memo" and holds Markdown, PDF and Word; the run record is a separate action. */
export const EXPORT_GROUP_LABEL = "Download the memo";
export const EXPORT_LABELS = { memo: "Markdown (.md)", print: "Print / save as PDF", runRecord: "Download run record (.json)" } as const;

/** The fourth export button (Word memo, 14 Oct; label for R1 to sign). Not in EXPORT_LABELS: the guide names those three exactly and needs R1's words (and a new screenshot) before it can say four. */
export const MEMO_DOCX_LABEL = "Word (.docx)";

export type Chip = "supported" | "suggested" | "not_supported" | "review";

export const CHIP_LABEL: Readonly<Record<Chip, string>> = {
  supported: "Supported by a fact",
  // The screening signal is not a cited fact: its own chip, counted apart from the supported ingredients.
  suggested: "Suggested by the screening judge; check it",
  // R1, 14 Oct: the screening cites no fact for these rows, which is exactly what the chip says; it is not a verdict.
  not_supported: "No fact cited",
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

/** R1, 14 Oct (P1): the label of the fold that holds the product line, the guide link and the caveat strip. */
export const ABOUT_SCREENING_LABEL = "About this screening";
/** R1, 14 Oct (P13): the entry to the examples; the choices under it are named by their citations as pinned. */
export const EXAMPLE_ENTRY_LABEL = "Try an example from a public court order";

/** The standing line beside every summary banner. */
export const BANNER_STANDING_LINE = "This is a screening aid, not legal advice. A lawyer decides.";
/** R1, 14 Oct: shown once on EVERY result where no ingredient is supported (own runs and examples), above the first block. */
export const AGENDA_BANNER_TEXT = "Review agenda: what each ingredient needs, and which facts to look for. Nothing here is a finding about your matter.";
/** R1, 14 Oct (#134): the group of ingredients for which no fact is cited. */
export const NO_FACT_GROUP_HEADING = "To look for in your papers";
/** R1, 14 Oct (#134): shown under the second block of an offence that has two ways of being made out. */
export const ALTERNATE_LIMB_NOTE = "This is another way the same offence can be made out. Each way is screened separately.";
/** For the four offences the engine judges through their IPC-family contracts: the BNS counterpart is not on the validated list (R1, 8 Oct; #825). */
export function ipcDisclosure(ipcSection: string): string {
  return `Checked against the IPC text (s.${ipcSection}); the BNS counterpart is not validated.`;
}
/** Shown below the standing line whenever the all-supported line is shown: what the structure check is (R1, 8 Oct). */
export const STRUCTURE_NOTE = "A Lean check confirmed the right ingredients were addressed; it does not read your facts.";
export const ALL_SUPPORTED_TEXT = "All ingredients supported (structure checked)";

/**
 * The summary line (R1, 14 Oct, strings A; replaces the 13 Oct "N of M ... K not supported by these facts" line). No supported ingredient: "No ingredient has a cited fact yet · M to look for".
 * Otherwise "N of M ingredients supported by a fact", then (only when the count is not 0) " · K to look for", " · S to check" for suggestions and " · R for your review",
 * then the defence count. No "established", "proved" or "made out".
 */
export function bannerText(supported: number, total: number, suggested: number, review: number, notSupported: number, defences: number): string {
  const parts = supported === 0 ? [`No ingredient has a cited fact yet · ${total} to look for`] : [`${supported} of ${total} ingredients supported by a fact`];
  if (supported > 0 && notSupported > 0) parts.push(`${notSupported} to look for`);
  if (supported > 0 && suggested > 0) parts.push(`${suggested} to check`);
  if (supported > 0 && review > 0) parts.push(`${review} for your review`);
  if (defences > 0) parts.push(`${defences} ${defences === 1 ? "fact" : "facts"} that may defeat the claim`);
  return parts.join(" · ");
}

export const CONTRACT_REVIEW_HEADING = "Needs your review";
export const REASON_CODE_LABEL = "Reason code";
