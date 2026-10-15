import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { NYAYASIDDHI_STRINGS, resolveStrings } from "@/lib/nyayasiddhi";
import { STATUSES, errorLineFor, parseRows } from "@/lib/nyayasiddhiRows";
import { NyayaSiddhiResultsView } from "./NyayaSiddhiResults";

// R1's words, byte-exact (15 Oct 2026): the test holds its own copy, so a changed constant fails here.
const R1 = {
  heading: "NyayaSiddhi results",
  intro: "NyayaSiddhi is our benchmark for screening under Indian criminal law. Only signed runs appear here, and every figure is a development figure on material we have already seen, not a measure of how the product does on your matter.",
  benchmarksSupplyLine: "For now the board holds only our own rows. A larger hidden set depends on the supply of suitable court items, and we promise no date.",
  tableCaption: "NyayaSiddhi runs, one card for each run",
  unitHeading: "How the system decides each item", groupHeading: "Offence group", groupAll: "All groups",
  colSystem: "System", colStatus: "Status", colSplit: "Material", colRunDate: "Run date",
  stackLabel: { "dev stack (local)": "dev stack (local)", "Anthropic API (organiser-run reference arm; not the dev stack, not the production stack)": "Anthropic API; not our dev stack or production stack" },
  organiserEntry: { product: "Entered by the NyayaSiddhi organisers, who also built this system", reference_arm: "Run by the NyayaSiddhi organisers with prompts they wrote; not an outside entry" },
  errorLeadIn: "{e} gave an error. Errors are counted as not supported here; counted as supported, ",
  errorPartWrong: "wrongly supported would be {k} of {n}",
  errorPartCoverage: "coverage would be {c} of {m}",
  errorJoin: " and ",
  errorEnd: ".",
  aboutRun: "About this run",
  unitNote: "Every figure on this page counts items, however the system decides them.",
  notRunGroup: "Not run: this system was not given dishonoured-cheque items, which are outside its contracts.",
  notRunAll: "Dishonoured-cheque items were not given to this system; the figures for All groups count them as not supported.",
  ni138Note: "Dishonoured cheque is not a product contract; a result of 'supported' here is not a product result.",
  orderLine: "Rows are listed in a fixed order, by split and system name, never by a figure.",
  zeroWithZero: "The system marked no item as supported here, so a count of 0 wrongly supported is not read on its own.",
  noItems: "No items in this group.", noFigure: "No figure for this group.", chartLabel: "Interval for", of: "of", intervalLabel: "exact 95% interval", to: "to",
  family: { CHEAT: "Cheating", TRUST: "Criminal breach of trust", NI138: "Dishonoured cheque", CRUELTY: "Cruelty by the husband or his relatives" },
  unit: { whole_item: "Whole item at once", element: "Ingredient by ingredient" },
  split: { obj1_dev: "Development items; used to design fixes, so seen by us", obj1b_minus_cruelty: "Second development set, cruelty items left out; exposed to Anthropic in an earlier study" },
  status: { "self-reported": "Reported by the entrant", "re-scored": "Re-scored by the organisers", reproduced: "Reproduced by the organisers", "third-party verified": "Checked by an outside party" },
  measure: { false_proof: "Wrongly supported", coverage: "Coverage" },
  measureNote: { false_proof: "Counted over items the court did not establish: how many the system still marked as supported.", coverage: "Counted over items the court established: how many the system marked as supported." },
};

// INVENTED layout fixture (test-only, never shipped): the shape of signed rows from the result_row schema.
const m = (name: string, group: string, k: number, n: number, lo: number | null, hi: number | null) => ({ name, group, k, n, interval_method: "clopper-pearson-exact", interval_level: 0.95, ci_low: lo, ci_high: hi });
const row = (id: string, status: string, over: Record<string, unknown> = {}) => ({ row_id: id, status, benchmark_version: "v0.2", split: "obj1_dev", unit: "whole_item", system_name: "invented", system_version: "1", run_date: "2026-10-01", stack: "dev stack (local)", organiser_entry: true, entry_kind: "product", superseded_by: null, n_error: 0,
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
  for (const t of [R1.heading, R1.intro, R1.benchmarksSupplyLine, R1.tableCaption, R1.unitHeading, R1.groupHeading, R1.groupAll, R1.colSystem, R1.colStatus, R1.colSplit, R1.colRunDate, R1.stackLabel["dev stack (local)"], R1.organiserEntry.product, R1.split.obj1_dev, R1.unit.whole_item,
    R1.measure.false_proof, R1.measure.coverage, R1.measureNote.false_proof, R1.measureNote.coverage, ...Object.values(R1.status), R1.family.CHEAT]) assert.ok(decoded.includes(t), t);
  assert.ok(!decoded.includes(R1.family.TRUST), "a family with no row is not offered");
});

