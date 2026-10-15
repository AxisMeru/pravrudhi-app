import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { resolveStrings, NYAYASIDDHI_STRINGS, type NyayaSiddhiStrings } from "@/lib/nyayasiddhi";
import { parseRows } from "@/lib/nyayasiddhiRows";
import { NyayaSiddhiResultsView } from "./NyayaSiddhiResults";

// INVENTED layout fixture and INVENTED words (test-only, never shipped): the real words are R1's.
const W: NyayaSiddhiStrings = {
  heading: "H1", intro: "INTRO", tableCaption: "CAP", colSystem: "SYS", colStatus: "STAT", colSplit: "SPL", colRunDate: "DATE", colStack: "STACK", stackUnknown: "NOSTACK", unitHeading: "UNITH", groupHeading: "GRPH", groupAll: "ALLG",
  unit: { whole_item: "WHOLE", element: "ELEM" }, split: { obj1_dev: "DEV", obj1b_minus_cruelty: "MINUS" },
  status: { "self-reported": "SELF", "re-scored": "RESC", reproduced: "REPR", "third-party verified": "TPV" },
  measure: { false_proof: "FP", coverage: "COV" }, measureNote: { false_proof: "FPN", coverage: "COVN" },
  of: "of", intervalLabel: "exact 95% interval", to: "to", noItems: "NOITEMS", chartLabel: "CHART", noFigure: "NOFIG",
};
const m = (name: string, group: string, k: number, n: number, lo: number | null, hi: number | null) => ({ name, group, k, n, interval_method: "clopper-pearson-exact", interval_level: 0.95, ci_low: lo, ci_high: hi });
const ROWS = parseRows({ rows: [{ row_id: "a", status: "self-reported", benchmark_version: "v", split: "obj1_dev", unit: "whole_item", system_name: "invented", system_version: "1", run_date: "2026-10-01", stack: "dev stack (local)",
  metrics: [m("false_proof", "ALL", 2, 40, 0.006, 0.169), m("coverage", "ALL", 30, 40, 0.588, 0.893)], superseded_by: null }] });

test("the production words are all unset, so the view shows nothing until R1 words them", () => {
  assert.equal(resolveStrings(), null);
  assert.equal(renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: ROWS, strings: resolveStrings() })), "");
  const partial = JSON.parse(JSON.stringify(NYAYASIDDHI_STRINGS));
  assert.equal(resolveStrings(partial), null);
});

test("with words and rows: the count, n and the exact interval are printed, the chart repeats them, and no comparative or ranking is worded", () => {
  const html = renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: ROWS, strings: W }));
  for (const t of ["H1", "INTRO", "SELF", "dev stack (local)", "2 of 40", "exact 95% interval 0.6% to 16.9%", "30 of 40", "exact 95% interval 58.8% to 89.3%", "FP", "COV"]) assert.ok(html.includes(t), t);
  assert.equal((html.match(/data-testid="ns-chart"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /better|worse|best|rank|outperform|beats|winner/i);
});

test("no rows, no view", () => {
  assert.equal(renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: [], strings: W })), "");
});
