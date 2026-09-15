import { strict as assert } from "node:assert";
import test from "node:test";
import {
  CAPABILITY_LABEL,
  CAPABILITY_DESCRIPTION,
  ELEMENT_APPLICATION_STATUS,
  LEAN_CONTRACTS,
} from "./nyayaLean";

test("nyayaLean: uses the exact, non-negotiable label", () => {
  assert.equal(CAPABILITY_LABEL, "Lean-checked citation licensing");
});

test("nyayaLean: never claims more than checker=lean actually does", () => {
  // Reviewer's two named overclaims: "the answer's citations" (unscoped -- it's one named contract, and
  // only for questions that have one) and "a fixed set of statutory conditions" (it's a hand-authored
  // contract, not the statute itself).
  assert.doesNotMatch(CAPABILITY_DESCRIPTION, /the answer's citations/);
  assert.doesNotMatch(CAPABILITY_DESCRIPTION, /fixed set of statutory conditions/);
  assert.match(CAPABILITY_DESCRIPTION, /compiled contract/);
  assert.match(CAPABILITY_DESCRIPTION, /not checked/);
});

test("nyayaLean: 'verified' appears nowhere except inside the capability label", () => {
  const strings = [CAPABILITY_DESCRIPTION, ELEMENT_APPLICATION_STATUS, ...LEAN_CONTRACTS.map((c) => c.label)];
  for (const s of strings) {
    assert.ok(!s.toLowerCase().includes("verified"), `unexpected "verified" in: ${s}`);
  }
  assert.ok(!CAPABILITY_LABEL.toLowerCase().includes("verified")); // it doesn't -- the label says "checked"
});

test("nyayaLean: defers the element-application claim rather than hiding or overstating it", () => {
  assert.match(ELEMENT_APPLICATION_STATUS, /not yet claimed/);
  assert.match(ELEMENT_APPLICATION_STATUS, /gate P2\.5/);
  assert.match(ELEMENT_APPLICATION_STATUS, /no number until it passes/);
  // Never "came back null" -- that's not what happened (measured no contribution beyond retrieval).
  assert.doesNotMatch(ELEMENT_APPLICATION_STATUS, /came back null/);
});

test("nyayaLean: never states a per-vendor lift number", () => {
  // No bare decimal or percentage anywhere in the shipped copy -- a number here would need the reviewer's
  // accepted sha, which this module carries none of.
  for (const s of [CAPABILITY_DESCRIPTION, ELEMENT_APPLICATION_STATUS]) {
    assert.doesNotMatch(s, /\d+(\.\d+)?%/);
    assert.doesNotMatch(s, /\b0\.\d+\b/);
  }
});

test("nyayaLean: only offers contract ids the backend actually knows", () => {
  // Mirrors nyaya_lean.KNOWN_CONTRACT_IDS in src/pravrudhi/application/nyaya_lean.py at time of writing.
  // A mismatch here fails safely: the backend refuses an unknown id with a 4xx rather than mis-scoring.
  assert.deepEqual(
    LEAN_CONTRACTS.map((c) => c.id).sort(),
    ["0", "5"],
  );
});
