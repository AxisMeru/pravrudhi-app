import { strict as assert } from "node:assert";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CitationsPanelView, panelCoverage } from "../components/citations/CitationsPanel";
import { COVERAGE_NOT_REPORTED, checkCitations, parseCitationLines } from "./citationsPanel";
import { ApiError } from "./api";

const render = (rows: Parameters<typeof CitationsPanelView>[0]["rows"], skipped = 0, coverage: string | null = null) =>
  renderToStaticMarkup(createElement(CitationsPanelView, { rows, skipped, coverage }));

test("the panel shows each status verbatim, an existence-only answer, an honest 503, the skipped count and the coverage line", async () => {
  let n = 0;
  const verify = async () => {
    n += 1;
    if (n === 2) throw new ApiError(503, "/x", { code: "citation_index_unavailable" });
    return { result: n === 1 ? "VERIFIED" : n === 3 ? "IN_INDEX" : "NOT_IN_INDEX", note: "A fixed note.", coverage: { resolvable_cases: 7, courts_resolvable: { "Supreme Court": 5, "Delhi High Court": 2 }, year_min: 1980, year_max: 1990, note: "SCC-family" } };
  };
  const rows = await checkCitations(verify, parseCitationLines("(2020) 3 SCC 456 | the words\nB | q\nno quote here\nD | q").items);
  const html = render(rows, 2, panelCoverage(rows));
  assert.match(html, />VERIFIED</);
  assert.match(html, />NOT_IN_INDEX</);
  assert.match(html, /was not checked/); // the signed index-unavailable sentence, not a status
  assert.match(html, />IN_INDEX</); // the no-quote line was sent and answered with its own status
  assert.doesNotMatch(html, /Not checked: add the quoted words/);
  assert.match(html, /2 more lines not checked: at most 10 at a time\./);
  assert.match(html, /Citations resolve for 7 judgments from 2 court labels \(Supreme Court 5; other courts 2\), with years 1980 to 1990/);
  assert.doesNotMatch(html, /fake|invalid|false/i);
});

test("with no coverage in any reply the line is the plain fallback, never a typed-in claim", async () => {
  const rows = await checkCitations(async () => ({ result: "NOT_IN_INDEX", note: "n" }), parseCitationLines("A | q").items);
  assert.equal(panelCoverage(rows), COVERAGE_NOT_REPORTED);
  assert.doesNotMatch(render(rows, 0, panelCoverage(rows)), /Supreme/);
});
