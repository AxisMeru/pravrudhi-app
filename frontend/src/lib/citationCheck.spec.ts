import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./api";
import {
  CITATION_MAX,
  PREVIEW_LABEL,
  QUOTE_MAX,
  VERIFY_STATUSES,
  checkInputs,
  classifyVerifyError,
  verifyView,
} from "./citationCheck";

test("the preview label is exactly the decided wording", () => {
  assert.equal(PREVIEW_LABEL, "preview: accuracy not yet measured");
});

test("the five statuses the engine can answer are shown verbatim and known", () => {
  assert.deepEqual([...VERIFY_STATUSES], ["VERIFIED", "EXISTS_QUOTE_NOT_FOUND", "NOT_IN_INDEX", "MALFORMED", "CONFLICT"]);
  for (const s of VERIFY_STATUSES) {
    const v = verifyView({ result: s, note: "A fixed note." });
    assert.equal(v.status, s);
    assert.equal(v.known, true);
    assert.equal(v.note, "A fixed note.");
  }
});

test("an unknown status is shown as sent and flagged, never reworded", () => {
  const v = verifyView({ result: "SOMETHING_NEW", note: "n" });
  assert.equal(v.status, "SOMETHING_NEW");
  assert.equal(v.known, false);
});

test("the engine's note is shown as sent, but a note carrying the word 'fake' is withheld, never reworded", () => {
  const ok = "The citation resolves to an indexed case and the quote appears in its text.";
  assert.equal(verifyView({ result: "VERIFIED", note: ok }).note, ok);
  const bad = "The index holds no evidence either way: this is not a finding that the citation is fake.";
  const v = verifyView({ result: "NOT_IN_INDEX", note: bad });
  assert.equal(v.note, null);
  assert.equal(v.noteWithheld, true);
  assert.equal(v.status, "NOT_IN_INDEX");
  assert.equal(verifyView({ result: "MALFORMED", note: "" }).noteWithheld, false);
});

test("a failed check gets the signed wording for each coded refusal and distinct wording for the generic cases", () => {
  const k = (e: unknown) => classifyVerifyError(e);
  assert.equal(k(new ApiError(503, "/x", { code: "verify_timeout" })).kind, "timeout");
  assert.equal(k(new ApiError(503, "/x", { code: "verify_at_capacity" })).kind, "at_capacity");
  assert.equal(k(new ApiError(503, "/x", { code: "citation_index_unavailable" })).kind, "index_unavailable");
  assert.equal(k(new DOMException("t", "TimeoutError")).kind, "timeout");
  assert.equal(k(new DOMException("a", "AbortError")).kind, "cancelled");
  assert.equal(k(new ApiError(401, "/x")).kind, "signed_out");
  assert.match(k(new ApiError(429, "/x", { retryAfter: 9 })).message, /Seconds to wait: 9/);
  assert.equal(k(new ApiError(500, "/x")).kind, "server");
  assert.equal(k(new TypeError("fetch failed")).kind, "network");
  for (const e of [new ApiError(503, "/x", { code: "verify_timeout" }), new ApiError(503, "/x", { code: "citation_index_unavailable" }), new ApiError(500, "/x")]) {
    assert.doesNotMatch(k(e).message, /\bfake\b/i);
  }
});

test("the inputs are checked against the engine's limits before a request is sent", () => {
  assert.equal(checkInputs("(2020) 3 SCC 456", "a quote").ok, true);
  assert.equal(checkInputs("   ", "a quote").ok, false);
  assert.equal(checkInputs("(2020) 3 SCC 456", " ").ok, false);
  assert.equal(checkInputs("x".repeat(CITATION_MAX + 1), "q").ok, false);
  assert.equal(checkInputs("c", "x".repeat(QUOTE_MAX + 1)).ok, false);
  assert.equal(checkInputs("x".repeat(CITATION_MAX), "x".repeat(QUOTE_MAX)).ok, true);
});
