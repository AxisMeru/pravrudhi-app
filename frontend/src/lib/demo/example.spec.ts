import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import test from "node:test";

import { DEFAULT_EXAMPLE, EXAMPLES, EXAMPLE_LABEL, EXAMPLE_NOT_FOUND_TEXT, exampleById, exampleFactsText } from "./example";
import { DO_NOT_CLAIM } from "../surfaceCopy";
import { FACTS_GUARD } from "./factsGuard";

// Every example is generic here: its facts are pinned by sha256, carry no FIR / crime / CNR number, address, phone number or age, and are allegations only. The citation is a separate field, as the court
// printed it (Lead-2's 14 Oct ruling), pinned below per example; the guard test (caseIdentifiers.spec.ts) lists the only citation patterns allowed.
const CITATIONS: Record<string, string> = {
  "madras-public-order-2024": "Madras High Court, order of 12 June 2024",
  "karnataka-cheating-2025": "High Court of Karnataka at Bengaluru, order of 25 March 2025, 2025:KHC:12773",
};

test("every example's facts are exactly the checked text (sha256 pinned) and every example has a pinned citation, a contract and a unique id", () => {
  assert.ok(EXAMPLES.length >= 1);
  assert.equal(new Set(EXAMPLES.map((e) => e.id)).size, EXAMPLES.length);
  assert.deepEqual(EXAMPLES.map((e) => e.id).sort(), Object.keys(CITATIONS).sort(), "a new example needs its citation pinned here");
  for (const e of EXAMPLES) {
    const sha = createHash("sha256").update(e.facts.join("\n") + "\n", "utf8").digest("hex");
    assert.equal(sha, e.factsSha256, e.id);
    assert.equal(exampleFactsText(e), e.facts.join("\n"));
    assert.equal(e.citation, CITATIONS[e.id], e.id);
    assert.ok(e.contracts.length >= 1, e.id);
  }
});

test("the first example's recorded redactions are exactly the two the crime number and date need (Lead-2 and R2, 12 Oct)", () => {
  const m = exampleById("madras-public-order-2024")!;
  assert.equal(m.facts[0].match(/Cr\.No\.\[redacted\] of 2023/)?.length, 1);
  assert.equal((m.facts.join("\n").match(/\[redacted\]|\[date\]/g) ?? []).length, 2, "exactly two substitutions");
  assert.match(m.facts[0], /registered by the respondent police on \[date\] in Cr\.No\.\[redacted\] of 2023/);
  assert.deepEqual([...m.contracts], ["ipc405_misappropriation", "ipc415_property"]);
});

test("every example is the allegations only: no decision, no reasoning, no outcome words", () => {
  for (const e of EXAMPLES) {
    const text = exampleFactsText(e).toLowerCase();
    for (const word of ["dismissed", "quash", "devoid of merit", "needs probe", "learned counsel", "this court", "stands", "we hold", "i hold"]) assert.ok(!text.includes(word), `${e.id}: ${word}`);
    assert.ok(e.facts.length >= 1);
    for (const p of e.facts) assert.ok(p.length > 40 && p.length <= 4000, e.id);
  }
});

test("the label is R1's exact words (14 Oct): true for real material, no case identifier, no claim on the do-not-claim list", () => {
  assert.equal(EXAMPLE_LABEL, "A public court order, example only. These are the allegations as the court recited them, not findings, and not a view on the case. A crime number and a date have been replaced by placeholders. The output of this demo is illustrative, not evidence, and no measure is quoted from it.");
  assert.doesNotMatch(EXAMPLE_LABEL, /invented|made up/i);
  for (const re of DO_NOT_CLAIM) assert.doesNotMatch(EXAMPLE_LABEL, re);
  assert.equal(EXAMPLE_NOT_FOUND_TEXT, "That example is not available.");
  assert.equal(exampleById("not-an-example"), null);
  assert.equal(exampleById(null), null);
  assert.equal(DEFAULT_EXAMPLE, EXAMPLES[0]);
});

import { STEPS } from "./steps";

test("the demo steps walk the Screening flow and do not say every ingredient has a cited fact: only supported ones do", () => {
  const text = STEPS.map((x) => `${x.title}. ${x.body}`).join(" ");
  assert.doesNotMatch(text, /for every element/i);
  assert.match(text, /A supported ingredient shows the fact of yours it cites, as you wrote it/);
  assert.match(text, /Not supported by these facts, or Needs your review, with the reason/);
  assert.equal(STEPS.length, 6);
});

