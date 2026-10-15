import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./api";
import { NOT_IN_INDEX_LABEL, classifyVerifyError, statusLabel, verifyView } from "./citationCheck";
import {
  CONFLICT_HEADING, CONFLICT_TEXT, DETAIL_422_TEXT, MALFORMED_HEADING, EXISTENCE_LIMITS, EXISTENCE_PANEL_LINE, EXISTENCE_SUBTITLE, NOT_IN_INDEX_NOTE, QUOTE_NOT_CHECKED_TEXT, QUOTE_NOT_SERVED_TEXT,
} from "./citationExistence";
import { parseCitationLines } from "./citationsPanel";
import { CITATION_ERROR_TEXT } from "./signedStrings";

test("R1's existence-only strings are exact (14 Oct)", () => {
  assert.equal(EXISTENCE_SUBTITLE, "Look up one citation and see whether the case is in our index.");
  assert.equal(EXISTENCE_LIMITS, "The check looks for the case in our index from the citation you enter. It does not look at quotes and does not say whether the case supports a point. If we cannot match the citation to exactly one case in our index, the result is “Not found in our index”; that does not show whether the citation is real, because the index does not hold every judgment.");
  assert.equal(EXISTENCE_PANEL_LINE, "The citation is looked up in our index; quotes are not checked.");
  assert.equal(QUOTE_NOT_CHECKED_TEXT, "Only the citation was looked up; the quote was not checked.");
  assert.equal(NOT_IN_INDEX_NOTE, "We could not match this citation to exactly one case in our index. That does not show whether the citation is real: the index does not hold every judgment.");
  assert.equal(CONFLICT_TEXT, "We could not match this citation to exactly one case in our index. That does not show whether the citation is real. Put the case name before the citation and check again."); // #223 D1 (R1, 15 Oct), replaces the 14 Oct sentence
  assert.equal(QUOTE_NOT_SERVED_TEXT, "This check cannot look at quotes. It can only tell you whether we can match the citation to a case in our index.");
  assert.equal(DETAIL_422_TEXT, "Enter one citation, and leave the quote empty.");
  assert.doesNotMatch([EXISTENCE_LIMITS, QUOTE_NOT_SERVED_TEXT, NOT_IN_INDEX_NOTE].join(" "), /\b(fake|false|invalid|verified|yet)\b(?! served)/i);
  assert.doesNotMatch(EXISTENCE_LIMITS, /word for word/);
  assert.doesNotMatch(EXISTENCE_LIMITS, /not yet served|hosted deployment/, "R1 #181: with the arm ON the check is served, so the sentence is gone");
});

test("the not-in-index result: the engine's note is replaced by R1's only while existence-only; the label is the same either way (both arms)", () => {
  const reply = { result: "NOT_IN_INDEX", note: "The case was not found in our index. That does not show whether the citation is real: the index does not hold every judgment." };
  assert.equal(verifyView(reply, false, true).note, NOT_IN_INDEX_NOTE);
  assert.equal(verifyView(reply, false, false).note, reply.note);
  for (const on of [true, false]) assert.equal(statusLabel("NOT_IN_INDEX", on), NOT_IN_INDEX_LABEL);
  // another status keeps its own note in both modes
  assert.equal(verifyView({ result: "IN_INDEX", note: "A fixed note." }, false, true).note, "A fixed note.");
});

test("a conflict and a malformed line read as R1's headings only while existence-only (both arms); other tokens are untouched (#223 D2a)", () => {
  assert.equal(statusLabel("CONFLICT", true), CONFLICT_HEADING);
  assert.equal(statusLabel("CONFLICT", false), "CONFLICT");
  assert.equal(statusLabel("MALFORMED", true), MALFORMED_HEADING);
  assert.equal(statusLabel("MALFORMED", false), "MALFORMED");
  assert.equal(statusLabel("VERIFIED", true), "VERIFIED");
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
  const text = "(2099) 1 SCC 1 | the words\n(2019) 1 SCC 2\nB |";
  const on = parseCitationLines(text, true).items;
  assert.deepEqual(on.map((i) => [i.citation, i.quote, i.quoteIgnored === true]), [["(2099) 1 SCC 1", null, true], ["(2019) 1 SCC 2", null, false], ["B", null, false]]);
  const off = parseCitationLines(text, false).items;
  assert.deepEqual(off.map((i) => [i.citation, i.quote]), [["(2099) 1 SCC 1", "the words"], ["(2019) 1 SCC 2", null], ["B", null]]);
  assert.ok(off.every((i) => i.quoteIgnored === undefined));
});

// R1, 14 Oct (#181): the citations arm copy, pinned in BOTH flag states.
test("IN_INDEX heading: 'Found in our index' while existence-only, the raw token when the flag is off; the engine's note stays under it", async () => {
  const { IN_INDEX_LABEL } = await import("./citationExistence");
  assert.equal(IN_INDEX_LABEL, "Found in our index");
  assert.equal(statusLabel("IN_INDEX", true), "Found in our index");
  assert.equal(statusLabel("IN_INDEX", false), "IN_INDEX");
  const note = "Found in the index (existence only): no quote was checked, so this is not a verification.";
  assert.equal(verifyView({ result: "IN_INDEX", note }, false, true).note, note);
  assert.equal(verifyView({ result: "IN_INDEX", note }, false, false).note, note);
});

test("CONFLICT: R1's heading and sentence while existence-only (the engine's note is replaced, not 'withheld'); flag off shows the engine's note as before", () => {
  const reply = { result: "CONFLICT", note: "The citation maps to conflicting indexed cases; verify by hand." };
  const on = verifyView(reply, false, true);
  assert.equal(on.note, CONFLICT_TEXT);
  assert.equal(on.noteWithheld, false);
  assert.equal(statusLabel("CONFLICT", true), CONFLICT_HEADING);
  const off = verifyView(reply, false, false);
  assert.equal(off.note, reply.note);
  assert.equal(statusLabel("CONFLICT", false), "CONFLICT");
});
