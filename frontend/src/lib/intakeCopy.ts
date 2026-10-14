// Words of the Intake page: R1 signed these at b6435e5 with two edits (14 Oct): the failure line has no "answer", and the citations heading is "Citations in your text". The subtitle is the first sentence of his signed Workflows note.
export const INTAKE_PAGE_TITLE = "Intake";
export const INTAKE_PAGE_SUBTITLE = "Intake turns text you paste into numbered facts, each tied to the words it came from, and lists the citations it finds.";
export const INTAKE_PASTE_LABEL = "Paste the text";
export const INTAKE_RUN_BUTTON = "Run intake";
export const INTAKE_UNREADABLE = "Intake could not run just now. Try again.";
export const INTAKE_CITATIONS_HEADING = "Citations in your text";

// R1's FINAL caveat set for the paste box (14 Oct; replaces the earlier per-fact notes). (1) is the privacy one and sits with the paste box before Run intake.
export const INTAKE_CAVEAT_HEADING =
  "Intake leaves out the heading of a court order. For other kinds of text it may not recognise the heading, and then names, addresses and other details in it stay as facts and are part of what is screened.";
export const INTAKE_CAVEAT_NO_BLANK_LINES = "If your text has no blank lines, part of the heading can stay inside the first fact; skip any fact that is not about what happened.";
export const INTAKE_CAVEAT_PAGE_FURNITURE =
  "Running headings and page breaks from your file can appear inside a fact or split a sentence between two facts; they are part of your text.";
export const INTAKE_CAVEATS: readonly string[] = [INTAKE_CAVEAT_HEADING, INTAKE_CAVEAT_NO_BLANK_LINES, INTAKE_CAVEAT_PAGE_FURNITURE];

// R1 (14 Oct, exact): the plain-route data line beside the paste box, above the caveats and below the label. No consent line on this page; never "not stored".
export const INTAKE_DATA_LINE =
  "The text you paste is read by the engine only; no model reads it on this page. The facts you choose are sent on to Screening, where models read them.";

// R1 (14 Oct, exact): what intake left out, shown under the list whenever n > 0; the second line when any left-out line contains a digit. (One line left out reads "1 line was left out",
// the same fixed sentence in the singular: flagged to R1.)
export const intakeLeftOut = (n: number): string =>
  n === 1 ? "1 line was left out: the heading, repeated lines or lines with no words." : `${n} lines were left out: the heading, repeated lines or lines with no words.`;
export const INTAKE_LEFT_OUT_DIGITS = "Some of the lines left out contain numbers. They are still in your text; check that nothing you need was dropped.";
