import { strict as assert } from "node:assert";
import test from "node:test";

import { ASSIST_LINE, SAFETY_COPY, SAFETY_FIGURES, SAFETY_LABEL, SAFETY_MATERIAL, SAFETY_NUMBERS, SAFETY_RECORDS, SAFETY_STACK } from "./safety";
import { DO_NOT_CLAIM } from "../surfaceCopy";

const R1_LABEL =
  "Real court material (Obj-1b), two judges that both have to agree, one run. Post-hoc, on a set we have seen; mixed stack (4B judge on our development stack, 32B judge on the production serverless endpoint). Descriptive of this set, not production traffic, not a validation.";

test("the safety label is R1's ruling of 12 Oct, word for word, and the assist line is unchanged", () => {
  assert.equal(SAFETY_LABEL, R1_LABEL);
  assert.match(SAFETY_LABEL, /not production traffic, not a validation\.$/);
  assert.equal(ASSIST_LINE, "This assists a lawyer; it is not a verdict.");
  assert.doesNotMatch(SAFETY_COPY.join(" "), /config(uration)? c\b/i, "partner-facing text says two judges, never config C");
});

test("no sentence on the safety page calls the set sealed or unseen, or calls the measured arrangement the production configuration (R1 on #62, ruling 12 Oct)", () => {
  for (const s of SAFETY_COPY) {
    assert.doesNotMatch(s, /\bsealed\b/i, s);
    for (const m of s.matchAll(/production configuration/gi)) assert.match(s.slice(Math.max(0, m.index! - 8), m.index! + m[0].length), /not the production configuration/i, s);
  }
  assert.match(SAFETY_MATERIAL, /^A set of 372 real court items \(Obj-1b\) that we have seen\. A general-purpose AI model read it in an earlier study, so it is no longer unseen by every model\. 51 were set aside/);
  assert.doesNotMatch(SAFETY_MATERIAL, /overlap|8-gram|training data|kept out/i, "R1 and R2 (12 Oct): the overlap sentence is deleted from the page");
  assert.doesNotMatch(SAFETY_MATERIAL, /sealed|fixed set/i);
  assert.equal(
    SAFETY_STACK,
    "A 4B element judge (threshold 0.74) and a 32B judge (threshold 0.97) that both have to agree. In this run the 4B ran on our development stack and the 32B on the production serverless endpoint, so this is not the production configuration; 4B dev-to-production parity is not established. One run, post-hoc, on an exposed set; not a claim about a different court population.",
  );
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
  assert.match(text, /not that such items are unsafe/);
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

test("the false-proof figure is R1's ruling: an upper bound beside the zero count, the worst case named as such, and 0 of 31 sits beside it", () => {
  assert.deepEqual(
    SAFETY_FIGURES.map((f) => [f.heading, f.text]),
    [
      [
        "False proofs on real court-rejected items",
        "0 of 290 real court-rejected items, one-sided 95% upper bound 1.03% (worst case, if the 2 items where the second judge was unavailable were false proofs: 2 of 290, one-sided upper bound 2.15%). A bound on the rate, not an observed rate. Post-hoc, on an exposed set; mixed stack.",
      ],
      [
        "Real court-established items proved",
        "0 of 31 real court-established items proved (one-sided upper bound 9.2%). Read beside the line above: zero false proofs beside zero proofs is not evidence that the system avoids false proofs in general. It is a statement about what it did on this set, not that such items are unsafe.",
      ],
    ],
  );
  assert.equal(SAFETY_FIGURES[0].id, "false-proofs");
  assert.equal(SAFETY_FIGURES[1].id, "coverage");
});

test("the material explains the 51 exclusions in words and does not state a section number", () => {
  assert.match(SAFETY_COPY.join(" "), /51 were set aside because the design sends them straight to a lawyer without a judgment \(46 court-rejected, 5 court-established\)/);
  assert.doesNotMatch(SAFETY_COPY.join(" "), /section 482|s\.\s*482|\b482\b/i);
});
