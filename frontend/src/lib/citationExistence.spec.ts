import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { citationHasCaseName, citationHasTypedName } from "./citationCheck";
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
  assert.equal(CASE_NAME_NOT_COMPARED, "Only the citation was looked up; the case name you typed was not confirmed against the index.");
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

// pravrudhi#509 NAME_MISMATCH (R1, 16 Oct, byte-exact; engine 0.6.19). Per surface: (a) matched, (b) mismatch, (c) field absent, (d) unknown status.
import { NAME_MISMATCH_HEADING, NAME_MISMATCH_TEXT, UNKNOWN_STATUS_HEADING, UNKNOWN_STATUS_TEXT } from "./citationExistence";
import { citationExtra, citationLine } from "./intake";
const MISMATCH = { result: "NAME_MISMATCH", note: "engine note that R1 replaces", status: "name_mismatch", label: "Case name did not match", verified: false, name_compared: true };
test("#509 NAME_MISMATCH: R1's heading and note are byte-exact", () => {
  assert.equal(NAME_MISMATCH_HEADING, "Case name did not match");
  assert.equal(NAME_MISMATCH_TEXT, "We found this citation in our index, but the case name you typed does not appear to match the case it belongs to there. That does not show whether the citation or the name is right. Check both by hand.");
});
test("#509 /citations and the panel (verifyView, statusLabel): (a) matched drops the 'not compared' sentence; (b) mismatch shows the heading and R1's note, never the raw token or the engine's note; (c) the field absent is today's behaviour; (d) unknown is neutral", () => {
  // (a) IN_INDEX + name_compared true (EVERY typed party matched) + a named line: no addition (the note stays); a bare line gets none
  const matched = verifyView({ ...FOUND, name_compared: true }, false, true, NAMED);
  assert.equal(matched.nameNote, null); assert.equal(matched.note, FOUND.note); assert.equal(matched.known, true);
  assert.equal(verifyView({ ...FOUND, name_compared: true }, false, true, BARE).nameNote, null, "(b) bare line: none");
  assert.equal(verifyView({ ...FOUND, name_compared: true }, false, true).nameNote, null, "no citation given: none");
  assert.equal(verifyView({ ...FOUND, name_compared: true }, false, false, NAMED).nameNote, null, "arm off: none");
  assert.equal(verifyView({ ...FOUND, result: "VERIFIED", status: "verified", name_compared: true }, false, true, NAMED).nameNote, null);
  // (b) mismatch
  const mm = verifyView(MISMATCH, false, true, NAMED);
  assert.equal(mm.known, true); assert.equal(mm.note, NAME_MISMATCH_TEXT); assert.equal(mm.nameNote, null);
  assert.equal(statusLabel("NAME_MISMATCH", true), NAME_MISMATCH_HEADING); assert.equal(statusLabel("NAME_MISMATCH", false), NAME_MISMATCH_HEADING);
  assert.doesNotMatch(statusLabel("NAME_MISMATCH"), /NAME_MISMATCH/);
  // (c) absent / not a boolean true: today's behaviour
  assert.equal(verifyView(FOUND, false, true, NAMED).nameNote, CASE_NAME_NOT_COMPARED);
  for (const odd of [false, "true", 1, null]) assert.equal(verifyView({ ...FOUND, name_compared: odd as never }, false, true, NAMED).nameNote, CASE_NAME_NOT_COMPARED, String(odd));
  // (d) unknown: neutral, flagged unknown, never the raw token
  const unk = verifyView({ result: "SOMETHING_NEW", note: "x" }, false, true, NAMED);
  assert.equal(unk.known, false); assert.equal(unk.note, UNKNOWN_STATUS_TEXT); assert.equal(statusLabel("SOMETHING_NEW"), UNKNOWN_STATUS_HEADING);
  assert.equal(UNKNOWN_STATUS_HEADING, "Result not shown");
  assert.equal(statusLabel(""), "", "no status keeps the existing '(no status)' path");
});
test("#509 Intake (citationLine, citationExtra): (a) matched drops the sentence; (b) mismatch heading + R1's note; (c) absent = today's; (d) unknown is neutral and not 'Not checked.'", () => {
  const c = (verifierStatus: string, text = NAMED, nameCompared = false) => ({ verifierStatus, text, nameCompared });
  assert.equal(citationExtra(c("IN_INDEX", NAMED, true)), null); // (a) every party matched, named line: nothing added
  assert.equal(citationExtra(c("IN_INDEX", BARE, true)), null); // (b) bare line: none
  assert.equal(citationLine("IN_INDEX"), "Found in our index");
  assert.equal(citationLine("NAME_MISMATCH"), NAME_MISMATCH_HEADING); assert.equal(citationExtra(c("NAME_MISMATCH", NAMED, true)), NAME_MISMATCH_TEXT); // (b)
  assert.equal(citationExtra(c("NAME_MISMATCH", BARE, true)), NAME_MISMATCH_TEXT, "a mismatch always says so");
  assert.equal(citationExtra(c("IN_INDEX")), CASE_NAME_NOT_COMPARED); assert.equal(citationExtra(c("IN_INDEX", BARE)), null); // (c)
  assert.equal(citationLine("brand_new"), UNKNOWN_STATUS_TEXT); assert.notEqual(citationLine("brand_new"), "Not checked."); assert.equal(citationExtra(c("brand_new")), null); // (d)
  assert.equal(citationLine("NOT_CHECKED"), "Not checked.");
});

