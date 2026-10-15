import assert from "node:assert/strict";
import test from "node:test";

import { CITATION_NOT_OFFERED_LINK } from "./citationNav";
import { NAV_LABELS } from "./navCopy";
import { PAGE_TITLES, pageTitle } from "./pageTitles";
import { PALETTE_PAGES } from "./palette";
import { SCREENING_TITLE } from "./screening/copy";
import { HEARING_NOT_OFFERED_TEXT, WORKFLOW_OPEN_LABEL, WORKSPACE_ANCHORS, WORKSPACE_LOCKED_TEXT, WORKSPACE_NAV_LABEL, WORKSPACE_STATE_WORDS, WORKSPACE_STEP_LABELS, WORKSPACE_TITLE, workspaceSteps } from "./workspace";
import { WORKFLOWS, workflowStepAnchor } from "./workflowsCopy";

// R1's exact strings (15 Oct).
test("the workspace's names and step words are R1's, exactly", () => {
  assert.equal(WORKSPACE_NAV_LABEL, "Matter");
  assert.equal(WORKSPACE_TITLE, "Matter workspace");
  assert.deepEqual({ ...WORKSPACE_STEP_LABELS }, { facts: "Facts", screen: "Screen", memo: "Memo", hearing: "Hearing preparation" });
  assert.deepEqual({ ...WORKSPACE_STATE_WORDS }, { done: "Done", available: "Available", notYet: "Not yet" });
  assert.equal(WORKSPACE_LOCKED_TEXT, "Available after a screening result.");
  assert.equal(HEARING_NOT_OFFERED_TEXT, "Not offered in this version of the app.");
});

// One name everywhere it is named: they cannot disagree.
test("the nav entry, the palette entry, the page heading, the tab title and the /citations link all read the workspace constants", () => {
  assert.equal(NAV_LABELS.screening, WORKSPACE_NAV_LABEL);
  assert.equal(PALETTE_PAGES.find((p) => p.href === "/screening")?.label, WORKSPACE_NAV_LABEL);
  assert.equal(SCREENING_TITLE, WORKSPACE_TITLE);
  assert.equal(PAGE_TITLES.screening, WORKSPACE_TITLE);
  assert.equal(pageTitle("screening"), `${WORKSPACE_TITLE} · Pravrudhi-Nyaya`);
  assert.equal(CITATION_NOT_OFFERED_LINK, `Go to ${WORKSPACE_TITLE}`);
  assert.ok(CITATION_NOT_OFFERED_LINK.includes(WORKSPACE_TITLE), "the link label contains the workspace name");
  assert.ok(WORKFLOW_OPEN_LABEL.includes(WORKSPACE_TITLE));
});

test("the step states: before facts, with facts, with a result; Hearing preparation stays 'Not yet' with its note until it is built", () => {
  const W = WORKSPACE_STATE_WORDS;
  const states = (a: { hasFacts: boolean; hasResult: boolean }, built = false) => workspaceSteps(a, built).map((s) => `${s.key}:${s.state}`).join(" ");
  assert.equal(states({ hasFacts: false, hasResult: false }), "facts:Available screen:Available memo:Not yet hearing:Not yet");
  assert.equal(states({ hasFacts: true, hasResult: false }), "facts:Done screen:Available memo:Not yet hearing:Not yet");
  assert.equal(states({ hasFacts: true, hasResult: true }), "facts:Done screen:Done memo:Available hearing:Not yet");
  assert.equal(states({ hasFacts: true, hasResult: true }, true), "facts:Done screen:Done memo:Available hearing:Available");
  const none = workspaceSteps({ hasFacts: true, hasResult: false });
  assert.equal(none[2].note, WORKSPACE_LOCKED_TEXT);
  assert.equal(none[3].note, HEARING_NOT_OFFERED_TEXT);
  assert.equal(workspaceSteps({ hasFacts: true, hasResult: false }, true)[3].note, WORKSPACE_LOCKED_TEXT);
  assert.equal(workspaceSteps({ hasFacts: true, hasResult: true })[2].note, null);
  // a step that is not available has no link; an available one links to its anchor
  for (const s of workspaceSteps({ hasFacts: true, hasResult: false })) assert.equal(s.href, s.state === W.notYet ? null : `#${WORKSPACE_ANCHORS[s.key]}`);
});

test("/workflows: only a Built row has a link, to a step of the workspace; a Building row has none", () => {
  const anchors = new Set(Object.values(WORKSPACE_ANCHORS));
  for (const w of WORKFLOWS) {
    const a = workflowStepAnchor(w.name);
    assert.ok(a === null || anchors.has(a as never), `${w.name} -> ${a}`);
  }
  assert.equal(workflowStepAnchor("Memo preparation"), "step-memo");
  assert.equal(workflowStepAnchor("Intake"), "step-facts");
  assert.equal(workflowStepAnchor("Screening orchestration"), "step-screen");
});
