import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ASSISTED_RUNNING_NOTE, LEAVE_AND_RETURN_TEXT, RUNNING_STATUS_LINE, waitingFor } from "./runningCopy";
import { STEP_NAMES, STEP_LABELS } from "./assistantRun";

test("R1's running-view strings, exactly", () => {
  assert.equal(RUNNING_STATUS_LINE, "Screening in progress. This page is waiting for the result.");
  assert.equal(ASSISTED_RUNNING_NOTE, "The assistant is working through the steps; they are shown on this page when it finishes.");
  assert.equal(LEAVE_AND_RETURN_TEXT, "Keep this page open until the screening finishes. If you leave it, you will not see the result.");
});

test("the elapsed line is one pattern, 'Waiting for mm:ss', with no promise of a time", () => {
  assert.equal(waitingFor(0), "Waiting for 00:00");
  assert.equal(waitingFor(7), "Waiting for 00:07");
  assert.equal(waitingFor(65), "Waiting for 01:05");
  assert.equal(waitingFor(600), "Waiting for 10:00");
  assert.equal(waitingFor(-3), "Waiting for 00:00");
  assert.doesNotMatch(waitingFor(65), /about|minutes|remaining|left|estimate/i);
});

test("the wait names no step (the app does not know the steps until the result returns), and version A is never written", () => {
  const all = [RUNNING_STATUS_LINE, ASSISTED_RUNNING_NOTE, LEAVE_AND_RETURN_TEXT, waitingFor(12)].join(" ");
  for (const name of STEP_NAMES) assert.ok(!all.includes(STEP_LABELS[name]), STEP_LABELS[name]);
  assert.doesNotMatch(all, /keeps running|go to another page and come back/i);
  const src = readFileSync(join(__dirname, "runningCopy.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
  assert.doesNotMatch(src, /keeps running/i);
});
