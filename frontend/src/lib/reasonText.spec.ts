import { strict as assert } from "node:assert";
import test from "node:test";

import { DO_NOT_CLAIM } from "./surfaceCopy";
import { NON_REFER_REASON_TEXT, QUOTE_CHECK_TEXT, bindingLegText, nonReferReasonText, quoteCheckPresentation } from "./reasonText";

// The six contract reasons that are not referrals (the engine's ContractReason minus its nine REFER reasons), and the eight
// quote-check codes of the engine's quote module.
const NON_REFER = ["all_elements_established", "denial_established", "missing_element", "no_training_statute_text", "judge_error", "assembly_lean_mismatch"];
const QUOTE_CODES = ["ok", "not_established", "no_quote", "unknown_fact", "empty_quote", "non_evidential_quote", "quote_not_found", "ambiguous_quote"];

test("every non-REFER reason and every quote-check code has plain text, and nothing else is in the tables", () => {
  assert.deepEqual(Object.keys(NON_REFER_REASON_TEXT).sort(), [...NON_REFER].sort());
  assert.deepEqual(Object.keys(QUOTE_CHECK_TEXT).sort(), [...QUOTE_CODES].sort());
  for (const r of NON_REFER) assert.ok(nonReferReasonText(r), r);
});

test("an unknown reason is not reworded: the text is null and the page says it does not recognise it", () => {
  for (const r of ["something_new", "", null, undefined, "constructor", "__proto__", "toString"]) assert.equal(nonReferReasonText(r), null, String(r));
});

test("a quote that passed needs no cause; every rejected or absent quote has one; an unknown code names itself", () => {
  assert.equal(quoteCheckPresentation("ok")?.show, false);
  for (const c of QUOTE_CODES.filter((x) => x !== "ok")) {
    const p = quoteCheckPresentation(c);
    assert.ok(p && p.show && !p.unknown && p.text.length > 10, c);
  }
  const odd = quoteCheckPresentation("brand_new");
  assert.equal(odd?.unknown, true);
  assert.match(odd?.text ?? "", /"brand_new"/);
  assert.equal(quoteCheckPresentation(null), null);
  assert.equal(quoteCheckPresentation("  "), null);
});

test("the quote-check wording says what the engine does: word for word, an ambiguous quote is not counted as shown", () => {
  assert.match(QUOTE_CHECK_TEXT.quote_not_found, /word for word \(same capital letters and spacing\)/);
  assert.match(QUOTE_CHECK_TEXT.ambiguous_quote, /not counted as shown/);
  assert.doesNotMatch(QUOTE_CHECK_TEXT.ambiguous_quote, /first/i, "the engine does NOT take the first occurrence");
});

test("the judge that bound an element is named in plain words; anything else shows nothing", () => {
  assert.match(bindingLegText("primary") ?? "", /first judge/);
  assert.match(bindingLegText("second") ?? "", /second judge/);
  for (const x of [null, undefined, "", "tertiary"]) assert.equal(bindingLegText(x), null);
});

test("none of this text makes a claim on the do-not-claim list or carries a Sanskrit label", () => {
  const all = [...Object.values(NON_REFER_REASON_TEXT), ...Object.values(QUOTE_CHECK_TEXT), bindingLegText("primary") ?? "", bindingLegText("second") ?? ""];
  for (const s of all) {
    for (const re of [DO_NOT_CLAIM[0], DO_NOT_CLAIM[1], DO_NOT_CLAIM[2], DO_NOT_CLAIM[4]]) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(s, /pram[aā]n|anum[aā]n|nyāya|sākṣ|sakshi|āgama|vimarś|pratyaks/i, s);
  }
});
