import assert from "node:assert/strict";
import test from "node:test";

import { EXAMPLE_ANONYMOUS_NOTE } from "./surfaceCopy";

// R1 (15 Oct, #213): exact words.
test("the example sentence under the signed-out prompt is R1's", () => {
  assert.equal(EXAMPLE_ANONYMOUS_NOTE, "These facts are a public court order used as an example, not your matter, so the anonymous demo is enough.");
});