test("the supply line is shown once, directly under the intro, and nothing about a hidden split, a Space, a leaderboard or 'coming soon' is on the page", () => {
  const h = html();
  assert.equal((h.match(/For now the board holds only our own rows\./g) ?? []).length, 1);
  assert.ok(h.indexOf("NyayaSiddhi is our benchmark") < h.indexOf("For now the board holds") && h.indexOf("For now the board holds") < h.indexOf("How the system decides each item"));
  const text = h.replace(/<[^>]+>/g, " ").replace("A larger hidden set depends on the supply of suitable court items, and we promise no date.", "");
  assert.doesNotMatch(text, /hidden|leaderboard|\bSpace\b|coming soon|\bsoon\b/i);
});

test("the figures: count, n, the exact interval printed, the chart repeats them; a group R1 has not worded (ODD) is not offered", () => {
  const h = html();
  for (const t of ["2 of 40", "exact 95% interval 0.6% to 16.9%", "30 of 40", "exact 95% interval 58.8% to 89.3%"]) assert.ok(h.includes(t), t);
  assert.equal((h.match(/data-testid="ns-chart"/g) ?? []).length, 2 * STATUSES.length);
  assert.ok(!h.includes("ODD"));
  assert.ok(h.includes('aria-label="Interval for: Wrongly supported, 2 of 40, exact 95% interval 0.6% to 16.9%"'));
});

test("the two organiser variants are chosen by the row's entry kind, never by a name; a row without a kind is not shown; an outside entry carries none", () => {
  const ref = parseRows({ rows: [row("ref", "self-reported", { system_name: "nyaya-product", entry_kind: "reference_arm", about_run: ["A line."] })] });
  const hr = renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: ref, strings: resolveStrings() }));
  assert.ok(hr.includes(R1.organiserEntry.reference_arm.replace("; ", "; ")) && !hr.includes(R1.organiserEntry.product), "a reference arm named nyaya-product still reads the reference-arm line");
  assert.equal(parseRows({ rows: [row("x", "self-reported", { entry_kind: undefined })] }).length, 0);
  assert.equal(parseRows({ rows: [row("y", "self-reported", { organiser_entry: false, entry_kind: "product" })] }).length, 0);
  const outside = parseRows({ rows: [row("o", "self-reported", { organiser_entry: false, entry_kind: undefined })] });
  const ho = renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: outside, strings: resolveStrings() }));
  assert.ok(!ho.includes(R1.organiserEntry.product) && !ho.includes(R1.organiserEntry.reference_arm));
});

test("the errors line: only when the row had errors AND counting them the other way changes the shown group's figure; its numbers come from the data", () => {
  const sens = { "false_proof|ALL": { k_as_proof: 1, k_as_not_proof: 0, n: 64, agree: false }, "false_proof|CHEAT": { k_as_proof: 0, k_as_not_proof: 0, n: 27, agree: true } };
  const withErr = parseRows({ rows: [row("e", "self-reported", { n_error: 1, error_sensitivity: sens, metrics: [m("false_proof", "ALL", 0, 64, 0, 0.056), m("coverage", "ALL", 5, 30, 0.056, 0.347), m("false_proof", "CHEAT", 0, 27, 0, 0.128), m("coverage", "CHEAT", 5, 7, 0.29, 0.96)] })] });
  const h = renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: withErr, strings: resolveStrings() }));
  assert.ok(h.includes("1 gave an error. Errors are counted as not supported here; counted as supported, wrongly supported would be 1 of 64."));
  assert.ok(!renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: ROWS, strings: resolveStrings() })).includes("gave an error"), "no line when n_error is 0");
  const noErr = parseRows({ rows: [row("n", "self-reported", { n_error: 0, error_sensitivity: sens })] });
  assert.ok(!renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: noErr, strings: resolveStrings() })).includes("gave an error"));
  assert.deepEqual(errorLineFor(withErr[0], "ALL"), { e: 1, wrong: { k: 1, n: 64 } });
  assert.equal(errorLineFor(withErr[0], "CHEAT"), null, "the two mappings agree for this group");
});

