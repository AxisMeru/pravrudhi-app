// The citation check while the engine's index answers EXISTENCE only (pravrudhi#398/#717; R1's exact words, 14 Oct). One build flag, off until Lead-2's go for 0.6.5
// (NEXT_PUBLIC_CITATION_EXISTENCE_ONLY=1). Flag off: today's signed pages are unchanged. Flag on: the app sends NO quote, shows no quote field, and says what the check can tell.
export const CITATION_EXISTENCE_ONLY = process.env.NEXT_PUBLIC_CITATION_EXISTENCE_ONLY === "1";

export const EXISTENCE_SUBTITLE = "Look up one citation and see whether the case is in our index.";
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
export const CONFLICT_TEXT = "The citation matches more than one case in our index, so we cannot tell which you mean.";
/** HTTP 422 quote_not_served: a safety net (no quote is sent while the flag is on); the code is never printed. */
export const QUOTE_NOT_SERVED_TEXT = "This check cannot look at quotes. It can only tell you whether we can match the citation to a case in our index.";
/** HTTP 422 with a validation `detail` (blank citation, over length): the form has no quote field. */
export const DETAIL_422_TEXT = "Enter one citation, and leave the quote empty.";
