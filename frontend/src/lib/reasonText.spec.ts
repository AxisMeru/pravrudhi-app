import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { DO_NOT_CLAIM } from "./surfaceCopy";
import { NON_REFER_REASON_TEXT, QUOTE_CHECK_TEXT, UNKNOWN_NON_REFER_REASON_TEXT, UNKNOWN_QUOTE_CHECK_TEXT, bindingLegText, nonReferReasonText, quoteCheckPresentation } from "./reasonText";

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

test("a quote that passed needs no cause; every rejected or absent quote has one; an unknown code reads R1's neutral sentence, never the code", () => {
  assert.equal(quoteCheckPresentation("ok")?.show, false);
  for (const c of QUOTE_CODES.filter((x) => x !== "ok")) {
    const p = quoteCheckPresentation(c);
    assert.ok(p && p.show && !p.unknown && p.text.length > 10, c);
  }
  const odd = quoteCheckPresentation("brand_new");
  assert.equal(odd?.unknown, true);
  assert.equal(odd?.text, UNKNOWN_QUOTE_CHECK_TEXT);
  assert.doesNotMatch(odd?.text ?? "", /brand_new/);
  assert.equal(quoteCheckPresentation(null), null);
  assert.equal(quoteCheckPresentation("  "), null);
});

test("the quote-check wording says what the engine does: word for word, an ambiguous quote is not counted as shown", () => {
  assert.match(QUOTE_CHECK_TEXT.quote_not_found, /word for word \(same capital letters and spacing\)/);
  assert.match(QUOTE_CHECK_TEXT.ambiguous_quote, /not counted as shown/);
  assert.doesNotMatch(QUOTE_CHECK_TEXT.ambiguous_quote, /first/i, "the engine does NOT take the first occurrence");
});

test("the judge that bound an element is named in plain words; anything else shows nothing", () => {
  assert.match(bindingLegText("primary") ?? "", /first check/);
  assert.match(bindingLegText("second") ?? "", /second check/);
  for (const x of [null, undefined, "", "tertiary"]) assert.equal(bindingLegText(x), null);
});

test("none of this text makes a claim on the do-not-claim list or carries a Sanskrit label", () => {
  const all = [...Object.values(NON_REFER_REASON_TEXT), ...Object.values(QUOTE_CHECK_TEXT), bindingLegText("primary") ?? "", bindingLegText("second") ?? ""];
  for (const s of all) {
    for (const re of [DO_NOT_CLAIM[0], DO_NOT_CLAIM[1], DO_NOT_CLAIM[2], DO_NOT_CLAIM[4]]) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(s, /pram[aā]n|anum[aā]n|nyāya|sākṣ|sakshi|āgama|vimarś|pratyaks/i, s);
  }
});

// app#425 / d34: R1's two neutral fallbacks, held by hash and by wording, with a planted unknown value each; neither carries the code, in text or in any attribute.
const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
test("R1's neutral fallbacks are exactly the signed sentences (sha256[:16])", () => {
  assert.equal(UNKNOWN_QUOTE_CHECK_TEXT, "The quote check returned a result this version of the app cannot show. Check the quoted words against your facts yourself.");
  assert.equal(h(UNKNOWN_QUOTE_CHECK_TEXT), "6327668ea585dc15");
  assert.equal(UNKNOWN_NON_REFER_REASON_TEXT, "The screening gave a reason for this outcome that this version of the app cannot show. A lawyer decides.");
  assert.equal(h(UNKNOWN_NON_REFER_REASON_TEXT), "7bf28ecad7a95498");
});

test("a planted unknown quote_check reads the neutral sentence and the code is not in the presentation", () => {
  const p = quoteCheckPresentation("planted_unknown_qc");
  assert.deepEqual(p, { show: true, text: UNKNOWN_QUOTE_CHECK_TEXT, unknown: true });
  assert.doesNotMatch(JSON.stringify(p), /planted_unknown_qc/);
});

test("a planted unknown non-referral reason has no sentence of its own, so the Matters page prints the neutral one, never the code or the referral sentence", () => {
  assert.equal(nonReferReasonText("planted_unknown_reason"), null);
  const page = readFileSync(join(__dirname, "..", "app", "matters", "page.tsx"), "utf8");
  assert.match(page, /nonReferReasonText\(c\.reason\) \?\? UNKNOWN_NON_REFER_REASON_TEXT/);
  assert.doesNotMatch(page, /\bUNKNOWN_REASON_TEXT\b/, "the referral fallback must not stand in for a non-referral reason");
  const line = page.split("\n").find((l) => l.includes("UNKNOWN_NON_REFER_REASON_TEXT}"))!;
  assert.doesNotMatch(line, /title=|aria-label|data-(?!testid)/, "the code is not placed in an attribute");
});
