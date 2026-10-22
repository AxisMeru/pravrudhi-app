import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { AGENT_RETRY_MAX, AGENT_RETRY_WAIT_MS } from "./api";
import { AGENT_NOT_READY_TEXT } from "./runningCopy";
import { CODED_ERROR_TEXT } from "./signedStrings";

test("#543: R1's wait line (by hash), the 45 s wait x5, and the existing failure line unchanged", () => {
  assert.equal(AGENT_NOT_READY_TEXT, "The analysis models were not ready yet. Nothing was scored so far. The page will keep trying for a few minutes; you can cancel at any point.");
  assert.equal(createHash("sha256").update(AGENT_NOT_READY_TEXT, "utf8").digest("hex").slice(0, 8), "7e2742b6");
  assert.doesNotMatch(AGENT_NOT_READY_TEXT, /loading|shortly|judge|\d/i, "R1: no loading, no shortly, no count");
  assert.equal(AGENT_RETRY_WAIT_MS, 45_000);
  assert.equal(AGENT_RETRY_MAX, 5);
  assert.equal(CODED_ERROR_TEXT.agent_unavailable, "The analysis service is not available right now, so nothing was scored. Try again later.");
});
