// The /workflows page: a static, honest list. Nothing here runs, nothing has a start button, and there are no figures or ids (13 Oct 2026; R1's exact words).
export const WORKFLOWS_TITLE = "Workflows";

// R1, 14 Oct: "Built" only when the route is live, else "Building"; "Planned" is never used for what we cannot finish (that row is removed from the page).
export type WorkflowStatus = "Building" | "Built";
export interface WorkflowRow {
  name: string;
  status: WorkflowStatus;
  note?: string;
}

import { ASSISTANT_ENTRY_ENABLED } from "./assistantFlag";
import { INTAKE_ENABLED } from "./intakeFlag";
import { WORKSPACE_ANCHORS } from "./workspace";

/** R1 (14 Oct): the Screening orchestration row reads "Built" with the live note only when this build offers the assistant (NEXT_PUBLIC_ASSISTANT_ENTRY=1); the Intake row reads "Built" only when it carries NEXT_PUBLIC_INTAKE=1. Otherwise both stay "Building". */
export const SCREENING_ASSISTANT_LIVE_NOTE = "An optional step-by-step screening assistant, offered to signed-in users, with a consent box you tick for each run. You see the engine's own decision result, never the assistant's wording of it.";

export function workflowRows(on: { assistantOn: boolean; intakeOn: boolean }): readonly WorkflowRow[] {
  return [
    on.assistantOn
      ? { name: "Screening orchestration", status: "Built", note: SCREENING_ASSISTANT_LIVE_NOTE }
      : { name: "Screening orchestration", status: "Building", note: "The step-by-step screening assistant is being built. You would see the engine's own decision result, never the assistant's wording of it. Not yet offered in the product." },
    { name: "Intake", status: on.intakeOn ? "Built" : "Building", note: "Intake turns text you paste into numbered facts, each a passage of your own words, and lists the citations it finds. It works on pasted text only." },
    { name: "Memo preparation", status: "Built", note: "The memo is a written record of a screening, built from the screening result by fixed rules, not written by a model. Download it as Markdown or Word (.docx), or print / save as PDF." },
    { name: "Hearing preparation", status: "Building", note: "A checklist for the hearing, built from the screening result by fixed rules: the ingredients still open, the facts to look for and the citations to check. It adds no fact and no law." },
  ];
}

export const WORKFLOWS: readonly WorkflowRow[] = workflowRows({ assistantOn: ASSISTANT_ENTRY_ENABLED, intakeOn: INTAKE_ENABLED });

/** The step of the Matter workspace a Built row runs in (Lead-2, 15 Oct: the 13 Oct "no start button" rule is superseded for Built rows only; a Building row has no link). */
export function workflowStepAnchor(name: string): string | null {
  switch (name) {
    case "Screening orchestration": return WORKSPACE_ANCHORS.screen;
    case "Intake": return WORKSPACE_ANCHORS.facts;
    case "Memo preparation": return WORKSPACE_ANCHORS.memo;
    case "Hearing preparation": return WORKSPACE_ANCHORS.hearing;
    default: return null;
  }
}

export const WORKFLOWS_CLOSING = "A workflow runs only when you start it, and only on the matter you give it.";
