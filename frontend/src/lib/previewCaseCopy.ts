// DRAFT labels of the cheque case check card until R1 words them (goal-context/web-find/PREVIEW_CASE_STRINGS_DRAFT.txt); the engine's own sentences (statement, role labels, no-candidate lines, pending line) are shown as sent.
export const PREVIEW_CASE = {
  name: "Cheque case check",
  line: "Shows the review agenda and, for each step, the dates your papers show next to that step's words. You choose one date per step and confirm it; nothing is filled in for you.",
  run: "Find the dates in the papers",
  pickLegend: "Choose the date for this step",
  pickNone: "Leave this step empty",
  readingLegend: "Which reading is right?",
  make: "Make the checklist from the chosen dates",
} as const;
