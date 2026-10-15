import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CitationsPanelView } from "../components/citations/CitationsPanel";
import { ApiError } from "./api";
import { classifyVerifyError, statusLabel, verifyView } from "./citationCheck";
import {
  CONFLICT_HEADING, CONFLICT_TEXT, COVERAGE_LIMITS_TEXT, MALFORMED_HEADING, MALFORMED_TEXT, RETENTION_EXISTENCE, SIGNED_OUT_401_TEXT, SIGNED_OUT_BEFORE_TEXT,
} from "./citationExistence";
import { MAX_CITATIONS, MAX_CITATIONS_EXISTENCE, batchStopText, checkCitations, overCapText, parseCitationLines } from "./citationsPanel";
import { SESSION_401_TEXT } from "./signedStrings";

// Citations-ON readiness (#223, explorer's pre-flip review D1-D7; R1's exact strings, 15 Oct). Both arms: the ON arm (existence-only) shows the new wording; the OFF arm is unchanged.

test("R1's strings are exact (D1, D2a, D3, D4, D5, D7)", () => {
  assert.equal(CONFLICT_TEXT, "The index lists this citation under more than one entry, so we cannot tell which case you mean. Put the case name before the citation and check again.");
  assert.equal(CONFLICT_HEADING, "Matches more than one entry");
  assert.equal(MALFORMED_HEADING, "Not looked up");
  assert.equal(MALFORMED_TEXT, "We could not read this line as one citation, so we did not look it up. Enter one citation per line, for example (2099) 1 SCC 1. That does not show whether a citation is real.");
  assert.equal(COVERAGE_LIMITS_TEXT, "Our index covers Supreme Court citations in the form (year) volume SCC page. A neutral citation, an AIR citation or a High Court reporter citation is not covered and will come back as “Not found in our index”.");
  assert.equal(SIGNED_OUT_BEFORE_TEXT, "Citation checks need you to be signed in.");
  assert.equal(SIGNED_OUT_401_TEXT, "Sign in to check citations. Nothing was looked up.");
  assert.equal(batchStopText(3, 5, 42), "Checked 3 of 5 lines. The check allows only a few lookups a minute; try the rest in 42 seconds.");
  assert.equal(batchStopText(3, 5), "Checked 3 of 5 lines. The check allows only a few lookups a minute; try the rest in about a minute."); // no Retry-After (R1's ruling)
  assert.equal(overCapText(), "Only the first 5 lines were checked. Check the rest in a second try.");
  assert.equal(overCapText(MAX_CITATIONS_EXISTENCE), overCapText(), "the 5 is the one cap constant");
  assert.equal(RETENTION_EXISTENCE, "The citation check does not save the citation you enter.");
  for (const s of [CONFLICT_TEXT, MALFORMED_TEXT, SIGNED_OUT_401_TEXT, batchStopText(1, 2, 3), batchStopText(1, 2), overCapText()]) assert.doesNotMatch(s, /Nothing was scored|session has ended|Exactly one parseable/, s);
});

test("D1/D2a: CONFLICT and MALFORMED read as plain words with the ON arm; the OFF arm shows the tokens and the engine's notes as before", () => {
  const conflict = { result: "CONFLICT", note: "The citation maps to conflicting indexed cases; verify by hand." };
  const malformed = { result: "MALFORMED", note: "Exactly one parseable citation is required." };
  assert.equal(statusLabel("CONFLICT", true), CONFLICT_HEADING);
  assert.equal(verifyView(conflict, false, true).note, CONFLICT_TEXT);
  assert.equal(statusLabel("MALFORMED", true), MALFORMED_HEADING);
  assert.equal(verifyView(malformed, false, true).note, MALFORMED_TEXT);
  assert.equal(statusLabel("CONFLICT", false), "CONFLICT");
  assert.equal(verifyView(conflict, false, false).note, conflict.note);
  assert.equal(statusLabel("MALFORMED", false), "MALFORMED");
  assert.equal(verifyView(malformed, false, false).note, malformed.note);
});

test("D4: a 401 reads as 'Sign in to check citations. Nothing was looked up.' with the ON arm; the OFF arm keeps the session sentence", () => {
  const e = new ApiError(401, "/x");
  assert.deepEqual(classifyVerifyError(e, true), { kind: "signed_out", message: SIGNED_OUT_401_TEXT });
  assert.deepEqual(classifyVerifyError(e, false), { kind: "signed_out", message: SESSION_401_TEXT });
});

