import assert from "node:assert/strict";
import test from "node:test";

import { workflowLink, workflowRows } from "./workflowsCopy";

const names = (r: ReturnType<typeof workflowRows>) => r.map((x) => x.name);

test("Workflows cards: Citation check and Hearing preparation are listed only when built; Citation check is last; Matter update review never", () => {
  const base = workflowRows({ assistantOn: false, intakeOn: false });
  assert.deepEqual(names(base), ["Screening orchestration", "Intake", "Memo preparation", "Hearing preparation"]);
  const withCit = workflowRows({ assistantOn: true, intakeOn: true, citationsOn: true });
  assert.deepEqual(names(withCit), ["Screening orchestration", "Intake", "Memo preparation", "Hearing preparation", "Citation check"]);
  const cit = withCit[4];
  assert.equal(cit.status, "Built");
  assert.equal(cit.label, undefined);
  assert.equal(cit.note, "Look up citations, up to 5 at a time, and see whether each case is in our index.");
  assert.deepEqual(workflowLink("Citation check"), { href: "/citations", label: "Open Citation check" });
  assert.deepEqual(names(workflowRows({ assistantOn: false, intakeOn: false, hearingBuilt: false })), ["Screening orchestration", "Intake", "Memo preparation"]);
  for (const r of [base, withCit]) assert.ok(!names(r).includes("Matter update review"));
});
