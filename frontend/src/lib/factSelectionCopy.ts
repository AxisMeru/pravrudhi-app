// The intake selector's words: all R1's exact text (14 Oct, signed; verbatim use needs no further read).
export const SELECTOR_HEADING = "Choose the facts to screen";
export const SELECTOR_TICK_LINE = "Tick up to 8 facts. Screening reads only the ones you choose.";
export const SELECTOR_INTRO = "These are your own words, split into numbered pieces. Nothing is rewritten.";
export const selectorLimitLine = (n: number): string => `Intake found ${n} facts. Screening takes up to 8 at a time: choose the ones that matter.`;
export const SELECTOR_OVER_LIMIT = "Choose up to 8, or screen in more than one round.";

export const selectorCounter = (n: number): string => `${n} of 8 chosen`;
export const SELECTOR_EMPTY = "Choose at least one fact to screen.";
export const SELECTOR_SCREEN_BUTTON = "Screen the chosen facts";