const API_STACK = "Anthropic API (organiser-run reference arm; not the dev stack, not the production stack)";
test("the stack label is per row, keyed on the manifest's stack: the API stack reads R1's API label and never 'dev stack (local)'; an unknown stack shows no row (fail closed)", () => {
  const html1 = (rows: ReturnType<typeof parseRows>) => renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows, strings: resolveStrings() }));
  const api = parseRows({ rows: [row("api", "self-reported", { stack: API_STACK, organiser_entry: true, entry_kind: "reference_arm", about_run: ["A line."] })] });
  const h = html1(api);
  assert.ok(h.includes("Anthropic API; not our dev stack or production stack"));
  assert.ok(!h.includes("dev stack (local)"), "an API row never says dev stack (local)");
  const dev = html1(parseRows({ rows: [row("dev", "self-reported")] }));
  assert.ok(dev.includes("dev stack (local)") && !dev.includes("Anthropic API"));
  const unknown = parseRows({ rows: [row("u", "self-reported", { stack: "some other stack" })] });
  assert.equal(unknown.length, 1, "the parser keeps it");
  assert.equal(html1(unknown), "", "but the view shows nothing for a stack it has no words for");
  // inherited object keys are not stacks: the view must show no row and must not throw (R2, #351)
  for (const bad of ["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"]) {
    const rowsBad = parseRows({ rows: [row("p", "self-reported", { stack: bad })] });
    assert.equal(rowsBad.length, 1, `${bad}: the parser keeps it`);
    assert.equal(html1(rowsBad), "", `${bad}: the view shows nothing`);
  }
  const mixed = html1(parseRows({ rows: [row("dev", "self-reported"), row("u", "self-reported", { stack: "some other stack" })] }));
  assert.equal((mixed.match(/data-testid="ns-row"/g) ?? []).length, 1);
});

test("the errors line has three byte-exact parts: both parts joined when both figures change, one part when one does, and no line when neither (R1, 15 Oct)", () => {
  const html1 = (extra: Record<string, unknown>) => renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: parseRows({ rows: [row("e", "self-reported", { n_error: 2, ...extra })] }), strings: resolveStrings() }));
  const both = { "false_proof|ALL": { k_as_proof: 4, k_as_not_proof: 3, n: 64, agree: false }, "coverage|ALL": { k_as_proof: 24, k_as_not_proof: 23, n: 107, agree: false } };
  const lead = "2 gave an error. Errors are counted as not supported here; counted as supported, ";
  assert.ok(html1({ error_sensitivity: both }).includes(lead + "wrongly supported would be 4 of 64 and coverage would be 24 of 107."), "both parts, joined");
  const onlyWrong = html1({ error_sensitivity: { ...both, "coverage|ALL": { k_as_proof: 23, k_as_not_proof: 23, n: 107, agree: true } } });
  assert.ok(onlyWrong.includes(lead + "wrongly supported would be 4 of 64."));
  assert.ok(!onlyWrong.includes("coverage would be"), "never 'would be' with an unchanged figure");
  const onlyCov = html1({ error_sensitivity: { ...both, "false_proof|ALL": { k_as_proof: 3, k_as_not_proof: 3, n: 64, agree: true } } });
  assert.ok(onlyCov.includes(lead + "coverage would be 24 of 107."));
  assert.ok(!onlyCov.includes("wrongly supported would be"));
  const neither = html1({ error_sensitivity: { "false_proof|ALL": { k_as_proof: 3, k_as_not_proof: 3, n: 64, agree: true }, "coverage|ALL": { k_as_proof: 23, k_as_not_proof: 23, n: 107, agree: true } } });
  assert.ok(!neither.includes("gave an error"), "no line when neither differs");
  assert.ok(!html1({ n_error: 0, error_sensitivity: both }).includes("gave an error"), "no line when there were no errors");
  const rowsBoth = parseRows({ rows: [row("e", "self-reported", { n_error: 2, error_sensitivity: both })] });
  assert.deepEqual(errorLineFor(rowsBoth[0], "ALL"), { e: 2, wrong: { k: 4, n: 64 }, coverage: { c: 24, m: 107 } });
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

// R1's "About this run" lines (15 Oct): the shipped data carries them per reference row, copied by the data build from each signed manifest's notes (the builder's tests read the manifests); here the page data is pinned sentence by sentence per row type.
const SMOKE = "The prompt's output-format line was changed after a smoke test on five invented items; no real item was used for that test.";
const TRAINED = "trained_on_public_items is false because we did not train or tune this model; what its vendor trained it on is not known to us.";
const PREFACE = /^In \d+ of \d+ replies, the model wrote explanatory text before its answer object; the first answer object was counted as its answer\. Counted after the run, from the call log\.$/;
const NO_SEED = "No seed: the API offers none.";
const SHIPPED = (JSON.parse(readFileSync(join(__dirname, "..", "..", "data", "nyayasiddhi", "rows.json"), "utf8")) as { rows: Record<string, unknown>[] }).rows;
const aboutOf = (kind: string, system: string) => SHIPPED.filter((r) => r.entry_kind === kind && String(r.system_name).includes(system)).map((r) => r.about_run as string[]);

