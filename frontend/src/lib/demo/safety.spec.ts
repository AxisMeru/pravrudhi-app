import { strict as assert } from "node:assert";
import test from "node:test";

import { ASSIST_LINE, SAFETY_COPY, SAFETY_LABEL, SAFETY_MATERIAL, SAFETY_NUMBERS, SAFETY_RECORDS } from "./safety";
import { DO_NOT_CLAIM } from "../surfaceCopy";

test("the safety copy carries Track A's label and the assist line", () => {
  assert.match(SAFETY_LABEL, /Real High Court material, the Obj-1b set, kept out of our judges' training data but read once by a general-purpose model in an earlier study; measured with two judges/);
  assert.doesNotMatch(SAFETY_COPY.join(" "), /config(uration)? c\b/i, "partner-facing text says two judges, never config C");
  assert.match(SAFETY_LABEL, /one run, one seed/);
  assert.match(SAFETY_LABEL, /not production traffic/);
  assert.equal(ASSIST_LINE, "This assists a lawyer; it is not a verdict.");
});

test("no sentence on the safety page calls the set sealed, or calls the measured arrangement the production configuration (R1 on #62)", () => {
  for (const s of SAFETY_COPY) {
    assert.doesNotMatch(s, /\bsealed\b/i, s);
    assert.doesNotMatch(s, /production configuration/i, s);
  }
  assert.match(SAFETY_MATERIAL, /kept out of our judges' training data; a general-purpose AI model read it in an earlier study, so it is no longer unseen by every model/);
  assert.doesNotMatch(SAFETY_MATERIAL + SAFETY_LABEL, /exposed to the models/);
});

test("every number on the safety page is a sourced figure", () => {
  for (const s of SAFETY_COPY) {
    for (const n of s.match(/\d+(?:\.\d+)?/g) ?? []) assert.ok(SAFETY_NUMBERS.has(n), `${n} in: ${s}`);
  }
});

test("the safety copy makes no claim on the do-not-claim list (the figures pattern is the page's own sourced figures)", () => {
  for (const re of [DO_NOT_CLAIM[0], DO_NOT_CLAIM[1], DO_NOT_CLAIM[2], DO_NOT_CLAIM[4]]) {
    for (const s of SAFETY_COPY) assert.doesNotMatch(s, re, s);
  }
  for (const s of SAFETY_COPY) assert.doesNotMatch(s, /saves? (you )?(hours?|time)|hours? saved|faster|better than|accura/i);
});

test("the claims stay inside their scope: no trial or appellate generalisation, 'unsafe' is denied, no production claim", () => {
  const text = SAFETY_COPY.join(" ");
  assert.match(text, /not a statement about trial or appellate conviction judgments/);
  assert.match(text, /not a statement that such items are unsafe/);
  assert.match(text, /not a claim about a different court population/);
  assert.doesNotMatch(text, /production traffic[^.]*\b(is|are) (safe|reliable)/i);
});

test("every figure names the record it rests on, at a commit", () => {
  assert.equal(SAFETY_RECORDS.length, 3);
  for (const r of SAFETY_RECORDS) {
    assert.match(r.commit, /^[0-9a-f]{40}$/);
    assert.ok(r.repo && r.path);
  }
});

test("the false-proof figure is stated as an upper bound, never as an observed count of 2", () => {
  const text = SAFETY_COPY.join(" ");
  assert.match(text, /0 of 290; 95% upper bound 1\.03% \(worst case if 2 ERROR items were false proofs: upper bound 2\.15%\)/);
  assert.doesNotMatch(text, /\b2 of 290\b/);
});

test("the material explains the 51 exclusions in words and does not state a section number", () => {
  assert.match(SAFETY_COPY.join(" "), /51 were set aside because the design sends them straight to a lawyer without a judgment \(46 court-rejected, 5 court-established\)/);
  assert.doesNotMatch(SAFETY_COPY.join(" "), /section 482|s\.\s*482|\b482\b/i);
});
