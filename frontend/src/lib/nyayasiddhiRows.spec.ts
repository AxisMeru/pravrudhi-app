import assert from "node:assert/strict";
import test from "node:test";

import { ALL_GROUP, zeroWithZero, groupsOf, intervalGeometry, metricOf, parseRow, parseRows, pct, unitsOf } from "./nyayasiddhiRows";

// INVENTED layout fixture (never a result, never shipped): the shape of a signed row from the result_row schema.
const metric = (name: string, group: string | undefined, k: number, n: number, lo: number | null, hi: number | null) => ({ name, ...(group ? { group } : {}), k, n, interval_method: "clopper-pearson-exact", interval_level: 0.95, ci_low: lo, ci_high: hi });
const ROW = (over: Record<string, unknown> = {}) => ({
  row_id: "invented-1", status: "self-reported", benchmark_version: "v0.2.2", split: "obj1_dev", unit: "whole_item", system_name: "invented-system", system_version: "0.0", manifest_sha256: "a".repeat(64), scorer_sha: "b".repeat(40),
  run_date: "2026-10-01", organiser_entry: true, entry_kind: "product", metrics: [metric("false_proof", "ALL", 2, 40, 0.006, 0.169), metric("coverage", "ALL", 30, 40, 0.588, 0.893), metric("coverage", "CHEAT", 10, 12, 0.516, 0.979), metric("false_proof", "CHEAT", 0, 12, 0, 0.265)],
  supersedes: null, superseded_by: null, error_mapping: "none", n_error: 0, ...over,
});

test("a row that meets the contract parses; the figures keep their n and interval", () => {
  const r = parseRow(ROW())!;
  assert.equal(r.rowId, "invented-1"); assert.equal(r.status, "self-reported"); assert.equal(r.organiserEntry, true);
  assert.deepEqual(metricOf(r, "coverage", "ALL"), { name: "coverage", group: "ALL", k: 30, n: 40, ciLow: 0.588, ciHigh: 0.893 });
  assert.equal(metricOf(r, "coverage", "NI138"), null);
});

test("a row that does not meet the contract is dropped, never shown half", () => {
  for (const bad of [
    ROW({ status: "verified" }), ROW({ split: "hidden" }), ROW({ unit: "item" }), ROW({ run_date: "" }),
    ROW({ metrics: [metric("coverage", "ALL", 30, 40, 0.588, 0.893)] }), // false proof missing: a row carries BOTH measures
    ROW({ metrics: [metric("false_proof", "ALL", 2, 40, 0.006, 0.169), metric("coverage", "ALL", 41, 40, 0.5, 1)] }), // k > n
    ROW({ metrics: [metric("false_proof", "ALL", 2, 40, 0.3, 0.5), metric("coverage", "ALL", 30, 40, 0.588, 0.893)] }), // the interval does not contain k/n
    ROW({ metrics: [metric("false_proof", "ALL", 0, 0, 0, 1), metric("coverage", "ALL", 30, 40, 0.588, 0.893)] }), // n = 0 carries no interval
    ROW({ superseded_by: "invented-2" }), null, "x", {},
  ]) assert.equal(parseRow(bad), null);
  assert.equal(parseRow(ROW({ metrics: [metric("false_proof", "ALL", 0, 0, null, null), metric("coverage", "ALL", 30, 40, 0.588, 0.893)] }))?.metrics[0].ciLow, null);
});

test("parseRows keeps the file's order and only the valid rows; a bad file gives none", () => {
  const rows = parseRows({ rows: [ROW({ row_id: "a" }), ROW({ status: "nope" }), ROW({ row_id: "c", unit: "element" })] });
  assert.deepEqual(rows.map((r) => r.rowId), ["a", "c"]);
  assert.deepEqual(parseRows({}), []); assert.deepEqual(parseRows(null), []); assert.deepEqual(parseRows({ rows: "x" }), []);
});

test("units, groups and the interval drawing", () => {
  const rows = parseRows({ rows: [ROW({ row_id: "a" }), ROW({ row_id: "c", unit: "element" })] });
  assert.deepEqual(unitsOf(rows), ["whole_item", "element"]);
  assert.deepEqual(groupsOf(rows, "whole_item"), [ALL_GROUP, "CHEAT"]);
  const g = intervalGeometry(metricOf(rows[0], "coverage", "ALL")!)!;
  assert.deepEqual([g.low, g.point, g.high].map((v) => Math.round(v * 10) / 10), [58.8, 75, 89.3]);
  assert.equal(intervalGeometry({ name: "coverage", group: "ALL", k: 0, n: 0, ciLow: null, ciHigh: null }), null);
  assert.equal(pct(0.0345), "3.5%");
});

test("zero false proofs with zero coverage is detected (never read alone); 0 false proofs with coverage above 0 is not", () => {
  const z = parseRow(ROW({ metrics: [metric("false_proof", "ALL", 0, 64, 0, 0.056), metric("coverage", "ALL", 0, 30, 0, 0.116)] }))!;
  assert.equal(zeroWithZero(z, "ALL"), true);
  assert.equal(zeroWithZero(parseRow(ROW())!, "ALL"), false);
  assert.equal(zeroWithZero(parseRow(ROW({ metrics: [metric("false_proof", "ALL", 0, 64, 0, 0.056), metric("coverage", "ALL", 5, 30, 0.056, 0.347)] }))!, "ALL"), false);
  assert.equal(zeroWithZero(parseRow(ROW())!, "NI138"), false);
});