test("About this run: every reference row carries R1's lines, in order, per row type; a product row carries none", () => {
  assert.equal(SHIPPED.filter((r) => r.entry_kind === "reference_arm").length, 6);
  for (const r of SHIPPED.filter((x) => x.entry_kind === "product")) assert.equal(r.about_run, undefined);
  const common = (l: string[]) => { assert.equal(l[0], SMOKE); assert.match(l[1], PREFACE); assert.equal(l[2], TRAINED); assert.match(l[3], /^not checked: /); };
  const direct = aboutOf("reference_arm", "S-direct"), harness = aboutOf("reference_arm", "S-harness"), open = aboutOf("reference_arm", "O2");
  assert.equal(direct.length, 2); assert.equal(harness.length, 2); assert.equal(open.length, 2);
  for (const l of direct) {
    common(l);
    assert.equal(l[4], "This arm was run again after a first 20-item run was stopped because a reply used up its output limit before giving an answer; the output limit was raised from 400 to 1000 tokens; no verdict from the stopped run was read or used.");
    assert.equal(l[5], NO_SEED); assert.equal(l.length, 6);
  }
  for (const l of harness) {
    common(l);
    assert.equal(l[4], "Element by element against ONE pinned contract per family");
    assert.equal(l[5], "Not a copy of the product's contract selection; never read beside the product row as the same task.");
    assert.equal(l[6], "the check shows that the cited sentence exists, not that it supports the element");
    assert.equal(l[7], NO_SEED); assert.equal(l.length, 8);
  }
  for (const l of open) {
    common(l);
    assert.match(l[4], /^In \d+ of \d+ replies, the model wrote a complete answer object and then kept writing until it reached its output limit; the first answer object was counted as its answer\.$/);
    assert.match(l[5], /^Not served \(context rule: prompt tokens counted by the served model's own tokenizer \+ max_tokens 400 must fit the served max-model-len 4096; never truncated\): \d+ of \d+ scored items$/);
    assert.equal(l[6], "Deviation from the registration: no vLLM seed was set (the registration named seed 682); decoding used temperature 0.");
    assert.ok(!l.includes(NO_SEED), "the open-model rows ran locally and say nothing about an API seed");
  }
  // the obj1_dev open-model row had errors: it alone carries the n_error explanation
  const dev = SHIPPED.find((r) => r.split === "obj1_dev" && String(r.system_name).includes("O2")) as { about_run: string[] };
  assert.match(dev.about_run[7], /^n_error = rows with error true \(2: 1 not served for context, 1 an unparsable reply$/);
  assert.equal(open.filter((l) => l.length === 8).length, 1);
  // never printed: hashes, paths, spend, run directories
  for (const r of SHIPPED) for (const l of r.about_run as string[] ?? []) { assert.doesNotMatch(l, /[0-9a-f]{12}|\/|USD|spend|run directory|\.jsonl?\b/i, l); }
});

test("About this run renders as a closed details block headed by R1's constant, one per reference row, lines in order; none for a product row; a reference arm without lines is not shown", () => {
  const lines = ["First line.", "Second line."];
  const ref = parseRows({ rows: [row("ref", "self-reported", { entry_kind: "reference_arm", about_run: lines }), row("prod", "self-reported")] });
  const h = renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: ref, strings: resolveStrings() }));
  assert.equal((h.match(/data-testid="ns-about-run"/g) ?? []).length, 1);
  assert.ok(!/<details[^>]*\sopen/.test(h), "closed by default");
  assert.ok(h.includes(">About this run</summary>"));
  assert.ok(h.indexOf("First line.") < h.indexOf("Second line."));
  assert.equal(parseRows({ rows: [row("a", "self-reported", { entry_kind: "reference_arm" })] }).length, 0, "no lines, no row");
  assert.equal(parseRows({ rows: [row("b", "self-reported", { about_run: lines })] }).length, 0, "a product row has none");
});

