import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./api";
import { intakeErrorLine } from "./intakeErrors";
import { INTAKE_TIMEOUT, INTAKE_UNREADABLE } from "./intakeCopy";
import { INTAKE_SIGNED_IN_ONLY } from "./intake";

// #297 (R1): the sentence is exact, and the engine's 503 intake_timeout reads it; every other failure keeps its signed line.
test("the intake timeout sentence is R1's, exactly, with no code, no model, no claim about what was kept and no time", () => {
  assert.equal(INTAKE_TIMEOUT, "This text took too long to read, so the intake was stopped. Try a shorter text.");
  assert.doesNotMatch(INTAKE_TIMEOUT, /intake_timeout|model|kept|saved|stored|second|minute|\d/i);
});

test("which line each failure reads: timeout only for 503 + intake_timeout; the other arms are unchanged", () => {
  assert.equal(intakeErrorLine(new ApiError(503, "/api/v1/intake", { code: "intake_timeout" })), INTAKE_TIMEOUT);
  assert.equal(intakeErrorLine(new ApiError(503, "/api/v1/intake", { code: "something_else" })), INTAKE_UNREADABLE);
  assert.equal(intakeErrorLine(new ApiError(503, "/api/v1/intake")), INTAKE_UNREADABLE);
  assert.equal(intakeErrorLine(new ApiError(500, "/api/v1/intake", { code: "intake_timeout" })), INTAKE_UNREADABLE);
  assert.equal(intakeErrorLine(new ApiError(401, "/api/v1/intake")), INTAKE_SIGNED_IN_ONLY);
  assert.equal(intakeErrorLine(new ApiError(403, "/api/v1/intake", { code: "intake_timeout" })), INTAKE_SIGNED_IN_ONLY);
  assert.equal(intakeErrorLine(new Error("network")), INTAKE_UNREADABLE);
});
