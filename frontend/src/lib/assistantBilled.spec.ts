import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./api";
import { ASSISTANT_SESSION_BILLED_LINE } from "./assistantBilled";
import { classifyAnalyseError } from "./serviceStatus";

const BILLED = new ApiError(502, "/api/v1/analyse-facts/assist", { code: "assistant_session_billed" });

test("a coded 502 assistant_session_billed reads the candidate line and nothing from the engine", () => {
  const c = classifyAnalyseError(BILLED);
  assert.equal(c.kind, "assistant_session_billed");
  assert.equal(c.message, ASSISTANT_SESSION_BILLED_LINE);
  assert.doesNotMatch(c.message, /assistant_session_billed|\b502\b|HTTP|charged|retry automatically|Nothing was scored/);
});

test("only the coded 502 maps: a bare 502 and another 502 code keep the generic line; the internal-error sentence is for 500", () => {
  assert.match(classifyAnalyseError(new ApiError(502, "/x")).message, /HTTP 502/);
  assert.match(classifyAnalyseError(new ApiError(502, "/x", { code: "something_else" })).message, /HTTP 502/);
  assert.notEqual(classifyAnalyseError(new ApiError(500, "/x", { code: "assistant_session_billed" }), "STUB").message, ASSISTANT_SESSION_BILLED_LINE);
});
