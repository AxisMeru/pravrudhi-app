// Layout B "matter-b" (pravrudhi-app#144, Studio spec v3 bb1b62b1c51a, R1's string list v2): every string the layout adds, in ONE file for R1's read, and the small shared state the sidebar needs from the Screening page.
// Nothing here is used unless the build flag NEXT_PUBLIC_LAYOUT_MATTER_B=1 (src/lib/layoutFlag.ts) is set.
import { useSyncExternalStore } from "react";

import { MB_SCREENING_LABEL } from "./matterBLabel";

/** NEW strings (R1 reads each); the existing signed strings (chips, banner, standing line, export labels, nav labels) are reused where they appear, never copied. */
export const MB = {
  // R1 (16 Oct, findability): the one line under the standing line on /screening before a result: lead word, then two links (the first uses the nav's own "Safety record"; both go to /safety and /benchmarks only).
  alsoLead: "Also:",
  alsoSafety: "Safety record",
  alsoBenchmarks: "Benchmarks and the NyayaSiddhi film",
  screeningLabel: MB_SCREENING_LABEL, // the nav group label, the header label and the neutral name ("This screening")
  resultLabel: "Result", // nav item and breadcrumb tail, shown only when a result exists
  factsLabel: "Facts", // nav item and breadcrumb tail on the intake view
  breadcrumbRoot: "Screening",
  groupGeneral: "General",
  groupReference: "Reference",
  exampleSuffix: "(example)",
  // the ONLY retention sentence allowed: the signed Data handling sentence, byte for byte, beside a screening that has a stored record (never on an example)
  retention: "Run records are kept for up to 7 days.",
  yourFacts: "Your facts", // rail heading
  editFacts: "Edit facts",
  newScreening: "New screening",
  // R1's confirm for "New screening" (a destructive action), shown only when something is entered or a result exists; it claims nothing about what is kept
  newTitle: "Start a new screening?",
  newBody: "This clears the facts, the pasted text, the chosen offences and the result on this page. Files you have already downloaded are not changed.",
  newConfirm: "Clear and start new",
  newKeep: "Cancel",
  factsChip: (n: number) => `Facts (${n})`,
  citedBy: (n: number) => (n === 1 ? "Cited by 1 ingredient" : `Cited by ${n} ingredients`),
  noIngredientCites: "No ingredient cites this fact yet",
  groupReview: (n: number) => `Needs your review (${n})`,
  groupSupported: (n: number) => `Supported by a fact (${n})`,
  groupNoFact: (n: number) => `No fact cited (${n})`,
  skipToResult: "Skip to result",
  skipToForm: "Skip to the form",
  moreActions: "More actions",
} as const;

export type MbView = "intake" | "result";
export interface MbState {
  hasResult: boolean;
  /** The result carries a run record (the condition that offers "Download run record (.json)"): the only case the retention sentence may show. */
  runRecord: boolean;
  view: MbView;
  /** The example's citation when the facts are one of the two public examples, else null (the neutral name is used). */
  exampleName: string | null;
}
const EMPTY: MbState = { hasResult: false, runRecord: false, view: "intake", exampleName: null };
let state: MbState = EMPTY;
const listeners = new Set<() => void>();
export function setMbState(next: MbState): void {
  if (next.hasResult === state.hasResult && next.runRecord === state.runRecord && next.view === state.view && next.exampleName === state.exampleName) return;
  state = next;
  listeners.forEach((l) => l());
}
export function useMbState(): MbState {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => EMPTY);
}
