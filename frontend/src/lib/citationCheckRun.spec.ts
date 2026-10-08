import { strict as assert } from "node:assert";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CitationCheckView } from "../components/citations/CitationCheck";
import { ApiError } from "./api";
import { CITATION_ERROR_TEXT } from "./signedStrings";
import { runCitationCheck, type CitationCheckState } from "./citationCheckRun";

// Invented citation and quote only.
const C = "(2020) 3 SCC 456";
const Q = "the party shall pay the sum in full";
const reply = (result: string, note = "A fixed note.") => async () => ({ result, note });

test("each engine status is shown verbatim, with its note, and the five are all known", async () => {
  for (const status of ["VERIFIED", "EXISTS_QUOTE_NOT_FOUND", "NOT_IN_INDEX", "MALFORMED", "CONFLICT"]) {
    const s = await runCitationCheck(reply(status), C, Q);
    assert.equal(s.phase, "result");
    if (s.phase !== "result") return;
    assert.equal(s.view.status, status);
    assert.equal(s.view.known, true);
    assert.equal(s.view.note, "A fixed note.");
  }
});

test("a status this build does not know is shown as sent and flagged, never reworded", async () => {
  const s = await runCitationCheck(reply("SOMETHING_NEW"), C, Q);
  assert.equal(s.phase, "result");
  if (s.phase !== "result") return;
  assert.equal(s.view.status, "SOMETHING_NEW");
  assert.equal(s.view.known, false);
  const html = renderToStaticMarkup(createElement(CitationCheckView, { state: s, onCheck: () => {}, citation: C }));
  assert.match(html, /SOMETHING_NEW/);
  assert.match(html, /does not know; it is shown as sent/);
});

test("the 503 citation_index_unavailable is an honest not-checked state with the signed sentence, and no status", async () => {
  const s = await runCitationCheck(async () => { throw new ApiError(503, "/api/v1/verify-citations", { code: "citation_index_unavailable" }); }, C, Q);
  assert.equal(s.phase, "error");
  if (s.phase !== "error") return;
  assert.equal(s.kind, "index_unavailable");
  assert.equal(s.message, CITATION_ERROR_TEXT.citation_index_unavailable);
  const html = renderToStaticMarkup(createElement(CitationCheckView, { state: s, onCheck: () => {}, citation: C }));
  assert.match(html, /was not checked/);
  assert.doesNotMatch(html, /citation-check-status|VERIFIED|NOT_IN_INDEX/);
});

test("the other refusals use the /citations wording: timeout, at capacity, signed out, rate limited, server, network", async () => {
  const kinds = async (e: unknown) => {
    const s = await runCitationCheck(async () => { throw e; }, C, Q);
    return s.phase === "error" ? s.kind : s.phase;
  };
  assert.equal(await kinds(new ApiError(503, "/x", { code: "verify_timeout" })), "timeout");
  assert.equal(await kinds(new ApiError(503, "/x", { code: "verify_at_capacity" })), "at_capacity");
  assert.equal(await kinds(new ApiError(401, "/x")), "signed_out");
  assert.equal(await kinds(new ApiError(429, "/x")), "rate_limited");
  assert.equal(await kinds(new ApiError(500, "/x")), "server");
  assert.equal(await kinds(new TypeError("fetch failed")), "network");
});

test("invalid input never calls the engine", async () => {
  let calls = 0;
  const verify = async () => { calls += 1; return { result: "VERIFIED", note: "x" }; };
  assert.equal((await runCitationCheck(verify, "", Q)).phase, "invalid");
  assert.equal((await runCitationCheck(verify, C, "  ")).phase, "invalid");
  assert.equal(calls, 0);
});

test("the view: idle shows only the button and the preview label; checking disables it; the label never says verified by itself", () => {
  const html = (state: CitationCheckState) => renderToStaticMarkup(createElement(CitationCheckView, { state, onCheck: () => {}, citation: C }));
  const idle = html({ phase: "idle" });
  assert.match(idle, /Check this citation/);
  assert.match(idle, /preview: accuracy not yet measured/);
  assert.doesNotMatch(idle, /citation-check-result|citation-check-error/);
  assert.match(html({ phase: "checking" }), /disabled/);
});
