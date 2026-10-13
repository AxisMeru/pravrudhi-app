import { strict as assert } from "node:assert";
import test from "node:test";

import { ASSIST_LINE, EVIDENCE_LINE, SAFETY_COPY, SAFETY_STATEMENTS, SAFETY_SUBTITLE } from "./safety";
import { DO_NOT_CLAIM } from "../surfaceCopy";

test("the safety page says exactly R1's four value statements (14 Oct), then the assist line and the evidence line", () => {
  assert.deepEqual([...SAFETY_STATEMENTS], [
    "The screen never states a conclusion about your matter. It suggests facts to check, and anything it cannot support goes back to the lawyer.",
    "In our checks on real court-rejected items it did not return a proof for any of them.",
    "It is cautious by design: on the real court-established items in the same checks it did not return a proof either, so use it as a screen that points you to what to check, not as a source of proofs.",
    "These checks used real court material we had already seen, with two judges that both have to agree, on a mixed development and production setup. They describe that material only: not your matters, not production traffic, and not trial or appellate conviction judgments.",
  ]);
  assert.equal(SAFETY_SUBTITLE, "How the screen behaves on real court material, and what that does not cover.");
  assert.equal(ASSIST_LINE, "This assists a lawyer; it is not a verdict.");
  assert.equal(EVIDENCE_LINE, "Evidence, not legal advice.");
});

test("the safety page carries no figure, bound, count, threshold, model size or internal record (Lead-2, 14 Oct)", () => {
  const text = SAFETY_COPY.join(" ");
  assert.doesNotMatch(text, /\d/);
  assert.doesNotMatch(text, /upper bound|\bbound\b|one-sided|threshold|worst case|confidence|AxisMeru|prabhasa|commit|private repository|\b4B\b|\b32B\b|Obj-1b/i);
  assert.doesNotMatch(text, /\bsealed\b|production configuration|config(uration)? c\b/i);
});

test("the safety copy makes no claim on the do-not-claim list", () => {
  for (const re of [DO_NOT_CLAIM[0], DO_NOT_CLAIM[1], DO_NOT_CLAIM[2], DO_NOT_CLAIM[4]]) {
    for (const s of SAFETY_COPY) assert.doesNotMatch(s, re, s);
  }
  for (const s of SAFETY_COPY) assert.doesNotMatch(s, /saves? (you )?(hours?|time)|hours? saved|faster|better than|accura/i);
});

test("the claims stay inside their scope: no trial or appellate generalisation, nothing about production traffic being safe", () => {
  const text = SAFETY_COPY.join(" ");
  assert.match(text, /not trial or appellate conviction judgments/);
  assert.match(text, /not production traffic/);
  assert.doesNotMatch(text, /production traffic[^.]*\b(is|are) (safe|reliable)/i);
});
