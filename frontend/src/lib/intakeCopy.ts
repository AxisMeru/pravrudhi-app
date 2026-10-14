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
  "Page numbers, running headings and page breaks from your file can appear inside a fact or split a sentence between two facts; they are part of your text.";
export const INTAKE_CAVEATS: readonly string[] = [INTAKE_CAVEAT_HEADING, INTAKE_CAVEAT_NO_BLANK_LINES, INTAKE_CAVEAT_PAGE_FURNITURE];
