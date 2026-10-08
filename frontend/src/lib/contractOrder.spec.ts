import assert from "node:assert/strict";
import test from "node:test";

import { referFirst } from "./contractOrder";

const c = (id: string, outcome: string) => ({ id, outcome });

test("referrals come first, and every group keeps the engine's order", () => {
  const out = referFirst([c("a", "PROOF"), c("b", "REFER_TO_LAWYER"), c("c", "ABSTAIN"), c("d", "REFER_TO_LAWYER"), c("e", "DENIAL")]);
  assert.deepEqual(out.map((x) => x.id), ["b", "d", "a", "c", "e"]);
});

test("nothing is dropped or duplicated, and the input is not changed", () => {
  const input = [c("a", "PROOF"), c("b", "REFER_TO_LAWYER")];
  const out = referFirst(input);
  assert.equal(out.length, 2);
  assert.deepEqual(input.map((x) => x.id), ["a", "b"]);
  assert.deepEqual(referFirst([]), []);
  assert.deepEqual(referFirst([c("a", "PROOF")]).map((x) => x.id), ["a"]);
});

test("an unknown outcome is not treated as a referral", () => {
  assert.deepEqual(referFirst([c("a", "something_new"), c("b", "REFER_TO_LAWYER")]).map((x) => x.id), ["b", "a"]);
});
