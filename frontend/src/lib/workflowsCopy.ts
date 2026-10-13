// The /workflows page: a static, honest list. Nothing here runs, nothing has a start button, and there are no figures or ids (13 Oct 2026; R1's exact words).
export const WORKFLOWS_TITLE = "Workflows";

export type WorkflowStatus = "Building" | "Planned";
export interface WorkflowRow {
  name: string;
  status: WorkflowStatus;
  note?: string;
}

export const WORKFLOWS: readonly WorkflowRow[] = [
  { name: "Screening orchestration", status: "Building", note: "The step-by-step screening assistant is in development. In development checks on invented matters it completed every screening and produced a decision result each time. The app shows you only the engine's decision result, never an assistant's own wording of it. Not yet offered in the product." },
  { name: "Intake", status: "Planned" },
  { name: "Memo preparation", status: "Planned" },
  { name: "Matter update review", status: "Planned" },
  { name: "Hearing preparation", status: "Planned" },
];

export const WORKFLOWS_CLOSING = "A workflow runs only when you start it, and only on the matter you give it.";
