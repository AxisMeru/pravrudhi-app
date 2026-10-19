// The /workflows page: a static, honest list. Nothing here runs, nothing has a start button, and there are no figures or ids (13 Oct 2026; R1's exact words).
export const WORKFLOWS_TITLE = "Workflows";

// R1, 14 Oct: "Built" only when the route is live, else "Building"; "Planned" is never used for what we cannot finish (that row is removed from the page).
export type WorkflowStatus = "Building" | "Built";
export interface WorkflowRow {
  name: string;
  status: WorkflowStatus;
  note?: string;
  /** Shown beside the name when a row has one; no row has one now. */
  label?: string;
}

/** R1, 15 Oct: a card that is not built shows this line in place of a chip; no link, no button. */
export const WORKFLOW_NOT_OFFERED = "Not yet offered";

import { ASSISTANT_ENTRY_ENABLED } from "./assistantFlag";
import { INTAKE_ENABLED } from "./intakeFlag";
import { CITATION_NAV_ENABLED } from "./citationNav";
import { CITATION_EXISTENCE_ONLY, EXISTENCE_SUBTITLE } from "./citationExistence";
import { HEARING_PREP_BUILT, INTAKE_OPEN_LABEL, INTAKE_PATH, WORKFLOW_OPEN_LABEL, WORKSPACE_ANCHORS, WORKSPACE_PATH } from "./workspace";

/** R1 (14 Oct): the Screening orchestration row reads "Built" with the live note only when this build offers the assistant (NEXT_PUBLIC_ASSISTANT_ENTRY=1); the Intake row reads "Built" only when it carries NEXT_PUBLIC_INTAKE=1. Otherwise both stay "Building". */
export const SCREENING_ASSISTANT_LIVE_NOTE = "An optional step-by-step screening assistant, offered to signed-in users, with a consent box you tick for each run. You see the engine's own decision result, never the assistant's wording of it.";

/** The Screening orchestration (assistant) card: the one the assistant tier greys when it is paused or unreachable. Named, not "the first row" (#124). */
export const ASSISTANT_WORKFLOW_NAME = "Screening orchestration";
export const CITATION_CHECK_NAME = "Citation check";
export const CITATION_OPEN_LABEL = "Open Citation check";

export function workflowRows(on: { assistantOn: boolean; intakeOn: boolean; citationsOn?: boolean; hearingBuilt?: boolean }): readonly WorkflowRow[] {
  return [
    on.assistantOn
      ? { name: ASSISTANT_WORKFLOW_NAME, status: "Built", note: SCREENING_ASSISTANT_LIVE_NOTE }
      : { name: ASSISTANT_WORKFLOW_NAME, status: "Building", note: "The step-by-step screening assistant is being built. You would see the engine's own decision result, never the assistant's wording of it. Not yet offered in the product." },
    { name: "Intake", status: on.intakeOn ? "Built" : "Building", note: "Intake turns text you paste into numbered facts, each a passage of your own words, and lists the citations it finds. It works on pasted text only." },
    { name: "Memo preparation", status: "Built", note: "The memo is a written record of a screening, built from the screening result by fixed rules, not written by a model. Download it as Markdown or Word (.docx), or print / save as PDF." },
    // R1 (15 Oct): Hearing preparation and Citation check are listed only when they are built; the Citation check card only on a build that serves the existence check.
    ...((on.hearingBuilt ?? true) ? [{ name: "Hearing preparation", status: "Built" as const, note: "A checklist for the hearing, built from the screening result by fixed rules: the ingredients still open, the facts to look for and the citations to check. It adds no fact and no law." }] : []),
    ...(on.citationsOn ? [{ name: CITATION_CHECK_NAME, status: "Built" as const, note: EXISTENCE_SUBTITLE }] : []),
  ];
}

export const WORKFLOWS: readonly WorkflowRow[] = workflowRows({ assistantOn: ASSISTANT_ENTRY_ENABLED, intakeOn: INTAKE_ENABLED, citationsOn: CITATION_NAV_ENABLED && CITATION_EXISTENCE_ONLY, hearingBuilt: HEARING_PREP_BUILT });

/** The step of the Matter workspace a Built row runs in (Lead-2, 15 Oct: the 13 Oct "no start button" rule is superseded for Built rows only; a Building row has no link). */
export function workflowStepAnchor(name: string): string | null {
  switch (name) {
    case ASSISTANT_WORKFLOW_NAME: return WORKSPACE_ANCHORS.screen;
    case "Memo preparation": return WORKSPACE_ANCHORS.memo;
    case "Hearing preparation": return WORKSPACE_ANCHORS.hearing;
    default: return null;
  }
}

/** Where a Built row's link goes and what it says: Intake has its own page; the others open their step of the workspace. */
export function workflowLink(name: string): { href: string; label: string } | null {
  if (name === "Intake") return { href: INTAKE_PATH, label: INTAKE_OPEN_LABEL };
  if (name === CITATION_CHECK_NAME) return { href: "/citations", label: CITATION_OPEN_LABEL };
  const a = workflowStepAnchor(name);
  return a ? { href: `${WORKSPACE_PATH}#${a}`, label: WORKFLOW_OPEN_LABEL } : null;
}

export const WORKFLOWS_CLOSING = "A workflow runs only when you start it, and only on the matter you give it.";
