import assert from "node:assert/strict";
import test from "node:test";

import { IN_INDEX_ENGINE_LABEL, productStatus, verifyView } from "./citationCheck";
import { coverageLine } from "./citationsPanel";

// The served shape of the engine's coverage object (pravrudhi #376, application/verify.py index_coverage): `courts` lists the courts a citation can resolve to, `courts_resolvable`
// counts the resolvable cases per court label. INVENTED numbers and labels.
const REAL_COVERAGE = {
  judgments_held: 777777,
  courts_held: { "Invented High Court": 700000, "Invented Supreme Court": 77777 },
  courts: ["Invented High Court", "Supreme Court Invented A"],
  courts_resolvable: { "Supreme Court Invented A": 4000, "Supreme Court Invented B": 300, "Invented High Court": 21 },
  resolvable_cases: 4321,
  resolvable_citation_strings: 9999,
  year_min: 1951,
  year_max: 2020,
  held_year_min: 1901,
  held_year_max: 2024,
  note: "Only SCC-family citations resolve today; a citation to any court or reporter not listed under courts_resolvable is answered not_in_index, which is no evidence either way.",
};

test("the served multi-court coverage object is worded from resolvable_cases, courts_resolvable and the resolvable-case years only; no held figure or index total is printed", () => {
  const line = coverageLine(REAL_COVERAGE);
  assert.match(line, /^Citations resolve for 4,321 judgments from 3 court labels \(/);
  assert.match(line, /with years 1951 to 2020 \(the index's year field\); SCC-family citations only\./);
  for (const never of ["777", "700", "9,999", "9999", "1901", "2024"]) assert.ok(!line.includes(never), never);
});

test("without courts_resolvable (the older shape) the line is the plain fallback, not a made-up claim", () => {
  const { courts_resolvable: _per, ...old } = REAL_COVERAGE;
  void _per;
  assert.ok(!/4,321/.test(coverageLine(old)));
  assert.ok(!/4,321/.test(coverageLine({ ...REAL_COVERAGE, courts_resolvable: { "Supreme Court Invented A": 1 } }))); // does not add up to resolvable_cases
});

test("IN_INDEX: the engine's existence-only answer is a known status; with the product status on, its own label shows, and only that exact label", () => {
  const reply = { result: "IN_INDEX", note: "n", status: "in_index", label: IN_INDEX_ENGINE_LABEL, preview: true, verified: false };
  assert.equal(verifyView(reply, true).known, true);
  assert.deepEqual(productStatus(reply, true), { status: "in_index", label: IN_INDEX_ENGINE_LABEL });
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
