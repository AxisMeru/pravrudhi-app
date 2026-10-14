import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./api";
import { NOT_IN_INDEX_LABEL, classifyVerifyError, statusLabel, verifyView } from "./citationCheck";
import {
  CONFLICT_TEXT, DETAIL_422_TEXT, EXISTENCE_LIMITS, EXISTENCE_PANEL_LINE, EXISTENCE_SUBTITLE, NOT_IN_INDEX_NOTE, QUOTE_NOT_CHECKED_TEXT, QUOTE_NOT_SERVED_TEXT,
} from "./citationExistence";
import { parseCitationLines } from "./citationsPanel";
import { CITATION_ERROR_TEXT } from "./signedStrings";

test("R1's existence-only strings are exact (14 Oct)", () => {
  assert.equal(EXISTENCE_SUBTITLE, "Look up one citation and see whether the case is in our index.");
  assert.equal(EXISTENCE_LIMITS, "The check looks for the case in our index from the citation you enter. It does not look at quotes and does not say whether the case supports a point. If we cannot match the citation to exactly one case in our index, the result is “Not found in our index”; that does not show whether the citation is real, because the index does not hold every judgment. This check is not yet served in the hosted deployment.");
  assert.equal(EXISTENCE_PANEL_LINE, "The citation is looked up in our index; quotes are not checked.");
  assert.equal(QUOTE_NOT_CHECKED_TEXT, "Only the citation was looked up; the quote was not checked.");
  assert.equal(NOT_IN_INDEX_NOTE, "We could not match this citation to exactly one case in our index. That does not show whether the citation is real: the index does not hold every judgment.");
  assert.equal(CONFLICT_TEXT, "The citation matches more than one case in our index, so we cannot tell which you mean.");
  assert.equal(QUOTE_NOT_SERVED_TEXT, "This check cannot look at quotes. It can only tell you whether we can match the citation to a case in our index.");
  assert.equal(DETAIL_422_TEXT, "Enter one citation, and leave the quote empty.");
  assert.doesNotMatch([EXISTENCE_LIMITS, QUOTE_NOT_SERVED_TEXT, NOT_IN_INDEX_NOTE].join(" "), /\b(fake|false|invalid|verified|yet)\b(?! served)/i);
  assert.doesNotMatch(EXISTENCE_LIMITS, /word for word/);
});

test("the not-in-index result: the engine's note is replaced by R1's only while existence-only; the label is the same either way (both arms)", () => {
  const reply = { result: "NOT_IN_INDEX", note: "The case was not found in our index. That does not show whether the citation is real: the index does not hold every judgment." };
  assert.equal(verifyView(reply, false, true).note, NOT_IN_INDEX_NOTE);
  assert.equal(verifyView(reply, false, false).note, reply.note);
  for (const on of [true, false]) assert.equal(statusLabel("NOT_IN_INDEX", on), NOT_IN_INDEX_LABEL);
  // another status keeps its own note in both modes
  assert.equal(verifyView({ result: "IN_INDEX", note: "A fixed note." }, false, true).note, "A fixed note.");
});

test("a conflict reads as R1's sentence only while existence-only (both arms); other tokens are untouched", () => {
  assert.equal(statusLabel("CONFLICT", true), CONFLICT_TEXT);
  assert.equal(statusLabel("CONFLICT", false), "CONFLICT");
  for (const s of ["IN_INDEX", "MALFORMED", "VERIFIED"]) assert.equal(statusLabel(s, true), s);
});

test("a 422 reads in plain words while existence-only, never the code; flag off keeps the generic text; 429 and 503 keep the signed texts (both arms)", () => {
  const quote = new ApiError(422, "/x", { code: "quote_not_served" });
  const detail = new ApiError(422, "/x", {});
  assert.deepEqual(classifyVerifyError(quote, true), { kind: "quote_not_served", message: QUOTE_NOT_SERVED_TEXT });
  assert.deepEqual(classifyVerifyError(detail, true), { kind: "invalid_request", message: DETAIL_422_TEXT });
  for (const e of [quote, detail]) {
    assert.match(classifyVerifyError(e, false).message, /HTTP 422/);
    assert.doesNotMatch(classifyVerifyError(e, true).message, /quote_not_served|422/);
  }
  assert.equal(classifyVerifyError(new ApiError(503, "/x", { code: "citation_index_unavailable" }), true).message, CITATION_ERROR_TEXT.citation_index_unavailable);
  assert.doesNotMatch(CITATION_ERROR_TEXT.citation_index_unavailable, /temporar/i);
  assert.equal(classifyVerifyError(new ApiError(503, "/x", { code: "verify_timeout" }), true).message, CITATION_ERROR_TEXT.verify_timeout);
  assert.equal(classifyVerifyError(new ApiError(503, "/x", { code: "verify_at_capacity" }), true).message, CITATION_ERROR_TEXT.verify_at_capacity);
  assert.match(classifyVerifyError(new ApiError(429, "/x", { retryAfter: 7 }), true).message, /Seconds to wait: 7/);
});

test("the panel: existence-only sends NO quote even after a | and flags the typed quote; flag off is unchanged (both arms)", () => {
  const text = "(2020) 3 SCC 456 | the words\n(2019) 1 SCC 2\nB |";
  const on = parseCitationLines(text, true).items;
  assert.deepEqual(on.map((i) => [i.citation, i.quote, i.quoteIgnored === true]), [["(2020) 3 SCC 456", null, true], ["(2019) 1 SCC 2", null, false], ["B", null, false]]);
  const off = parseCitationLines(text, false).items;
  assert.deepEqual(off.map((i) => [i.citation, i.quote]), [["(2020) 3 SCC 456", "the words"], ["(2019) 1 SCC 2", null], ["B", null]]);
  assert.ok(off.every((i) => i.quoteIgnored === undefined));
});
