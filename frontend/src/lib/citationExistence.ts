// The citation check while the engine's index answers EXISTENCE only (pravrudhi#398/#717; R1's exact words, 14 Oct). One build flag, off until Lead-2's go for 0.6.5
// (NEXT_PUBLIC_CITATION_EXISTENCE_ONLY=1). Flag off: today's signed pages are unchanged. Flag on: the app sends NO quote, shows no quote field, and says what the check can tell.
export const CITATION_EXISTENCE_ONLY = process.env.NEXT_PUBLIC_CITATION_EXISTENCE_ONLY === "1";

export const EXISTENCE_SUBTITLE = "Look up citations, up to 5 at a time, and see whether each case is in our index.";
export const EXISTENCE_LIMITS =
  "The check looks for the case in our index from the citation you enter. It does not look at quotes and does not say whether the case supports a point. If we cannot match the citation to exactly one case in our index, the result is “Not found in our index”; that does not show whether the citation is real, because the index does not hold every judgment.";
// R1 (14 Oct, #181): with the existence-only arm ON the check IS served, so the limits text no longer ends with "This check is not yet served in the hosted deployment." (the flag-OFF text keeps it).
export const EXISTENCE_PANEL_LINE = "The citation is looked up in our index; quotes are not checked.";
/** Added to a result row when the user typed words after a | : the quote is never sent, and never silently ignored. */
export const QUOTE_NOT_CHECKED_TEXT = "Only the citation was looked up; the quote was not checked.";
/** The result's note for not_in_index: the engine's own note ("The case was not found in our index") is inexact under the stricter match rule. */
export const NOT_IN_INDEX_NOTE = "We could not match this citation to exactly one case in our index. That does not show whether the citation is real: the index does not hold every judgment.";
/** R1 (14 Oct, #181): the IN_INDEX heading while the index is existence-only: plain words, never the raw token. The engine's own note ("Found in the index (existence only): no quote was checked, so this is not a verification.") stays under it. */
export const IN_INDEX_LABEL = "Found in our index";
/** pravrudhi#509 NAME_MISMATCH (R1, 16 Oct, byte-exact): the engine compared the typed case name with the case the citation belongs to and they differ. Same heading on /citations, the panel and Intake's citation line. */
export const NAME_MISMATCH_HEADING = "Case name did not match";
export const NAME_MISMATCH_TEXT = "We found this citation in our index, but the case name you typed does not match the case it belongs to there. That does not show whether the citation or the name is right. Check both by hand.";
/** PROPOSED for R1 (not yet signed): a status this build does not know was still looked up, so it reads neither "Not checked." nor the raw token; the heading and the one sentence below are shown instead. */
export const UNKNOWN_STATUS_HEADING = "Result not shown";
export const UNKNOWN_STATUS_TEXT = "The citation was looked up, but this version of the app cannot show the result. That does not show whether the citation is real. Check it by hand.";
/** pravrudhi#509 (R1, 15 Oct, byte-exact): an ADDITION after the IN_INDEX note (never a replacement), shown on every surface that says "Found in our index" only when the checked line carries a case name (citationHasCaseName): the engine looks the citation up and does not compare the typed name with the index. */
export const CASE_NAME_NOT_COMPARED = "Only the citation was looked up; the case name you typed was not compared with the index.";
/** #223 D1 (R1, 15 Oct; Lead-2): a CONFLICT is worded neutrally: the cause may be one case under a spelling variant, so it never says "more than one case" and never claims the citation is not real. */
export const CONFLICT_TEXT = "We could not match this citation to exactly one case in our index. That does not show whether the citation is real. Adding the case name before the citation may help; if it does not, check the citation by hand.";
/** app#347 (R1, 15 Oct, byte-exact): the CONFLICT sentence when the citation the reader typed already carries a case name (citationHasCaseName): the advice to add the name would be wrong. The heading stays "Could not match one case". */
export const CONFLICT_TEXT_WITH_NAME = "We could not match this citation to exactly one case in our index, even with the case name. That does not show whether the citation is real. Check the citation by hand.";
/** #223 D2a (R1): plain headings for the two statuses that had none (CONFLICT) or a raw token (MALFORMED) while the index is existence-only. */
export const CONFLICT_HEADING = "Could not match one case";
export const MALFORMED_HEADING = "Not looked up";
export const MALFORMED_TEXT = "We could not read this line as one citation, so we did not look it up. Enter one citation per line, for example (2014) 8 SCC 273. That does not show whether a citation is real.";
/** #223 D3 (R1): the coverage limit BEFORE the user types, under the existing limits (on /citations and in the panel). */
export const COVERAGE_LIMITS_TEXT = "Our index covers Supreme Court citations in the form (year) volume SCC page. A neutral citation, an AIR citation or a High Court reporter citation is not covered and will come back as \u201CNot found in our index\u201D.";
/** #223 D4 (R1): signed-out visitors are told before typing, and a 401 reads as a citation-check sentence (not the screening session wording). */
export const SIGNED_OUT_BEFORE_TEXT = "Citation checks need you to be signed in.";
export const SIGNED_OUT_401_TEXT = "Sign in to check citations. Nothing was looked up.";
/** #223 D7 (R1): /citations privacy line with the arm ON: there is no quote box, so it names the citation only. */
export const RETENTION_EXISTENCE = "The citation check does not save the citation you enter.";
/** HTTP 422 quote_not_served: a safety net (no quote is sent while the flag is on); the code is never printed. */
export const QUOTE_NOT_SERVED_TEXT = "This check cannot look at quotes. It can only tell you whether we can match the citation to a case in our index.";
/** HTTP 422 with a validation `detail` (blank citation, over length): the form has no quote field. */
export const DETAIL_422_TEXT = "Enter one citation, and leave the quote empty.";

/**
 * #263 (Interim lead, 15 Oct): the line under the citation box that says how many lines are in it and, past the cap, how many will be checked. R1's exact words (15 Oct).
 * It is shown while typing or pasting, so nothing is cut without being said.
 */
export const lineCountText = (lines: number, cap: number): string =>
  lines > cap ? `${lines} lines entered; the first ${cap} will be checked.` : `${lines} of ${cap} lines.`;
