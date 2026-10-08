import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import test from "node:test";

import { EXAMPLE_CONTRACTS, EXAMPLE_FACTS, EXAMPLE_FACTS_SHA256, EXAMPLE_FACTS_TEXT, EXAMPLE_ID, EXAMPLE_LABEL } from "./example";
import { DO_NOT_CLAIM } from "../surfaceCopy";

test("the example text is exactly the text that was guard-checked", () => {
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
  assert.match(EXAMPLE_LABEL, /Public Madras High Court judgment \(Crl\.O\.P\. No\. 13624 of 2024, order dated 12 June 2024\), example only/);
  assert.doesNotMatch(EXAMPLE_LABEL, /CNR|HCMA/); // the CNR cannot be verified from the order's text, so it is not shown
  assert.match(EXAMPLE_LABEL, /illustrative, not evidence/);
  for (const re of DO_NOT_CLAIM) assert.doesNotMatch(EXAMPLE_LABEL, re);
  assert.equal(EXAMPLE_ID, "madras-crl-op-13624-2024");
});

test("the example selects the IPC contracts for the sections the complaint names", () => {
  assert.deepEqual([...EXAMPLE_CONTRACTS], ["ipc405_misappropriation", "ipc415_property"]);
});

import { STEPS } from "./steps";

test("the demo steps walk the Screening flow and do not say every ingredient has a cited fact: only supported ones do", () => {
  const text = STEPS.map((x) => `${x.title}. ${x.body}`).join(" ");
  assert.doesNotMatch(text, /for every element/i);
  assert.match(text, /A supported ingredient shows the fact of yours it cites, as you wrote it/);
  assert.match(text, /Not supported by these facts, or Needs your review, with the reason/);
  assert.equal(STEPS.length, 6);
});