// pravrudhi-app#373 (P1): the caveat shows for ANY text before the citation's bracketed year (not only a recognised separator) unless the engine says name_compared is true. Track B's forms, per surface.
const FORMS_373: Array<[string, string]> = [
  ["v/s", "Totally Invented Pvt Ltd v/s Nobody (2014) 8 SCC 273"],
  ["-vs-", "Totally Invented Pvt Ltd -vs- Nobody (2014) 8 SCC 273"],
  ["In re", "In re Totally Invented Pvt Ltd (2014) 8 SCC 273"],
  ["and", "Totally Invented Pvt Ltd and Nobody (2014) 8 SCC 273"],
  ["no separator", "Totally Invented Pvt Ltd (2014) 8 SCC 273"],
  ["a single invented name", "Nobody (2014) 8 SCC 273"],
  ["Devanagari", "\u0905\u0928\u093E\u092E \u0915\u0902\u092A\u0928\u0940 (2014) 8 SCC 273"],
  ["v. (the old rule's case)", "Totally Invented Pvt Ltd v. Nobody (2014) 8 SCC 273"],
  ["an initial V", "G V Rao (2000) 3 SCC 693"],
  ["a name AFTER the citation", "(2014) 8 SCC 273 Totally Invented Pvt Ltd v. Nobody"],
  ["a single name after the citation", "(2014) 8 SCC 273 Nobody"],
  ["Devanagari after the citation", "(2014) 8 SCC 273 \u0905\u0928\u093E\u092E \u0915\u0902\u092A\u0928\u0940"],
  ["a list marker AND a name before", "1. Totally Invented Pvt Ltd (2014) 8 SCC 273"],
  ["a marker, See and a name", "(1) See Totally Invented Pvt Ltd (2014) 8 SCC 273"],
  ["a quoted name", "\"Totally Invented Pvt Ltd\" (2014) 8 SCC 273"],
  ["Track B: v/s before a plain-year Supp key", "Totally Invented Pvt Ltd v/s Nobody 1992 Supp (1) SCC 335"],
  ["Track B: -vs- before a plain-year Supp key", "Totally Invented Pvt Ltd -vs- Nobody 1992 Supp (1) SCC 335"],
  ["Track B: In re before a plain-year Supp key", "In re Totally Invented Pvt Ltd 1992 Supp (1) SCC 335"],
  ["Track B: SCC (SUPP) alias with a name", "Totally Invented Pvt Ltd v/s Nobody 1992 SCC (SUPP) 1 335"],
  ["Track B: a name after a plain-year Supp key", "1992 Supp (1) SCC 335 Totally Invented Pvt Ltd v/s Nobody"],
  ["a reporter the index does not hold (fail-closed)", "(2014) 3 SCC (L&S) 92"],
  ["another reporter (fail-closed)", "(1994) Cri LJ 123"],
  ["no year at all (fail-closed)", "Nobody"],
  ["AIR form (fail-closed)", "AIR 1950 SC 27"],
];
// harmless text beside a citation that is NOT a typed name: list markers, quotes, See/Ref/Cf/Citation, trailing punctuation (numbered lists are a common paste format)
const BARE_373 = ["(2014) 8 SCC 273", "  (2014) 8 SCC 273", "(2014)8 SCC 273", "1. (2014) 8 SCC 273", "- (2014) 8 SCC 273", "(1) (2014) 8 SCC 273", "[1] (2014) 8 SCC 273", "\u2022 (2014) 8 SCC 273", "See (2014) 8 SCC 273", "Ref: (2014) 8 SCC 273",
  "Citation: (2014) 8 SCC 273", "cf. (2014) 8 SCC 273", "SEE: (2014) 8 SCC 273", "\"(2014) 8 SCC 273\"", "'(2014) 8 SCC 273'", "1. See (2014) 8 SCC 273", "(2014) 8 SCC 273.", "(2014) 8 SCC 273;  ", "2) Ref. (2014) 8 SCC 273,",
  "(1970) Supp (3) SCC 253", "(1971) Supp SCC 359", "1992 Supp (1) SCC 335", "2014 8 SCC 273", "1992 SCC (SUPP) 1 335", "1992 Supp. SCC 335", "See 1992 Supp (1) SCC 335", "1. 2014 8 SCC 273."];
