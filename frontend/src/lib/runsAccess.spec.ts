import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./api";
import { canSeeRuns, isOperatorOnly, OPERATOR_ONLY_MESSAGE } from "./runsAccess";

test("only the engine's admin is shown the Runs entry; the recorded demo keeps it", () => {
  assert.equal(canSeeRuns("admin"), true);
  for (const a of ["member", "none", "", undefined, "ADMIN", "operator"]) assert.equal(canSeeRuns(a), false, String(a));
  assert.equal(canSeeRuns(undefined, true), true);
});

test("a 401 or 403 from a run route reads as operator-only, never as an outage", () => {
  assert.equal(isOperatorOnly(new ApiError(403, "/api/runs")), true);
  assert.equal(isOperatorOnly(new ApiError(401, "/api/runs")), true);
  for (const s of [0, 404, 500, 503]) assert.equal(isOperatorOnly(new ApiError(s, "/api/runs")), false, String(s));
  assert.equal(isOperatorOnly(new Error("network")), false);
  assert.equal(isOperatorOnly(null), false);
  assert.match(OPERATOR_ONLY_MESSAGE, /operator/);
});
