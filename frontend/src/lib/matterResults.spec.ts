import assert from "node:assert/strict";
import { test } from "node:test";
import { citationLabel, citationState, coverageById, isUncovered, quoteSegments, standardLine } from "./matterResults";

const facts = [{ id: "F1", text: "The cheque was dishonoured on 3 May." }];

test("quoteSegments splits the fact at the returned offsets", () => {
  const s = quoteSegments({ quote: "dishonoured", start: 15, end: 26, fact_id: "F1" }, facts);
  assert.deepEqual(s, { before: "The cheque was ", mark: "dishonoured", after: " on 3 May." });
});

test("quoteSegments refuses offsets that do not reproduce the quote", () => {
  assert.equal(quoteSegments({ quote: "dishonoured", start: 0, end: 11, fact_id: "F1" }, facts), null);
  assert.equal(quoteSegments({ quote: "x", start: 30, end: 99, fact_id: "F1" }, facts), null);
  assert.equal(quoteSegments({ quote: "dishonoured", start: 15, end: 26, fact_id: "F9" }, facts), null);
  assert.equal(quoteSegments({ quote: null, start: null, end: null, fact_id: null }, facts), null);
});

test("coverage is unknown without entries and never read as covered", () => {
  assert.equal(coverageById(null), null);
  assert.equal(coverageById([]), null);
  assert.equal(isUncovered("a", null), false);
  const m = coverageById([{ id: "a", validated: true }, { id: "b", validated: false }]);
  assert.equal(isUncovered("a", m), false);
  assert.equal(isUncovered("b", m), true);
  assert.equal(isUncovered("zz", m), false);
});

test("citations are marked by corpus membership", () => {
  const ok = { act: "NI Act", section: "138", corpus_id: "x", in_corpus: true, title: "t" };
  const bad = { act: "BNS", section: null, corpus_id: null, in_corpus: false, title: null };
  assert.equal(citationState(ok), "in_corpus");
  assert.equal(citationState(bad), "unresolved");
  assert.equal(citationLabel(ok), "NI Act s. 138");
  assert.equal(citationLabel(bad), "BNS");
});

test("standardLine: a missing object says so and assumes nothing", () => {
  assert.deepEqual(standardLine(undefined), { text: "standard: not reported by this engine", known: false });
  assert.deepEqual(standardLine(null), { text: "standard: not reported by this engine", known: false });
});

test("standardLine names the standard, its source and the echoed posture", () => {
  const s = standardLine({ applied: "prima_facie_disclosed", source: "proceeding_posture", proceeding_posture: "quash" });
  assert.equal(s.text, "standard: prima facie disclosed (from proceeding posture: quash)");
  assert.equal(s.known, true);
  assert.equal(standardLine({ applied: "proved", source: "default", proceeding_posture: null }).text, "standard: proved (default)");
});

test("standardLine shows an unrecognised value verbatim instead of guessing", () => {
  const s = standardLine({ applied: "beyond_doubt", source: "operator" });
  assert.equal(s.text, "standard: beyond_doubt (source: operator)");
  assert.equal(s.known, false);
});