test("#373 the text-before-year rule: any text before the bracketed year counts; a bare citation, no year part, an empty line and a non-string do not", () => {
  for (const [name, line] of FORMS_373) assert.equal(citationHasTypedName(line), true, name);
  for (const line of BARE_373) assert.equal(citationHasTypedName(line), false, line);
  for (const x of ["", "   ", "(2014)", "1.", "(1)", "See:", undefined, null, 42]) assert.equal(citationHasTypedName(x), false, String(x)); // nothing to judge: no letter left, or not a string
  assert.equal(citationHasCaseName("Totally Invented Pvt Ltd v/s Nobody (2014) 8 SCC 273"), false, "#350's separator rule is untouched (it still picks the CONFLICT sentence)");
});
test("#373 /citations and the Citations panel (verifyView): every form shows R1's existing sentence after the note when the engine did not confirm the name; name_compared TRUE shows nothing; a bare citation shows nothing", () => {
  for (const [name, line] of FORMS_373) {
    assert.equal(verifyView(FOUND, false, true, line).nameNote, CASE_NAME_NOT_COMPARED, `${name}: field absent`);
    assert.equal(verifyView(FOUND, false, true, line).note, FOUND.note, `${name}: the note stays`);
    for (const odd of [false, "true", 1, null]) assert.equal(verifyView({ ...FOUND, name_compared: odd as never }, false, true, line).nameNote, CASE_NAME_NOT_COMPARED, `${name}: name_compared ${String(odd)}`);
    assert.equal(verifyView({ ...FOUND, name_compared: true }, false, true, line).nameNote, null, `${name}: name_compared TRUE: no caveat`);
    assert.equal(verifyView(FOUND, false, false, line).nameNote, null, `${name}: arm off`);
  }
  for (const line of BARE_373) assert.equal(verifyView(FOUND, false, true, line).nameNote, null, line);
  for (const result of ["NOT_IN_INDEX", "CONFLICT", "MALFORMED", "NAME_MISMATCH"]) assert.equal(verifyView({ ...FOUND, result, status: result.toLowerCase() }, false, true, FORMS_373[0][1]).nameNote, null, result);
});
test("#373 Intake (citationExtra, same rule): every form gets the sentence unless name_compared is true; a mismatch keeps R1's mismatch note", () => {
  const c = (verifierStatus: string, text: string, nameCompared = false) => ({ verifierStatus, text, nameCompared });
  for (const [name, line] of FORMS_373) {
    assert.equal(citationExtra(c("IN_INDEX", line)), CASE_NAME_NOT_COMPARED, name);
    assert.equal(citationExtra(c("IN_INDEX", line, true)), null, `${name}: true`);
  }
  for (const line of BARE_373) assert.equal(citationExtra(c("IN_INDEX", line)), null, line);
  assert.equal(citationExtra(c("NAME_MISMATCH", FORMS_373[0][1], true)), NAME_MISMATCH_TEXT);
});

