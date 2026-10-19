import assert from "node:assert/strict";
import test from "node:test";

import { previewRefusal } from "./previewRefusal";

test("a 401 says R1's sign-in line and never the engine's 'Stored papers' sentence", () => {
  assert.equal(previewRefusal(401, { detail: "Stored papers are offered only to signed-in users" }), "Sign in to add papers.");
  assert.equal(previewRefusal(401, null), "Sign in to add papers.");
});

test("any engine sentence about stored papers is replaced by the app's own line, on any status", () => {
  assert.equal(previewRefusal(503, { detail: "Stored papers are not available." }), "Adding papers is not available here.");
  assert.equal(previewRefusal(404, { detail: "Stored papers are not available." }), "Adding papers is not available here.");
});

test("the earlier rule stands for the other statuses", () => {
  assert.equal(previewRefusal(404, { detail: "x" }), "This workflow is not available here.");
  assert.equal(previewRefusal(409, { error: "no_papers" }), "There are no papers to read. Add papers first.");
  assert.equal(previewRefusal(503, { detail: "The service is busy now." }), "The service is busy now.");
  assert.equal(previewRefusal(503, null), "The service is busy. Try again in a moment.");
  assert.equal(previewRefusal(500, null), "This workflow could not finish, so no result is given. Please try again, or have a lawyer read the papers.");
});
