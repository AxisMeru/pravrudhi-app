import { strict as assert } from "node:assert";
import test from "node:test";

import { citedFactView, leanAttestationView, LEAN_ATTESTATION_NOTE, CONTEXT_CHARS, noStructuralCheckLine, NO_STRUCTURAL_CHECK_LINE } from "./quoteHighlight";

// Invented facts and values only.
const FACTS = [
  { id: "F1", text: "The tenant paid the deposit on the first day of the month." },
  { id: "F2", text: "😀 The landlord kept the deposit after the lease ended." },
];
const el = (o: Partial<Parameters<typeof citedFactView>[1]>): Parameters<typeof citedFactView>[1] => ({
  fact_id: "F1", quote: "paid the deposit", start: 11, end: 27, offsets_source: "system", ...o,
});

test("a strictly partial span is a passage within the cited fact, with the text around it", () => {
  const v = citedFactView(FACTS, el({}));
  assert.equal(v.kind, "passage");
  if (v.kind !== "passage") return;
  assert.equal(v.before, "The tenant ");
  assert.equal(v.quote, "paid the deposit");
  assert.equal(v.after, " on the first day of the month.");
  assert.equal(v.cutBefore, false);
  assert.equal(v.cutAfter, false);
});

test("a span that equals the whole fact shows the cited fact once, plain: no passage is claimed (data-driven, not the quote_source label)", () => {
  const f = FACTS[0].text;
  for (const source of [undefined, "whole_fact", "model"]) {
    const v = citedFactView(FACTS, { ...el({ quote: f, start: 0, end: Array.from(f).length }), ...(source ? { quote_source: source } : {}) });
    assert.deepEqual(v, { kind: "fact", factId: "F1", text: f });
  }
});

test("offsets that cannot be used show the cited fact once, plain, never a mark", () => {
  const whole = { kind: "fact", factId: "F1", text: FACTS[0].text };
  assert.deepEqual(citedFactView(FACTS, el({ offsets_source: "model" })), whole);
  assert.deepEqual(citedFactView(FACTS, el({ offsets_source: null })), whole);
  assert.deepEqual(citedFactView(FACTS, el({ start: null })), whole);
  assert.deepEqual(citedFactView(FACTS, el({ start: 27, end: 11 })), whole);
  assert.deepEqual(citedFactView(FACTS, el({ start: -1 })), whole);
  assert.deepEqual(citedFactView(FACTS, el({ end: 9999 })), whole);
  assert.deepEqual(citedFactView(FACTS, el({ start: 12, end: 28 })), whole); // the slice is not the returned quote
});

test("no quote, or a fact that is not among the facts, is plain: nothing but the quote itself can be shown", () => {
  assert.deepEqual(citedFactView(FACTS, el({ quote: null })), { kind: "plain", reason: "no_quote" });
  assert.deepEqual(citedFactView(FACTS, el({ quote: "" })), { kind: "plain", reason: "no_quote" });
  assert.deepEqual(citedFactView(FACTS, el({ fact_id: "F404" })), { kind: "plain", reason: "fact_not_found" });
  assert.deepEqual(citedFactView(FACTS, el({ fact_id: null })), { kind: "plain", reason: "fact_not_found" });
});

test("offsets count code points: an astral character before the span does not shift the passage", () => {
  const start = Array.from(FACTS[1].text.slice(0, FACTS[1].text.indexOf("kept"))).length;
  assert.equal(start, 15);
  const v = citedFactView(FACTS, el({ fact_id: "F2", quote: "kept the deposit", start, end: start + 16 }));
  assert.equal(v.kind, "passage");
  if (v.kind === "passage") assert.equal(v.quote, "kept the deposit");
  // The same offsets used as UTF-16 indexes would have cut the wrong text.
  assert.notEqual(FACTS[1].text.slice(start, start + 16), "kept the deposit");
});

test("long facts are cut to the context window around a passage and say so", () => {
  const long = { id: "F9", text: `${"a".repeat(300)}KEY QUOTE${"b".repeat(300)}` };
  const v = citedFactView([long], el({ fact_id: "F9", quote: "KEY QUOTE", start: 300, end: 309 }));
  assert.equal(v.kind, "passage");
  if (v.kind !== "passage") return;
  assert.equal(v.before.length, CONTEXT_CHARS);
  assert.equal(v.after.length, CONTEXT_CHARS);
  assert.equal(v.cutBefore, true);
  assert.equal(v.cutAfter, true);
});

const A = "a".repeat(64);
const B = "0123456789abcdef".repeat(4);

test("the Lean attestation shows both hashes in full and short, with the structural-check note", () => {
  const v = leanAttestationView({ binary_sha256: A, wire_sha256: B, verdict: "Proof" });
  assert.ok(v);
  assert.deepEqual(v.rows.map((r) => r.full), [A, B]);
  assert.deepEqual(v.rows.map((r) => r.short), [`${A.slice(0, 12)}…`, `${B.slice(0, 12)}…`]);
  assert.equal(v.note, LEAN_ATTESTATION_NOTE);
  assert.doesNotMatch(v.note + v.rows.map((r) => r.label).join(" "), /verified|proven in lean|proves in lean/i);
});

test("a missing or malformed attestation shows nothing: no invented hash", () => {
  assert.equal(leanAttestationView(null), null);
  assert.equal(leanAttestationView(undefined), null);
  assert.equal(leanAttestationView({ binary_sha256: "abc", wire_sha256: B, verdict: "Proof" }), null);
  assert.equal(leanAttestationView({ binary_sha256: A, wire_sha256: B.toUpperCase(), verdict: "Proof" }), null);
});

test("the no-structural-check line shows only on a REFER contract with no Lean result, both directions", () => {
  const lean = { verdict: "Proof", denied_claims: [], unlicensed_claims: [], omitted_claims: [] };
  assert.equal(noStructuralCheckLine("REFER_TO_LAWYER", null), NO_STRUCTURAL_CHECK_LINE);
  assert.equal(NO_STRUCTURAL_CHECK_LINE, "No structural check was run for this referral.");
  assert.equal(noStructuralCheckLine("REFER_TO_LAWYER", lean), null); // a referral that did have a check shows the check, not this line
  assert.equal(noStructuralCheckLine("PROOF", null), null); // not a referral
  assert.equal(noStructuralCheckLine("ABSTAIN", null), null);
  assert.equal(noStructuralCheckLine("REFER_TO_LAWYER", undefined), null); // an older engine that omits the field: nothing is asserted
});
