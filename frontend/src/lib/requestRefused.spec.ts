import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./api";
import { MAX_CONTRACT_IDS, TOO_MANY_OFFENCES_TEXT } from "./factsInput";
import { OFFENCES } from "./screening/offences";
import { classifyAnalyseError } from "./serviceStatus";

test("#544/#545: R1's two lines, exactly", () => {
  assert.equal(MAX_CONTRACT_IDS, 5);
  assert.equal(TOO_MANY_OFFENCES_TEXT, "These offences together are more than one screening can run. Untick one or more of them to screen.");
  assert.doesNotMatch(TOO_MANY_OFFENCES_TEXT, /\d|ids|contracts|ways/, "R1: no number, no internals");
  const m = classifyAnalyseError(new ApiError(422, "/api/v1/analyse-facts"));
  assert.equal(m.message, "The screening could not accept these facts or offences. Nothing was scored. Check them and try again.");
  assert.doesNotMatch(m.message, /HTTP|422|engine/);
});

test("#544: other statuses keep the generic line", () => {
  assert.equal(classifyAnalyseError(new ApiError(400, "/x")).message, "The engine answered with an error (HTTP 400). Nothing was scored.");
});

test("#545: one offence can carry several contract ids, so two offences can already exceed the engine's 5", () => {
  const ids = (t: string) => OFFENCES.find((o) => o.title === t)!.contracts.length;
  assert.ok(ids("Criminal breach of trust") + ids("Abetment") > MAX_CONTRACT_IDS);
});
