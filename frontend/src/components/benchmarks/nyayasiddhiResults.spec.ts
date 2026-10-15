import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { NYAYASIDDHI_STRINGS, resolveStrings } from "@/lib/nyayasiddhi";
import { STATUSES, parseRows } from "@/lib/nyayasiddhiRows";
import { NyayaSiddhiResultsView } from "./NyayaSiddhiResults";

// R1's words, byte-exact (15 Oct 2026): the test holds its own copy, so a changed constant fails here.
const R1 = {
  heading: "NyayaSiddhi results",
  intro: "NyayaSiddhi is our benchmark for screening under Indian criminal law. Only signed runs appear here, and every figure is a development figure on material we have already seen, not a measure of how the product does on your matter.",
  tableCaption: "NyayaSiddhi runs, one card for each run",
  unitHeading: "Counted per", groupHeading: "Offence group", groupAll: "All groups",
  colSystem: "System", colStatus: "Status", colSplit: "Material", colRunDate: "Run date",
  stackLabel: "dev stack (local)",
  organiserEntry: { product: "Entered by the NyayaSiddhi organisers, who also built this system", reference_arm: "Run by the NyayaSiddhi organisers with prompts they wrote; not an outside entry" },
  zeroWithZero: "The system marked no item as supported here, so a count of 0 wrongly supported is not read on its own.",
  noItems: "No items in this group.", noFigure: "No figure for this group.", chartLabel: "Interval for", of: "of", intervalLabel: "exact 95% interval", to: "to",
  family: { CHEAT: "Cheating", TRUST: "Criminal breach of trust", NI138: "Dishonoured cheque", CRUELTY: "Cruelty by the husband or his relatives" },
  unit: { whole_item: "Whole item", element: "Each ingredient" },
  split: { obj1_dev: "Development items, already seen", obj1b_minus_cruelty: "Second development set, cruelty items left out" },
  status: { "self-reported": "Reported by the entrant", "re-scored": "Re-scored by the organisers", reproduced: "Reproduced by the organisers", "third-party verified": "Checked by an outside party" },
  measure: { false_proof: "Wrongly supported", coverage: "Coverage" },
  measureNote: { false_proof: "Counted over items the court did not establish: how many the system still marked as supported.", coverage: "Counted over items the court established: how many the system marked as supported." },
};

// INVENTED layout fixture (test-only, never shipped): the shape of signed rows from the result_row schema.
const m = (name: string, group: string, k: number, n: number, lo: number | null, hi: number | null) => ({ name, group, k, n, interval_method: "clopper-pearson-exact", interval_level: 0.95, ci_low: lo, ci_high: hi });
const row = (id: string, status: string, over: Record<string, unknown> = {}) => ({ row_id: id, status, benchmark_version: "v0.2", split: "obj1_dev", unit: "whole_item", system_name: "invented", system_version: "1", run_date: "2026-10-01", organiser_entry: true, entry_kind: "product", superseded_by: null,
  metrics: [m("false_proof", "ALL", 2, 40, 0.006, 0.169), m("coverage", "ALL", 30, 40, 0.588, 0.893), m("coverage", "CHEAT", 10, 12, 0.516, 0.979), m("false_proof", "CHEAT", 0, 12, 0, 0.265), m("coverage", "ODD", 1, 2, 0.013, 0.987), m("false_proof", "ODD", 0, 2, 0, 0.842)], ...over });
const ROWS = parseRows({ rows: STATUSES.map((st, i) => row(`r${i}`, st)) });
const html = () => renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: ROWS, strings: resolveStrings() }));

test("every constant is R1's exact string (and none is unset)", () => {
  assert.notEqual(resolveStrings(), null);
  assert.deepEqual(JSON.parse(JSON.stringify(NYAYASIDDHI_STRINGS)), R1);
});

test("the page shows R1's words: heading, intro, labels, status words, material words, measure names and notes", () => {
  const h = html();
  const decoded = h.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  for (const t of [R1.heading, R1.intro, R1.tableCaption, R1.unitHeading, R1.groupHeading, R1.groupAll, R1.colSystem, R1.colStatus, R1.colSplit, R1.colRunDate, R1.stackLabel, R1.organiserEntry.product, R1.split.obj1_dev, R1.unit.whole_item,
    R1.measure.false_proof, R1.measure.coverage, R1.measureNote.false_proof, R1.measureNote.coverage, ...Object.values(R1.status), R1.family.CHEAT]) assert.ok(decoded.includes(t), t);
  assert.ok(!decoded.includes(R1.family.TRUST), "a family with no row is not offered");
});

test("the figures: count, n, the exact interval printed, the chart repeats them; a group R1 has not worded (ODD) is not offered", () => {
  const h = html();
  for (const t of ["2 of 40", "exact 95% interval 0.6% to 16.9%", "30 of 40", "exact 95% interval 58.8% to 89.3%"]) assert.ok(h.includes(t), t);
  assert.equal((h.match(/data-testid="ns-chart"/g) ?? []).length, 2 * STATUSES.length);
  assert.ok(!h.includes("ODD"));
  assert.ok(h.includes('aria-label="Interval for: Wrongly supported, 2 of 40, exact 95% interval 0.6% to 16.9%"'));
});

test("the two organiser variants are chosen by the row's entry kind, never by a name; a row without a kind is not shown; an outside entry carries none", () => {
  const ref = parseRows({ rows: [row("ref", "self-reported", { system_name: "nyaya-product", entry_kind: "reference_arm" })] });
  const hr = renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: ref, strings: resolveStrings() }));
  assert.ok(hr.includes(R1.organiserEntry.reference_arm.replace("; ", "; ")) && !hr.includes(R1.organiserEntry.product), "a reference arm named nyaya-product still reads the reference-arm line");
  assert.equal(parseRows({ rows: [row("x", "self-reported", { entry_kind: undefined })] }).length, 0);
  assert.equal(parseRows({ rows: [row("y", "self-reported", { organiser_entry: false, entry_kind: "product" })] }).length, 0);
  const outside = parseRows({ rows: [row("o", "self-reported", { organiser_entry: false, entry_kind: undefined })] });
  const ho = renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: outside, strings: resolveStrings() }));
  assert.ok(!ho.includes(R1.organiserEntry.product) && !ho.includes(R1.organiserEntry.reference_arm));
});

test("no 'proof', 'verified', 'best', 'better', 'beat' or 'rank' anywhere on the rendered page, and no comparison between rows", () => {
  assert.doesNotMatch(html(), /proof|verified|\bbest\b|better|\bbeat\b|rank/i);
});

test("a row with nothing supported and nothing wrongly supported carries R1's never-read-alone line; one with coverage does not", () => {
  const zero = parseRows({ rows: [row("z", "self-reported", { metrics: [m("false_proof", "ALL", 0, 64, 0, 0.056), m("coverage", "ALL", 0, 30, 0, 0.116)] })] });
  const h0 = renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: zero, strings: resolveStrings() }));
  assert.ok(h0.includes(R1.zeroWithZero));
  assert.ok(!html().includes(R1.zeroWithZero));
});

test("no rows, no view: the page keeps its current text", () => {
  assert.equal(renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: [], strings: resolveStrings() })), "");
});
