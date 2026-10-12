import assert from "node:assert/strict";
import test from "node:test";

import { pickerState } from "./contractsPicker";

test("the picker is loading until the registry answers, empty when it answers with none, error when it fails", () => {
  assert.equal(pickerState(false, false, 0, false), "loading");
  assert.equal(pickerState(true, false, 0, false), "empty");
  assert.equal(pickerState(false, true, 0, false), "error");
  assert.equal(pickerState(true, true, 0, false), "error");
  assert.equal(pickerState(true, false, 3, false), "ready");
});

test("the recorded demo has no registry and keeps its old loading behaviour", () => {
  assert.equal(pickerState(true, false, 0, true), "loading");
  assert.equal(pickerState(true, false, 2, true), "ready");
});
