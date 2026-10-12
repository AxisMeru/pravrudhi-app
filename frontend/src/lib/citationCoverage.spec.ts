import assert from "node:assert/strict";
import test from "node:test";

import { IN_INDEX_ENGINE_LABEL, productStatus, verifyView } from "./citationCheck";
import { coverageLine } from "./citationsPanel";

// The REAL shape of the engine's coverage object (pravrudhi #376 @32d88d16, application/verify.py index_coverage), with INVENTED numbers.
const REAL_COVERAGE = {
  judgments_held: 777777,
  courts_held: { "Invented High Court": 700000, "Invented Supreme Court": 77777 },
  courts: ["Invented Supreme Court"],
  courts_resolvable: { "Invented Supreme Court": 4321 },
  resolvable_cases: 4321,
  resolvable_citation_strings: 9999,
  year_min: 1951,
  year_max: 2020,
  held_year_min: 1901,
  held_year_max: 2024,
  note: "Only SCC-family citations resolve today; a citation to any court or reporter not listed under courts_resolvable is answered not_in_index, which is no evidence either way.",
};

test("the real coverage object is worded from courts, resolvable_cases and the resolvable-case years only; no held figure, dict or index total is printed", () => {
  const line = coverageLine(REAL_COVERAGE);
  assert.match(line, /^Citations resolve for 4,321 Invented Supreme Court judgments \(1951 to 2020\);/);
  for (const never of ["777", "700", "9,999", "9999", "1901", "2024", "High Court"]) assert.ok(!line.includes(never), never);
});

test("the old shape (dict courts, all-case years only) is not worded from: no courts list means the plain fallback, not a made-up claim", () => {
  const { courts: _courts, ...old } = REAL_COVERAGE;
  void _courts;
  assert.ok(!/4,321/.test(coverageLine(old)));
  assert.ok(!/4,321/.test(coverageLine({ ...REAL_COVERAGE, courts: { "Invented Supreme Court": 1 } })));
});

test("IN_INDEX: the engine's existence-only answer is a known status; with the product status on, its own label shows, and only that exact label", () => {
  const reply = { result: "IN_INDEX", note: "n", status: "in_index", label: IN_INDEX_ENGINE_LABEL, preview: true, verified: false };
  assert.equal(verifyView(reply, true).known, true);
  assert.deepEqual(productStatus(reply, true), { status: "in_index", label: IN_INDEX_ENGINE_LABEL, preview: true });
  // anything but the engine's exact words, or the same words on another status, or verified:true, is refused
  for (const bad of [
    { ...reply, label: IN_INDEX_ENGINE_LABEL.replace("not a verification", "a verification") },
    { ...reply, label: `${IN_INDEX_ENGINE_LABEL} Verified.` },
    { ...reply, label: "Verified: found in the index." },
    { ...reply, status: "conflict" },
    { ...reply, verified: true },
    { ...reply, result: "NOT_IN_INDEX" },
  ]) assert.equal(productStatus(bad, true), null, JSON.stringify(bad).slice(0, 80));
  // the same exact words on any other status are refused
  assert.equal(productStatus({ ...reply, status: "not_in_index", result: "NOT_IN_INDEX" }, true), null);
});
