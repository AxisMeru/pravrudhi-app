import assert from "node:assert/strict";
import test from "node:test";

import { HEALTH_TIMEOUT_MS, isAbortError, timeoutSignal } from "./api";

// #312 (Track-B): a /api/health that never answers is aborted by the request's own signal, so it cannot hold a connection (six fill the browser's pool and queue every other same-origin fetch).
test("timeoutSignal aborts after the given time and not before", async () => {
  const s = timeoutSignal(60);
  assert.equal(s.aborted, false);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(s.aborted, true);
});

test("the health timeout is short of the connection pool's patience: 8 s, the same figure as the tier read's own limit", () => {
  assert.equal(HEALTH_TIMEOUT_MS, 8_000);
});

test("isAbortError: only the request's own abort or timeout counts as 'no answer'; a refusal or a network failure does not", () => {
  assert.equal(isAbortError(new DOMException("t", "TimeoutError")), true);
  assert.equal(isAbortError(new DOMException("a", "AbortError")), true);
  assert.equal(isAbortError(new TypeError("Failed to fetch")), false);
  assert.equal(isAbortError(new Error("x")), false);
  assert.equal(isAbortError(null), false);
});