// R1's rulings on the explorer's gap review (15 Oct): #353 not-run groups, #354 unit words, #356 note, #357 fixed order.
const render = (rows: ReturnType<typeof parseRows>) => {
  const h = renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows, strings: resolveStrings() }));
  return h.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
};
test("the unit words and the one line under the chooser are R1's (#354); the fixed-order line sits under the intro (#357)", () => {
  const h = render(ROWS);
  for (const t of ["How the system decides each item", "Whole item at once", "Every figure on this page counts items, however the system decides them.", "Rows are listed in a fixed order, by split and system name, never by a figure."]) assert.ok(h.includes(t), t);
  assert.ok(!h.includes("Counted per") && !h.includes("Each ingredient"));
  assert.ok(h.indexOf(R1.intro.slice(0, 20)) < h.indexOf(R1.orderLine));
});

test("cards sit under the two split subheadings, obj1_dev first; inside each the product row first, then the reference arms by system name, never by a figure (#357)", () => {
  const mk = (id: string, split: string, name: string, kind: string, k: number) => row(id, "self-reported", { split, system_name: name, entry_kind: kind, ...(kind === "reference_arm" ? { about_run: ["A line."] } : {}), metrics: [m("false_proof", "ALL", k, 40, 0, 1), m("coverage", "ALL", 30 - k, 40, 0, 1)] });
  const rows = parseRows({ rows: [mk("b2", "obj1b_minus_cruelty", "zz-arm", "reference_arm", 1), mk("d3", "obj1_dev", "mm-arm", "reference_arm", 0), mk("d1", "obj1_dev", "aa-arm", "reference_arm", 30), mk("d0", "obj1_dev", "zz-product", "product", 9), mk("b1", "obj1b_minus_cruelty", "aa-product", "product", 5)] });
  const h = render(rows);
  const order = (re: RegExp) => [...h.matchAll(re)].map((x) => x[1]);
  assert.deepEqual(order(/data-testid="ns-split-heading">([^<]+)</g), [R1.split.obj1_dev, R1.split.obj1b_minus_cruelty]);
  const cards = [...h.matchAll(/<dd class="[^"]*">(zz-product|aa-product|aa-arm|mm-arm|zz-arm) 1<\/dd>/g)].map((x) => x[1]);
  assert.deepEqual(cards, ["zz-product", "aa-arm", "mm-arm", "aa-product", "zz-arm"]);
  assert.equal((h.match(/data-testid="ns-split-section"/g) ?? []).length, 2);
});

test("a group the system was not given is NOT RUN: R1's line replaces the figures and the zero-with-zero line; All groups carries R1's no-numbers line; other groups are normal (#353)", () => {
  const metrics = [m("false_proof", "ALL", 0, 40, 0, 0.1), m("coverage", "ALL", 0, 40, 0, 0.1), m("false_proof", "NI138", 0, 5, 0, 0.5), m("coverage", "NI138", 0, 5, 0, 0.5), m("false_proof", "CHEAT", 1, 5, 0, 0.7), m("coverage", "CHEAT", 2, 5, 0, 0.8)];
  const rows = parseRows({ rows: [row("h", "self-reported", { entry_kind: "reference_arm", about_run: ["A line."], not_run_groups: ["NI138"], metrics }), row("p", "self-reported", { metrics })] });
  assert.deepEqual(rows[0].notRunGroups, ["NI138"]);
  const NOT_RUN = "Not run: this system was not given dishonoured-cheque items, which are outside its contracts.";
  const ALL_LINE = "Dishonoured-cheque items were not given to this system; the figures for All groups count them as not supported.";
  const all = render(rows);
  assert.equal((all.match(new RegExp(ALL_LINE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length, 1, "All groups: once, on the not-run row only");
  assert.ok(!all.includes(NOT_RUN));
  assert.ok(!/\d/.test(ALL_LINE), "no numbers in the All groups line");
  assert.ok(all.includes("data-testid=\"ns-zero-with-zero\""), "the zero-with-zero line still shows for All groups");
  assert.equal(parseRows({ rows: [row("bad", "self-reported", { not_run_groups: [1] })] }).length, 0);
});

test("the Dishonoured cheque note shows under that group's figures on every row where the group is shown, never on a not-run group (#356)", () => {
  const NOTE = "Dishonoured cheque is not a product contract; a result of 'supported' here is not a product result.";
  assert.ok(R1.ni138Note === NOTE);
  assert.ok(renderToStaticMarkup(createElement(NyayaSiddhiResultsView, { rows: ROWS, strings: resolveStrings() })).replace(/&#x27;/g, "'").includes(NOTE) === false, "not shown for the default group");
});