test("D5: with the ON arm a batch is capped at 5 lines per try (the OFF arm keeps 10) and stops at the first 429", async () => {
  const text = Array.from({ length: 8 }, (_, i) => `(2099) ${i + 1} SCC 1`).join("\n");
  assert.equal(MAX_CITATIONS_EXISTENCE, 5);
  assert.equal(parseCitationLines(text, true).items.length, 5);
  assert.equal(parseCitationLines(text, true).skipped, 3);
  assert.equal(parseCitationLines(text, false).items.length, 8);
  assert.equal(MAX_CITATIONS, 10);
  let calls = 0;
  const verify = async () => {
    calls += 1;
    if (calls === 3) throw new ApiError(429, "/x", { retryAfter: 42 });
    return { result: "NOT_IN_INDEX", note: "n" };
  };
  const rows = await checkCitations(verify, parseCitationLines(text, true).items, undefined, undefined, true);
  assert.equal(calls, 3, "no call after the first 429");
  assert.deepEqual(rows.map((r) => r.state.phase), ["result", "result", "error", "idle", "idle"]);
  const limited = rows[2].state;
  assert.ok(limited.phase === "error" && limited.kind === "rate_limited" && limited.wait === 42);
  // the OFF arm is unchanged: it goes on after a 429
  calls = 0;
  const off = await checkCitations(verify, parseCitationLines(text, false).items.slice(0, 5), undefined, undefined, false);
  assert.equal(calls, 5);
  assert.equal(off.length, 5);
});

test("D5: the panel shows the stop ONCE (no repeated rows, no 'Nothing was scored'); the OFF arm renders as before", async () => {
  const items = parseCitationLines("(2099) 1 SCC 1\n(2099) 2 SCC 1\n(2099) 3 SCC 1\n(2099) 4 SCC 1\n(2099) 5 SCC 1", true).items;
  let calls = 0;
  const rows = await checkCitations(async () => { calls += 1; if (calls === 3) throw new ApiError(429, "/x", { retryAfter: 42 }); return { result: "NOT_IN_INDEX", note: "n" }; }, items, undefined, undefined, true);
  const html = renderToStaticMarkup(createElement(CitationsPanelView, { rows: rows, skipped: 0, coverage: null, existenceOnly: true }));
  assert.equal((html.match(/data-testid="citations-panel-row"/g) ?? []).length, 2, "only the two checked lines are rows");
  assert.equal((html.match(/Checked 2 of 5 lines\./g) ?? []).length, 1);
  assert.match(html, /try the rest in 42 seconds\./);
  assert.doesNotMatch(html, /Nothing was scored|Too many requests/);
  const noWait = await checkCitations(async () => { throw new ApiError(429, "/x"); }, items.slice(0, 2), undefined, undefined, true);
  assert.match(renderToStaticMarkup(createElement(CitationsPanelView, { rows: noWait, skipped: 0, coverage: null, existenceOnly: true })), /Checked 0 of 2 lines\. The check allows only a few lookups a minute; try the rest in about a minute\./, "no Retry-After: 'about a minute', no invented number");
  // more lines than one try takes: the over-cap sentence (ON arm), once; the OFF arm keeps its count line
  const ok = await checkCitations(async () => ({ result: "NOT_IN_INDEX", note: "n" }), items, undefined, undefined, true);
  const over = renderToStaticMarkup(createElement(CitationsPanelView, { rows: ok, skipped: 3, coverage: null, existenceOnly: true }));
  assert.match(over, /Only the first 5 lines were checked\. Check the rest in a second try\./);
  assert.doesNotMatch(over, /more lines? not checked/);
  assert.match(renderToStaticMarkup(createElement(CitationsPanelView, { rows: ok, skipped: 3, coverage: null, existenceOnly: false })), /3 more lines not checked: at most 10 at a time\./);
});

test("D6: the panel's result area is a live region (role=status), present before any result", () => {
  const html = renderToStaticMarkup(createElement(CitationsPanelView, { rows: [], skipped: 0, coverage: null, existenceOnly: true }));
  assert.match(html, /role="status"/);
});
