import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, apiErrorFrom } from "./api";
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

// The engine's coded 503s reach the app as { "error": "<code>" } (apiErrorFrom reads `error` into ApiError.code, the field every other coded 503 uses: outside_service_window, judges_offline, ...).
// This runs the recorded body through that same function, so the classifier is proven against the real field name and not only against a hand-built ApiError.
test("a 503 body { error: 'intake_timeout' } read by the app's own error reader gives the timeout sentence; the current engine body { detail } (no code) does not", async () => {
  const coded = await apiErrorFrom(new Response(JSON.stringify({ error: "intake_timeout" }), { status: 503, headers: { "content-type": "application/json" } }), "/api/v1/intake");
  assert.equal(coded.code, "intake_timeout");
  assert.equal(intakeErrorLine(coded), INTAKE_TIMEOUT);
  const detailOnly = await apiErrorFrom(new Response(JSON.stringify({ detail: "intake took too long" }), { status: 503, headers: { "content-type": "application/json" } }), "/api/v1/intake");
  assert.equal(detailOnly.code, undefined);
  assert.equal(intakeErrorLine(detailOnly), INTAKE_UNREADABLE); // until the engine sends the code, the general line stays (the classifier never guesses from free text)
});

// app#342 (Track C): a 422 (the engine refused the text) is not "try again"; a 429 carries the seconds the engine asked for; nothing from the engine's body reaches the line.
import { INTAKE_RATE_LIMITED, INTAKE_REFUSED } from "./intakeCopy";
test("422 reads the refused line; 429 with Retry-After reads the wait line with the seconds; a 429 without it stays general; other codes are unchanged", () => {
  assert.equal(intakeErrorLine(new ApiError(422, "/api/v1/intake", {})), INTAKE_REFUSED);
  assert.equal(intakeErrorLine(new ApiError(429, "/api/v1/intake", { retryAfter: 30 })), `${INTAKE_RATE_LIMITED} Seconds to wait: 30.`);
  assert.equal(intakeErrorLine(new ApiError(429, "/api/v1/intake", {})), INTAKE_UNREADABLE);
  assert.equal(intakeErrorLine(new ApiError(503, "/api/v1/intake", { code: "agent_at_capacity" })), INTAKE_UNREADABLE);
  assert.equal(intakeErrorLine(new ApiError(401, "/api/v1/intake", {})), INTAKE_SIGNED_IN_ONLY);
  for (const m of [INTAKE_REFUSED, INTAKE_RATE_LIMITED]) assert.doesNotMatch(m, /\b(422|429)\b|HTTP|rate limit exceeded|Nothing was scored/);
});

test("through the app's own error reader: a 429 with a Retry-After header gives the seconds; a 422 detail never reaches the line", async () => {
  const r429 = await apiErrorFrom(new Response(JSON.stringify({ detail: "rate limit exceeded" }), { status: 429, headers: { "retry-after": "30", "content-type": "application/json" } }), "/api/v1/intake");
  assert.equal(intakeErrorLine(r429), `${INTAKE_RATE_LIMITED} Seconds to wait: 30.`);
  const r422 = await apiErrorFrom(new Response(JSON.stringify({ detail: "nothing readable in this text" }), { status: 422, headers: { "content-type": "application/json" } }), "/api/v1/intake");
  assert.equal(intakeErrorLine(r422), INTAKE_REFUSED);
  assert.doesNotMatch(intakeErrorLine(r422), /nothing readable/);
});
