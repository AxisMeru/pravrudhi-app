// The /workflows page: a static, honest list. Nothing here runs, nothing has a start button, and there are no figures or ids (13 Oct 2026; R1's exact words).
export const WORKFLOWS_TITLE = "Workflows";

// R1, 14 Oct: "Built" only when the route is live, else "Building"; "Planned" is never used for what we cannot finish (that row is removed from the page).
export type WorkflowStatus = "Building" | "Built";
export interface WorkflowRow {
  name: string;
  status: WorkflowStatus;
  note?: string;
}

export const WORKFLOWS: readonly WorkflowRow[] = [
  { name: "Screening orchestration", status: "Building", note: "The step-by-step screening assistant is being built. It will run the same screening steps and show you the steps it took. You see the engine's own decision result, never the assistant's wording of it. Not yet offered in the product." },
  { name: "Intake", status: "Building", note: "Intake turns text you paste into numbered facts, each a passage of your own words, and lists the citations it finds. It works on pasted text only." },
  { name: "Memo preparation", status: "Built", note: "The memo is a written record of a screening, built from the screening result by fixed rules, not written by a model. Download it as Markdown, PDF or Word (.docx)." },
  { name: "Hearing preparation", status: "Building", note: "A checklist for the hearing, built from the screening result by fixed rules: the ingredients still open, the facts to look for and the citations to check. It adds no fact and no law." },
];

export const WORKFLOWS_CLOSING = "A workflow runs only when you start it, and only on the matter you give it.";
