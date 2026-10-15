import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./api";
import { classifyVerifyError } from "./citationCheck";
import { INTERNAL_ERROR_LINE, internalErrorLine, isInternalError } from "./internalError";
import { intakeErrorLine } from "./intakeErrors";
import { INTAKE_UNREADABLE } from "./intakeCopy";
import { classifyAnalyseError } from "./serviceStatus";

// Engine 0.6.18 (#499): HTTP 500 {"error":"internal_error","detail":"an internal error occurred; try again later"}; before it a bare 500 ({"detail":"Internal Server Error"}).
const CODED = new ApiError(500, "/api/v1/analyse-facts", { code: "internal_error" });
const BARE = new ApiError(500, "/api/v1/analyse-facts");
const STUB = "STUB SENTENCE";
const LEAKS = /internal_error|\b500\b|HTTP|an internal error occurred|Internal Server Error/i;

test("an internal error is HTTP 500, coded or bare, and nothing else", () => {
  assert.equal(isInternalError(CODED), true);
  assert.equal(isInternalError(BARE), true);
  for (const status of [400, 401, 422, 429, 502, 503]) assert.equal(isInternalError(new ApiError(status, "/x", { code: "internal_error" })), false, String(status));
  assert.equal(isInternalError(new Error("x")), false);
});

test("R1's sentence is set, byte-exact, and replaces the whole line on every surface for the coded and the bare 500 (including \"Nothing was scored.\" and \"No result was returned.\")", () => {
  assert.equal(INTERNAL_ERROR_LINE, "Something went wrong on our side, so this request was not completed. Try again in a moment.");
  for (const e of [CODED, BARE]) {
    assert.equal(classifyAnalyseError(e).message, INTERNAL_ERROR_LINE);
    assert.equal(classifyVerifyError(e).message, INTERNAL_ERROR_LINE);
    assert.equal(classifyVerifyError(e, false).message, INTERNAL_ERROR_LINE);
    assert.equal(intakeErrorLine(e), INTERNAL_ERROR_LINE);
    for (const m of [classifyAnalyseError(e).message, classifyVerifyError(e).message, intakeErrorLine(e)]) assert.doesNotMatch(m, LEAKS);
  }
  assert.equal(internalErrorLine("fallback"), INTERNAL_ERROR_LINE);
  assert.equal(internalErrorLine("fallback", null), "fallback");
});

test("once R1's sentence is set, it is the only text on every surface: no code, no 500, no HTTP, no engine detail, for the coded and the bare 500", () => {
  for (const e of [CODED, BARE]) {
    assert.equal(classifyAnalyseError(e, STUB).message, STUB);
    assert.equal(classifyVerifyError(e, true, STUB).message, STUB);
    assert.equal(classifyVerifyError(e, false, STUB).message, STUB);
    assert.equal(intakeErrorLine(e, STUB), STUB);
    for (const m of [classifyAnalyseError(e, STUB).message, classifyVerifyError(e, true, STUB).message, intakeErrorLine(e, STUB)]) assert.doesNotMatch(m, LEAKS);
  }
});

test("the sentence applies to internal errors only: a 503, a 422 and a 401 keep their own lines", () => {
  assert.notEqual(classifyAnalyseError(new ApiError(503, "/x", { code: "agent_unavailable" }), STUB).message, STUB);
  assert.notEqual(classifyAnalyseError(new ApiError(401, "/x"), STUB).message, STUB);
  assert.notEqual(classifyVerifyError(new ApiError(422, "/x"), true, STUB).message, STUB);
  assert.notEqual(classifyVerifyError(new ApiError(503, "/x", { code: "verify_timeout" }), true, STUB).message, STUB);
  assert.notEqual(intakeErrorLine(new ApiError(503, "/x", { code: "intake_timeout" }), STUB), STUB);
  assert.notEqual(intakeErrorLine(new ApiError(403, "/x"), STUB), STUB);
});

test("a coded 503 service_config_missing never reaches the page: Screening reads its signed line, Citations and Intake keep their generic lines", () => {
  const e = new ApiError(503, "/api/v1/x", { code: "service_config_missing" });
  assert.equal(classifyAnalyseError(e).message, "The service is not fully set up. Nothing was scored.");
  assert.doesNotMatch(classifyVerifyError(e).message, /service_config_missing/);
  assert.equal(intakeErrorLine(e), INTAKE_UNREADABLE);
  // the internal-error sentence is for HTTP 500 only
  assert.notEqual(classifyAnalyseError(e, STUB).message, STUB);
  assert.notEqual(classifyVerifyError(e, true, STUB).message, STUB);
  assert.notEqual(intakeErrorLine(e, STUB), STUB);
});
