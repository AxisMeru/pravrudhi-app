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
  assert.equal(EXISTENCE_SUBTITLE, "Look up citations, up to 5 at a time, and see whether each case is in our index.");
  assert.equal(EXISTENCE_LIMITS, "The check looks for the case in our index from the citation you enter. It does not look at quotes and does not say whether the case supports a point. If we cannot match the citation to exactly one case in our index, the result is “Not found in our index”; that does not show whether the citation is real, because the index does not hold every judgment.");
  assert.equal(EXISTENCE_PANEL_LINE, "The citation is looked up in our index; quotes are not checked.");
  assert.equal(QUOTE_NOT_CHECKED_TEXT, "Only the citation was looked up; the quote was not checked.");
  assert.equal(NOT_IN_INDEX_NOTE, "We could not match this citation to exactly one case in our index. That does not show whether the citation is real: the index does not hold every judgment.");
  assert.equal(CONFLICT_TEXT, "We could not match this citation to exactly one case in our index. That does not show whether the citation is real. Adding the case name before the citation may help; if it does not, check the citation by hand."); // #223 D1 (R1, 15 Oct), replaces the 14 Oct sentence
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

// R1 (#263, 15 Oct): the line-count sentences, exact: "{n} of 5 lines." up to the cap, "{n} lines entered; the first 5 will be checked." past it; the 5 is the cap constant.
test("#263: lineCountText is R1's exact pair, built from the cap", async () => {
  const { lineCountText } = await import("./citationExistence");
  const { MAX_CITATIONS_EXISTENCE } = await import("./citationsPanel");
  assert.equal(MAX_CITATIONS_EXISTENCE, 5);
  assert.equal(lineCountText(1, MAX_CITATIONS_EXISTENCE), "1 of 5 lines.");
  assert.equal(lineCountText(5, MAX_CITATIONS_EXISTENCE), "5 of 5 lines.");
  assert.equal(lineCountText(6, MAX_CITATIONS_EXISTENCE), "6 lines entered; the first 5 will be checked.");
});

// R1 (#258, 15 Oct): the whole CONFLICT_TEXT sentence, exact, and the old advice is gone from the shipped sources and the specs.
test("#258: CONFLICT_TEXT is R1's reworded sentence and the old advice appears nowhere in src or e2e", async () => {
  assert.equal(CONFLICT_TEXT, "We could not match this citation to exactly one case in our index. That does not show whether the citation is real. Adding the case name before the citation may help; if it does not, check the citation by hand.");
  assert.equal(CONFLICT_HEADING, "Could not match one case");
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join, resolve } = await import("node:path");
  const root = resolve(__dirname, "..", "..");
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
  const old = "Put the case name " + "before the citation and check again"; // split so this file does not contain the old advice
  const hits = [...walk(join(root, "src")), ...walk(join(root, "e2e"))].filter((f) => !f.endsWith("citationExistence.spec.ts") && readFileSync(f, "utf8").includes(old));
  assert.deepEqual(hits, []);
});

// R1 (#266, 15 Oct): the /citations subtitle names the batch size, and the "5" in that literal is the panel's cap constant.
test("#266: EXISTENCE_SUBTITLE says up to 5 at a time, equal to the cap constant", async () => {
  const { MAX_CITATIONS_EXISTENCE } = await import("./citationsPanel");
  assert.equal(EXISTENCE_SUBTITLE, "Look up citations, up to 5 at a time, and see whether each case is in our index.");
  assert.match(EXISTENCE_SUBTITLE, new RegExp(`up to ${MAX_CITATIONS_EXISTENCE} at a time`));
});

