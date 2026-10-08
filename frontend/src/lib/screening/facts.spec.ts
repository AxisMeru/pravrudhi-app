import assert from "node:assert/strict";
import test from "node:test";

import { splitIntoFacts } from "./facts";

test("a pasted FIR splits into one fact per paragraph or line, whitespace collapsed, blanks dropped", () => {
  assert.deepEqual(splitIntoFacts("First  fact\n\n  Second\tfact  \r\nThird"), ["First fact", "Second fact", "Third"]);
  assert.deepEqual(splitIntoFacts("  \n "), []);
});
