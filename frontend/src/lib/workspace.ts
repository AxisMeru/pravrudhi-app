// The Matter workspace (Lead-2, 15 Oct; R1's exact strings): /screening is the workspace for one matter, with a step bar on top: Facts, Screen, Memo, Hearing preparation. ONE constant names it
// everywhere it is named: the nav entry, the page title, the browser tab title, the step bar and the "Go to ..." link on /citations all read WORKSPACE_* from here, so they cannot disagree.

/** The sidebar and palette entry. */
export const WORKSPACE_NAV_LABEL = "Matter";
/** The page's heading, its browser tab title, and the name the "Go to ..." and "Open in ..." links use. */
export const WORKSPACE_TITLE = "Matter workspace";

export const WORKSPACE_STEPS_LABEL = "Steps of this matter";
export const WORKSPACE_STEP_LABELS = { facts: "Facts", screen: "Screen", memo: "Memo", hearing: "Hearing preparation" } as const;
export const WORKSPACE_STATE_WORDS = { done: "Done", available: "Available", notYet: "Not yet" } as const;
/** Under Memo and Hearing preparation until a screening result exists. */
export const WORKSPACE_LOCKED_TEXT = "Available after a screening result.";
/** Under Hearing preparation while this version of the app does not offer it. */
export const HEARING_NOT_OFFERED_TEXT = "Not offered in this version of the app.";
/** Hearing preparation is built (a deterministic checklist from the screening result, lib/screening/hearingPrep.ts) and rendered as step 4; with this false the step says it is not offered. */
export const HEARING_PREP_BUILT = true;

/** The anchors of the steps on /screening: the /workflows page links its Built rows to them. */
export const WORKSPACE_ANCHORS = { facts: "step-facts", screen: "step-screen", memo: "step-memo", hearing: "step-hearing" } as const;
export const WORKSPACE_PATH = "/screening";

/** The link on a Built /workflows row to its step (the label is a plain action; R1 to confirm). */
export const WORKFLOW_OPEN_LABEL = `Open in ${WORKSPACE_TITLE}`;
/** The link on the Built Intake row: Intake is its own page (/intake), not a step of the workspace (R1 to confirm the label). */
export const INTAKE_PATH = "/intake";
export const INTAKE_OPEN_LABEL = "Open Intake";
/** The link on /citations when the check is not offered. */
export const CITATIONS_GO_LABEL = `Go to ${WORKSPACE_TITLE}`;

export type StepKey = keyof typeof WORKSPACE_STEP_LABELS;
export interface StepState {
  key: StepKey;
  label: string;
  state: (typeof WORKSPACE_STATE_WORDS)[keyof typeof WORKSPACE_STATE_WORDS];
  /** The line under a step that is not available yet. */
  note: string | null;
  /** Where the step is on the page; null for a step that is not available. */
  href: string | null;
}

/** The four steps and their states from what the page holds: facts typed or loaded, and a screening result. */
export function workspaceSteps(on: { hasFacts: boolean; hasResult: boolean }, hearingBuilt: boolean = HEARING_PREP_BUILT): StepState[] {
  const W = WORKSPACE_STATE_WORDS;
  const step = (key: StepKey, state: StepState["state"], note: string | null): StepState => ({ key, label: WORKSPACE_STEP_LABELS[key], state, note, href: state === W.notYet ? null : `#${WORKSPACE_ANCHORS[key]}` });
  return [
    step("facts", on.hasFacts ? W.done : W.available, null),
    step("screen", on.hasResult ? W.done : W.available, null),
    step("memo", on.hasResult ? W.available : W.notYet, on.hasResult ? null : WORKSPACE_LOCKED_TEXT),
    hearingBuilt
      ? step("hearing", on.hasResult ? W.available : W.notYet, on.hasResult ? null : WORKSPACE_LOCKED_TEXT)
      : step("hearing", W.notYet, HEARING_NOT_OFFERED_TEXT),
  ];
}