// app#347 (R1, 15 Oct): the CONFLICT sentence depends on whether the typed citation already carries a case name; both sentences are pinned byte-exact, the heading is unchanged, and the rule is a table.
import { citationHasCaseName } from "./citationCheck";
import { CONFLICT_TEXT_WITH_NAME } from "./citationExistence";
test("#347: both CONFLICT sentences are R1's, byte-exact; the heading is unchanged", () => {
  assert.equal(CONFLICT_TEXT, "We could not match this citation to exactly one case in our index. That does not show whether the citation is real. Adding the case name before the citation may help; if it does not, check the citation by hand.");
  assert.equal(CONFLICT_TEXT_WITH_NAME, "We could not match this citation to exactly one case in our index, even with the case name. That does not show whether the citation is real. Check the citation by hand.");
  assert.doesNotMatch(CONFLICT_TEXT_WITH_NAME, /Adding the case name/);
  assert.equal(CONFLICT_HEADING, "Could not match one case");
});
test("#347: the name-present rule: ' v. ', ' v ', ' vs. ' or ' versus ' before the (year) part, case-insensitive; anything else or any doubt is absent", () => {
  const present = ["Hridaya Ranjan Prasad Verma v. State of Bihar (2000) 4 SCC 168", "A v B (1999) 1 SCC 1", "A vs. B (1999) 1 SCC 1", "A VS B (1999) 1 SCC 1", "A Versus B (1999) 1 SCC 1", "A V. B (1999) 1 SCC 1", "Ram v. Shyam ( 1988 ) 2 SCC 5"];
  const absent = ["(2000) 4 SCC 168", "AIR 1999 SC 100", "", "   ", "State of Bihar (2000) 4 SCC 168", "Avvo (2000) 4 SCC 168", "Hridaya v. State of Bihar 4 SCC 168 2000", "Hridaya v. State of Bihar", "(2000) 4 SCC 168 Hridaya v. State", "A v.B (1999) 1 SCC 1", "Dev (1999) 1 SCC 1"];
  for (const c of present) assert.equal(citationHasCaseName(c), true, c);
  for (const c of absent) assert.equal(citationHasCaseName(c), false, c);
  assert.equal(citationHasCaseName(undefined), false); assert.equal(citationHasCaseName(null), false); assert.equal(citationHasCaseName(42), false);
});
test("#347: verifyView picks the sentence from the citation (existence-only arm); no citation, or a bare one, keeps the signed sentence", () => {
  const conflict = { result: "CONFLICT", note: "The citation maps to conflicting indexed cases; verify by hand.", status: "conflict", label: "conflict", verified: false };
  assert.equal(verifyView(conflict, false, true, "Hridaya Ranjan Prasad Verma v. State of Bihar (2000) 4 SCC 168").note, CONFLICT_TEXT_WITH_NAME);
  assert.equal(verifyView(conflict, false, true, "(2000) 4 SCC 168").note, CONFLICT_TEXT);
  assert.equal(verifyView(conflict, false, true).note, CONFLICT_TEXT);
});

// pravrudhi#509 (R1, 15 Oct, byte-exact): the case-name sentence is an ADDITION after the IN_INDEX note, only for a found citation that carries a case name (#350's rule), one constant on every surface that says "Found in our index".
import { caseNameNote } from "./citationCheck";
import { CASE_NAME_NOT_COMPARED } from "./citationExistence";
const NAMED = "Hridaya Ranjan Prasad Verma v. State of Bihar (2000) 4 SCC 168";
const BARE = "(2000) 4 SCC 168";
const FOUND = { result: "IN_INDEX", note: "Found in the index (existence only): no quote was checked, so this is not a verification.", status: "in_index", label: "found", verified: false };
test("#509: the sentence is R1's, exactly, neutral, and none of the banned words", () => {
  assert.equal(CASE_NAME_NOT_COMPARED, "Only the citation was looked up; the case name you typed was not compared with the index.");
  assert.doesNotMatch(CASE_NAME_NOT_COMPARED, /verified|\breal\b|fake|correct|wrong/i);
});
test("#509 /citations and the Citations panel (verifyView): a named found line gets the sentence AFTER the existing note, which stays; a bare line, any other status and the arm off get none", () => {
  const named = verifyView(FOUND, false, true, NAMED);
  assert.equal(named.nameNote, CASE_NAME_NOT_COMPARED);
  assert.equal(named.note, FOUND.note, "the existing IN_INDEX note is not replaced");
  assert.equal(verifyView(FOUND, false, true, BARE).nameNote, null);
  assert.equal(verifyView(FOUND, false, true).nameNote, null, "no citation given: none");
  assert.equal(verifyView(FOUND, false, false, NAMED).nameNote, null, "arm off: the label is not 'Found in our index', so no sentence");
  for (const result of ["NOT_IN_INDEX", "CONFLICT", "MALFORMED", "EXISTS_QUOTE_NOT_FOUND", "EXISTS_QUOTE_FOUND"]) assert.equal(verifyView({ ...FOUND, result, status: result.toLowerCase() }, false, true, NAMED).nameNote, null, result);
});
test("#509 Intake's citation line (caseNameNote): the same rule on the citation text; a bare citation, a not-found one and an unknown status get none", () => {
  assert.equal(caseNameNote("IN_INDEX", NAMED, true), CASE_NAME_NOT_COMPARED);
  assert.equal(caseNameNote("VERIFIED", NAMED, true), CASE_NAME_NOT_COMPARED);
  assert.equal(caseNameNote("IN_INDEX", BARE, true), null);
  for (const st of ["NOT_IN_INDEX", "CONFLICT", "MALFORMED", "CHECK_UNAVAILABLE", "NOT_CHECKED", "something_new"]) assert.equal(caseNameNote(st, NAMED, true), null, st);
  assert.equal(caseNameNote("IN_INDEX", NAMED, false), null);
});