// Guard (narrowed 14 Oct by Lead-2's ruling: each example is identified exactly as the court publishes it, and that IS its citation, a separate pinned field). The FACTS carry no FIR, crime or CNR number,
// no address, no phone number, no age and no dotted date (the redaction placeholders pass); parties appear only as the court's printed title gives them, never in the excerpt.
test("every example's facts carry no FIR / crime / CNR number, address, phone number, age or dotted date (both arms: each class catches its own known-bad sample; no example matches any class; the placeholders pass)", () => {
  assert.deepEqual(FACTS_GUARD.map((g) => g.name), ["crime number", "FIR number", "crime number (words)", "dotted date", "CNR", "phone number", "age", "address"], "a guard class was added or removed");
  for (const g of FACTS_GUARD) {
    assert.match(g.bad, g.re, `${g.name}: the regex no longer catches its own known-bad sample`);
    // every OTHER class's sample must not be what proves this one: the sample belongs to this class (a mutated regex that matched everything would still be caught below)
    for (const e of EXAMPLES) assert.doesNotMatch(exampleFactsText(e), g.re, `${e.id}: ${g.name}`);
  }
  assert.doesNotMatch("registered in Cr.No.[redacted] of 2023 on [date]", FACTS_GUARD[0].re, "the redaction placeholders pass");
  assert.doesNotMatch("a clean sentence about money lent and not repaid", new RegExp(FACTS_GUARD.map((g) => g.re.source).join("|"), "i"));
});

// Placeholder parts for the sample strings below, composed so no identifier-shaped literal sits in this public file (CI guard scripts/check-invented-fixtures.mjs).
const ONE = "1";
const YEAR = "2000";

// The ONLY citation shapes allowed (Lead-2 14 Oct): the court's neutral citation, or court + case type + number + date as printed on the order, or (until Track B supplies the printed number) court + date.
const ALLOWED_CITATION = [
  /^[A-Z][A-Za-z .&'-]+(?: High Court| Supreme Court of India| Supreme Court)?, \d{4}:[A-Z]{2,6}:\d{1,6}(?:-DB)?$/, // neutral citation, e.g. Placeholder High Court, 2000:KHC:0000 (a visibly fake number)
  /^[A-Z][A-Za-z .&'-]+ (?:High Court|Supreme Court of India), (?:Crl\.(?: ?[A-Z]\.?)+|W\.P\.(?: ?\(C\))?|Writ Petition(?: \(C\))?|Criminal (?:Appeal|Petition|Original Petition|Revision Case|Miscellaneous Petition)|Civil Appeal|Special Leave Petition(?: \(Crl\.\))?|S\.L\.P\.(?: ?\(Crl\.\))?|C\.A\.) No\. ?\d{1,6}(?: of |\/)\d{4}, (?:order|judgment) of \d{1,2} [A-Z][a-z]+ \d{4}$/, // court, case type + number, order date
  /^[A-Z][A-Za-z .&'-]+ High Court, order of \d{1,2} [A-Z][a-z]+ \d{4}$/, // court and date only
  /^[A-Z][A-Za-z .&'-]+ at [A-Z][a-z]+, order of \d{1,2} [A-Z][a-z]+ \d{4}, \d{4}:[A-Z]{2,6}:\d{1,6}$/, // court, date and the neutral citation as printed
];

test("every citation is one of the allowed shapes (neutral citation; court + case type + number + date as printed; court + date)", () => {
  for (const e of EXAMPLES) assert.ok(ALLOWED_CITATION.some((re) => re.test(e.citation)), `${e.id}: ${e.citation}`);
  // the shapes themselves: what they allow and what they refuse (the court names, numbers and dates below are placeholders, not real cases)
  assert.ok(ALLOWED_CITATION.some((re) => re.test("Placeholder High Court, 2000:KHC:0000")));
  assert.ok(ALLOWED_CITATION.some((re) => re.test(`Madras High Court, Crl.O.P. No. ${ONE} of ${YEAR}, order of 12 June 2024`)));
  const BAD = [`Madras High Court, FIR No. ${ONE}/${YEAR}`, `Cr.No. ${ONE} of ${YEAR}`, `Madras High Court, CNR XXXX${"0".repeat(12)}`, "Somebody v. Another", `Madras High Court, order of 0${ONE}.0${ONE}.${YEAR}`, `Madras High Court, Ram v. Shyam No. ${ONE} of ${YEAR}, order of 12 June 2024`, `Madras High Court, Anything Goes No. ${ONE} of ${YEAR}, order of 12 June 2024`];
  for (const bad of BAD) assert.ok(!ALLOWED_CITATION.some((re) => re.test(bad)), bad);
});

test("the Karnataka example carries R1's own label (14 Oct): the prosecution's allegations as the court recited them, and its screening line", () => {
  const k = exampleById("karnataka-cheating-2025")!;
  assert.equal(k.label, "A public court order, example only. These are the prosecution's allegations as the court recited them, not findings by us and not a view on the case. The court's decision is not shown here. The output of this demo is illustrative, not evidence, and no measure is quoted from it.");
  assert.equal(k.screeningLine, "Screened here for the ingredients of cheating (BNS 318 · IPC 415).");
  assert.deepEqual([...k.contracts], ["ipc415_property"]);
  assert.doesNotMatch(k.label, /invented|made up/i);
  for (const re of DO_NOT_CLAIM) assert.doesNotMatch(k.label, re);
});
