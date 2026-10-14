// The intake selector's words: all R1's exact text (14 Oct, signed; verbatim use needs no further read).
export const SELECTOR_HEADING = "Choose the facts to screen";
export const SELECTOR_TICK_LINE = "Tick up to 8 facts. Screening reads only the ones you choose.";
export const SELECTOR_INTRO = "These are your own words, split into numbered pieces. Nothing is rewritten.";
export const selectorLimitLine = (n: number): string => `Intake found ${n} facts. Screening takes up to 8 at a time: choose the ones that matter.`;
export const SELECTOR_OVER_LIMIT = "Choose up to 8, or screen in more than one round.";
export const SELECTOR_PAGE_MARKER_NOTE = "Page numbers and headings from your file can appear inside a fact; they are part of your text.";
export const SELECTOR_NO_BLANK_LINES_NOTE = "This text has no blank lines, so the heading of the order may sit inside the first fact. Skip any fact that is not about what happened.";

export const selectorCounter = (n: number): string => `${n} of 8 chosen`;
export const SELECTOR_EMPTY = "Choose at least one fact to screen.";
export const SELECTOR_SCREEN_BUTTON = "Screen the chosen facts";
