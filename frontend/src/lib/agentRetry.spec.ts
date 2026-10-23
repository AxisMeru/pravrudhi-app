import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { AGENT_RETRY_MAX, AGENT_RETRY_WAIT_MS, RETRY_TOTAL_MAX_MS, WARMING_WAIT_MAX_MS, WARMING_WAIT_MIN_MS, apiErrorFrom, boundedRetryWaitMs, isNotServingYet, nextRetryWaitMs } from "./api";
import { AGENT_NOT_READY_TEXT } from "./runningCopy";
import { CODED_ERROR_TEXT } from "./signedStrings";

test("#543: R1's wait line (by hash), the 45 s wait x5, and the existing failure line unchanged", () => {
  assert.equal(AGENT_NOT_READY_TEXT, "The analysis models were not ready yet. Nothing was scored so far. The page will keep trying for a while; you can cancel at any point.");
  assert.equal(createHash("sha256").update(AGENT_NOT_READY_TEXT, "utf8").digest("hex").slice(0, 8), "51605e40");
  assert.doesNotMatch(AGENT_NOT_READY_TEXT, /loading|shortly|judge|\d/i, "R1: no loading, no shortly, no count");
  assert.equal(AGENT_RETRY_WAIT_MS, 45_000);
  assert.equal(AGENT_RETRY_MAX, 5);
  assert.equal(CODED_ERROR_TEXT.agent_unavailable, "The analysis service is not available right now, so nothing was scored. Try again later.");
});

test("#548: judges_warming (engine 0.6.34) joins agent_unavailable on the retry path; nothing else does", () => {
  assert.equal(isNotServingYet({ status: 503, code: "agent_unavailable" }), true);
  assert.equal(isNotServingYet({ status: 503, code: "judge_unavailable", reason: "judges_warming" }), true);
  assert.equal(isNotServingYet({ status: 503, code: "judge_unavailable" }), false);
  assert.equal(isNotServingYet({ status: 503, code: "judges_offline" }), false);
  assert.equal(isNotServingYet({ status: 500, code: "agent_unavailable" }), false);
  assert.equal(isNotServingYet({ status: 422 }), false);
});

test("#548: retry_after_s is honoured within bounds; no value means the usual 45 s; agent_unavailable ignores it", () => {
  const w = (retryAfter?: number) => nextRetryWaitMs({ code: "judge_unavailable", reason: "judges_warming", retryAfter });
  assert.equal(w(30), 30_000);
  assert.equal(w(1), WARMING_WAIT_MIN_MS);
  assert.equal(w(9999), WARMING_WAIT_MAX_MS);
  assert.equal(w(undefined), AGENT_RETRY_WAIT_MS);
  assert.equal(nextRetryWaitMs({ code: "agent_unavailable", retryAfter: 30 }), AGENT_RETRY_WAIT_MS);
});

test("#548: the body's retry_after_s becomes retryAfter; the Retry-After header wins when both exist", async () => {
  const body = JSON.stringify({ error: "judge_unavailable", reason: "judges_warming", retry_after_s: 25 });
  const a = await apiErrorFrom(new Response(body, { status: 503 }), "/x");
  assert.equal(a.retryAfter, 25);
  assert.equal(a.reason, "judges_warming");
  const b = await apiErrorFrom(new Response(body, { status: 503, headers: { "retry-after": "40" } }), "/x");
  assert.equal(b.retryAfter, 40);
});

test("#548 (R2): the total of the retry waits never passes 540 s, even at 120 s x 5; a spent budget stops the loop", () => {
  const warm = { code: "judge_unavailable", reason: "judges_warming", retryAfter: 120 };
  let waited = 0;
  const waits: number[] = [];
  for (let n = 0; n < AGENT_RETRY_MAX; n++) {
    const w = boundedRetryWaitMs(warm, waited);
    waits.push(w);
    waited += w;
  }
  assert.deepEqual(waits, [120_000, 120_000, 120_000, 120_000, 60_000]);
  assert.equal(waited, RETRY_TOTAL_MAX_MS);
  assert.equal(boundedRetryWaitMs(warm, RETRY_TOTAL_MAX_MS), 0);
  assert.equal(boundedRetryWaitMs({ code: "agent_unavailable" }, 0), AGENT_RETRY_WAIT_MS);
});
