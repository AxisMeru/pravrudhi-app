import { strict as assert } from "node:assert";
import test from "node:test";

import { setHandoff, takeHandoff } from "./handoff";
import { citationLine, parseIntake } from "./intake";
import * as I from "./intake";

// An INVENTED bundle in the engine's shape (pravrudhi#414/#430): no real order text anywhere.
const BUNDLE = {
  run_id: "nyaya-intake-aaaaaaaaaa",
  client_data: true,
  bundle: {
    clean_status: "cleaned",
    facts: [
      { id: "F1", text: "The buyer paid a deposit for a flat.", status: "span" },
      { id: "F2", text: "The seller did not hand over the flat.", status: "raw_fallback" },
    ],
    not_citable: [{ status: "duplicate", reason: "same text as an earlier fact" }, { status: "paraphrase", reason: "span out of range, empty, or out of order" }],
    citations: [{ text: "Invented v. Sample (2000) 1 SCC 1", verifier_status: "NOT_IN_INDEX", fact_ids: ["F2"] }],
  },
};

test("a well-formed intake answer is read into facts, citations and counts; the engine's per-fact reasons are dropped", () => {
  const v = parseIntake(BUNDLE)!;
  assert.equal(v.facts.length, 2);
  assert.equal(v.facts[1].status, "raw_fallback");
  assert.equal(v.duplicates, 1);
  assert.equal(v.citations[0].verifierStatus, "NOT_IN_INDEX");
  assert.doesNotMatch(JSON.stringify(v), /span out of range|same text as an earlier fact/);
});

test("an answer off the contract is null, never guessed at", () => {
  for (const bad of [null, "x", {}, { run_id: "r" }, { run_id: "r", bundle: {} }, { run_id: "r", bundle: { facts: [{ id: 1 }], citations: [] } }]) assert.equal(parseIntake(bad), null);
});

test("R1's plain sentences, exactly, and an unknown status reads Not checked.", () => {
  assert.equal(I.INTAKE_SIGNED_IN_ONLY, "Intake is offered only to signed-in users.");
  assert.equal(I.INTAKE_SERVED_RAW, "We could not clean this text safely, so your original text is shown.");
  assert.equal(I.INTAKE_RAW_FALLBACK, "Shown as you wrote it.");
  assert.equal(I.INTAKE_DUPLICATE, "Same as an earlier fact; not counted again.");
  assert.equal(I.INTAKE_PARAPHRASE, "This sentence is a paraphrase, not your own words, so it is not used as a fact to cite.");
  assert.equal(I.INTAKE_LIMIT_SENTENCE, "Intake only joins broken lines, removes repeated page headers and tidies spacing; it never changes a number.");
  assert.equal(citationLine("IN_INDEX"), "Found in our index");
  assert.equal(citationLine("NOT_IN_INDEX"), "Not found in our index: this does not show whether the citation is real");
  assert.equal(citationLine("CHECK_UNAVAILABLE"), "The citation check was unavailable for this citation.");
  assert.equal(citationLine("NOT_CHECKED"), "Not checked.");
  assert.equal(citationLine("something_new"), "Not checked.");
});

test("the hand-off is taken once and then gone", () => {
  assert.equal(takeHandoff(), null);
  setHandoff(["a", "b"]);
  assert.deepEqual(takeHandoff(), ["a", "b"]);
  assert.equal(takeHandoff(), null);
});