// R2's regression (16 Oct): the engine's OWN recognised citations, typed as BARE citations, must never read as a typed name (every Supp citation was flagged); and any real key with a name typed beside it must still be flagged.
test("#373 over the engine's real citation keys (11,164), in the bracketed AND the plain-year form (and the SCC (SUPP) alias): no bare key carries a typed name; a name before or after any key is caught", () => {
  const doc = JSON.parse(readFileSync(join(__dirname, "..", "..", "e2e", "fixtures", "engineCitationKeys.json"), "utf8")) as { sourceSha256: string; keys: string[] };
  assert.match(doc.sourceSha256, /^[0-9a-f]{64}$/);
  assert.equal(doc.keys.length, 11164);
  const plain = (k: string): string => k.replace(/^\((\d{4})\)/, "$1");
  const forms: Record<string, (k: string) => string> = {
    bracketed: (k) => k,
    plain,
    alias: (k) => plain(k).replace(/^(\d{4}) Supp \((\d+)\) SCC (\d+)$/, "$1 SCC (SUPP) $2 $3"),
  };
  for (const [name, f] of Object.entries(forms)) {
    const flagged = doc.keys.filter((k) => citationHasTypedName(f(k)));
    assert.deepEqual(flagged.slice(0, 10), [], `${name}: ${flagged.length} bare keys read as carrying a name`);
    const missed = doc.keys.filter((k) => !citationHasTypedName(`Totally Invented Pvt Ltd v/s Nobody ${f(k)}`) || !citationHasTypedName(`1. Nobody ${f(k)}`) || !citationHasTypedName(`${f(k)} Totally Invented Pvt Ltd v/s Nobody`) || !citationHasTypedName(`${f(k)} Nobody`));
    assert.deepEqual(missed.slice(0, 10), [], `${name}: ${missed.length} keys where a typed name was not caught`);
  }
});

// R2's performance finding (16 Oct): the citation core must be LINEAR: a pasted junk line of CITATION_MAX (500) characters, in any of these shapes, must be judged in well under 50 ms (the check runs in the browser on /citations, the Screening panel and Intake).
test("#373 time budget: worst-case 500-character shapes and a seeded fuzz of 500-character inputs are each judged in under 50 ms", () => {
  const N = 500;
  const shapes: Record<string, string> = {
    letters_after_year: "(2014) " + "a".repeat(N - 7), letters_upper: "(2014) " + "A".repeat(N - 7), repeated_short_words: "(2014) " + "a ".repeat(N / 2), repeated_Supp: "(2014) " + "Supp ".repeat(N / 5),
    repeated_Supp_parens: "(2014) " + "Supp (1) ".repeat(N / 9), long_digits: "(2014) " + "1".repeat(N - 7), digits_then_letters: "(2014) " + "1a".repeat(N / 2), unclosed_parens: "(2014) 8 SCC (" + "(".repeat(N),
    unclosed_year_parens: "(".repeat(N), paren_spaces: "(" + " ".repeat(N), repeated_year_open: "( ".repeat(N / 2), many_reporter_words: "(2014) " + "SCC OnLine SC Cri LJ AIR ".repeat(N / 25), words_12_chars: "(2014) " + "abcdefghijkl ".repeat(N / 13),
    mixed_scripts: "(2014) " + "अनाम a ".repeat(N / 7), markers: "1. ".repeat(N / 3) + "(2014) 8 SCC 273", quotes_see: "See Ref Cf Citation: ".repeat(N / 21) + "(2014) 8 SCC 273", spaces_then_cite: " ".repeat(N - 20) + "(2014) 8 SCC 273", many_years: "(2014) ".repeat(N / 7),
  };
  const timed = (s: string): number => { const t = performance.now(); citationHasTypedName(s); return performance.now() - t; };
  for (const [name, line] of Object.entries(shapes)) assert.ok(timed(line) < 50, `${name} took too long`);
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const alphabet = ["(", ")", " ", "1", "2", "a", "B", "S", "C", ".", "&", "-", "[", "]", "अ", "Supp", "SCC", "AIR", "\"", "'"];
  let worst = 0;
  for (let i = 0; i < 300; i++) { let s = ""; while (s.length < N) s += alphabet[Math.floor(rnd() * alphabet.length)]; worst = Math.max(worst, timed(s.slice(0, N))); }
  assert.ok(worst < 50, `a random 500-character input took ${worst.toFixed(1)} ms`);
});
