import { strict as assert } from "node:assert";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CitationsPanelView, panelCoverage } from "../components/citations/CitationsPanel";
import { COVERAGE_NOT_REPORTED, NO_QUOTE_TEXT, checkCitations, parseCitationLines } from "./citationsPanel";
import { ApiError } from "./api";

const render = (rows: Parameters<typeof CitationsPanelView>[0]["rows"], skipped = 0, coverage: string | null = null) =>
  renderToStaticMarkup(createElement(CitationsPanelView, { rows, skipped, coverage }));

test("the panel shows each status verbatim, the no-quote line, an honest 503, the skipped count and the coverage line", async () => {
  let n = 0;
  const verify = async () => {
    n += 1;
    if (n === 2) throw new ApiError(503, "/x", { code: "citation_index_unavailable" });
    return { result: n === 1 ? "VERIFIED" : "NOT_IN_INDEX", note: "A fixed note.", coverage: "Supreme Court judgments only." };
  };
  const rows = await checkCitations(verify, parseCitationLines("(2020) 3 SCC 456 | the words\nB | q\nno quote here\nD | q").items);
  const html = render(rows, 2, panelCoverage(rows));
  assert.match(html, />VERIFIED</);
  assert.match(html, />NOT_IN_INDEX</);
  assert.match(html, /was not checked/); // the signed index-unavailable sentence, not a status
  assert.match(html, new RegExp(NO_QUOTE_TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /2 more lines not checked: at most 10 at a time\./);
  assert.match(html, /Supreme Court judgments only\./);
  assert.doesNotMatch(html, /fake|invalid|false/i);
});

test("with no coverage in any reply the line is the plain fallback, never a typed-in claim", async () => {
  const rows = await checkCitations(async () => ({ result: "NOT_IN_INDEX", note: "n" }), parseCitationLines("A | q").items);
  assert.equal(panelCoverage(rows), COVERAGE_NOT_REPORTED);
  assert.doesNotMatch(render(rows, 0, panelCoverage(rows)), /Supreme/);
});
