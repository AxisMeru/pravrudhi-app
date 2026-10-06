import { strict as assert } from "node:assert";
import test from "node:test";

import { ASSIST_LINE, SAFETY_COPY, SAFETY_LABEL, SAFETY_NUMBERS, SAFETY_RECORDS } from "./safety";
import { DO_NOT_CLAIM } from "../surfaceCopy";

test("the safety copy carries Track A's label and the assist line", () => {
  assert.match(SAFETY_LABEL, /Real High Court material, sealed Obj-1b, config C/);
  assert.match(SAFETY_LABEL, /one run, one seed/);
  assert.match(SAFETY_LABEL, /not production traffic/);
  assert.equal(ASSIST_LINE, "This assists a lawyer; it is not a verdict.");
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
