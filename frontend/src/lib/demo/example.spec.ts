import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import test from "node:test";

import { EXAMPLE_CONTRACTS, EXAMPLE_FACTS, EXAMPLE_FACTS_SHA256, EXAMPLE_FACTS_TEXT, EXAMPLE_ID, EXAMPLE_LABEL } from "./example";
import { DO_NOT_CLAIM } from "../surfaceCopy";

test("the example text is exactly the text that was guard-checked (with its two recorded substitutions: the crime number is redacted and the registration date is withheld)", () => {
  assert.equal(EXAMPLE_FACTS[0].match(/Cr\.No\.\[redacted\] of 2023/)?.length, 1);
  assert.equal((EXAMPLE_FACTS_TEXT.match(/\[redacted\]|\[date\]/g) ?? []).length, 2, "exactly two substitutions");
  assert.match(EXAMPLE_FACTS[0], /registered by the respondent police on \[date\] in Cr\.No\.\[redacted\] of 2023/);
  const sha = createHash("sha256").update(EXAMPLE_FACTS.join("\n") + "\n", "utf8").digest("hex");
  assert.equal(sha, EXAMPLE_FACTS_SHA256);
  assert.equal(EXAMPLE_FACTS_TEXT, EXAMPLE_FACTS.join("\n"));
});

test("the example is the allegations only: no decision, no reasoning, no outcome words", () => {
  const text = EXAMPLE_FACTS_TEXT.toLowerCase();
  for (const word of ["dismissed", "quash", "devoid of merit", "needs probe", "learned counsel", "this court", "stands"]) {
    assert.ok(!text.includes(word), word);
  }
  assert.equal(EXAMPLE_FACTS.length, 3);
  for (const p of EXAMPLE_FACTS) assert.ok(p.length > 100 && p.length <= 4000);
});

test("the label says what the example is and is not, and carries no claim on the do-not-claim list", () => {
  assert.match(EXAMPLE_LABEL, /^A public Madras High Court judgment \(order of 12 June 2024\), example only\. Excerpt from the order with the crime number and the registration date withheld\. /);
  assert.doesNotMatch(EXAMPLE_LABEL + EXAMPLE_ID, /13624|Crl|\bNo\.\s*\d|\d+ of \d{4}/, "no real case identifier in the label or the id (Lead-2, 12 Oct)");
  assert.doesNotMatch(EXAMPLE_LABEL, /CNR|HCMA/); // the CNR cannot be verified from the order's text, so it is not shown
  assert.match(EXAMPLE_LABEL, /illustrative, not evidence/);
  for (const re of DO_NOT_CLAIM) assert.doesNotMatch(EXAMPLE_LABEL, re);
  assert.equal(EXAMPLE_ID, "madras-public-order-2024");
});

test("the example selects the IPC contracts for the sections the complaint names", () => {
  assert.deepEqual([...EXAMPLE_CONTRACTS], ["ipc405_misappropriation", "ipc415_property"]);
});

import { STEPS } from "./steps";

test("the demo steps walk the Screening flow and do not say every ingredient has a cited fact: only supported ones do", () => {
  const text = STEPS.map((x) => `${x.title}. ${x.body}`).join(" ");
  assert.doesNotMatch(text, /for every element/i);
  assert.match(text, /A supported ingredient shows the fact of yours it cites, as you wrote it/);
  assert.match(text, /No fact cited, or Needs your review, with the reason/);
  assert.equal(STEPS.length, 6);
});

// R2 (12 Oct): the facts text itself carries no case or crime number, no dotted date, no CNR and no "No. N" / "N of YYYY" form (the redaction placeholders pass).
test("the example facts carry no case identifier or dotted date", () => {
  for (const re of [/Cr\.?\s?No(?!\.?\[redacted\])/i, /\b\d{1,2}\.\d{1,2}\.\d{4}\b/, /CNR|HCMA/, /\bNo\.\s*\d|\d+ of \d{4}/]) {
    assert.doesNotMatch(EXAMPLE_FACTS_TEXT, re, String(re));
  }
});
