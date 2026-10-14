import assert from "node:assert/strict";
import test from "node:test";
import { RUN_AGAIN_LABEL, RUN_AGAIN_MIN_SECONDS, RUN_AGAIN_NOTE, runAgainState } from "./runAgain";

test("R1's two strings, exactly", () => {
  assert.equal(RUN_AGAIN_LABEL, "Run again");
  assert.equal(RUN_AGAIN_NOTE, "A second run counts toward your daily limit.");
});

test("offered only for an assisted run that ended on the app's timeout, and only from 180 s", () => {
  assert.equal(runAgainState({ assisted: true, timedOut: true, secondsSinceFirstSubmit: 320 }), "offered");
  assert.equal(runAgainState({ assisted: true, timedOut: true, secondsSinceFirstSubmit: RUN_AGAIN_MIN_SECONDS }), "offered");
  assert.equal(runAgainState({ assisted: true, timedOut: true, secondsSinceFirstSubmit: RUN_AGAIN_MIN_SECONDS - 1 }), "waiting");
  assert.equal(runAgainState({ assisted: true, timedOut: true, secondsSinceFirstSubmit: 0 }), "waiting");
});

test("never for a finished or fallback result, or for a plain (unassisted) run", () => {
  assert.equal(runAgainState({ assisted: true, timedOut: false, secondsSinceFirstSubmit: 400 }), "hidden");
  assert.equal(runAgainState({ assisted: false, timedOut: true, secondsSinceFirstSubmit: 400 }), "hidden");
  assert.equal(runAgainState({ assisted: false, timedOut: false, secondsSinceFirstSubmit: 400 }), "hidden");
});
