import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { AGENT_RETRY_WAIT_MS } from "./api";
import { AGENT_NOT_READY_TEXT } from "./runningCopy";
import { CODED_ERROR_TEXT } from "./signedStrings";

test("#543: R1's wait line (by hash), the 60 s wait, and the existing failure line unchanged", () => {
  assert.equal(AGENT_NOT_READY_TEXT, "The analysis models were not ready yet. Nothing was scored. The page will try once more in about a minute.");
  assert.equal(createHash("sha256").update(AGENT_NOT_READY_TEXT, "utf8").digest("hex").slice(0, 8), "2922089f");
  assert.doesNotMatch(AGENT_NOT_READY_TEXT, /loading|finishing|warming|judge|\d/i, "R1: none of these words, no count of tries");
  assert.equal(AGENT_RETRY_WAIT_MS, 60_000);
  assert.equal(CODED_ERROR_TEXT.agent_unavailable, "The analysis service is not available right now, so nothing was scored. Try again later.");
});
