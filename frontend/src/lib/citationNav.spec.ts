import assert from "node:assert/strict";
import test from "node:test";

import { citationNavOffered } from "./citationNav";

test("the citation check is offered in the nav only when the build turns it on; every other page is unaffected", () => {
  assert.equal(citationNavOffered("/citations", false), false);
  assert.equal(citationNavOffered("/citations", true), true);
  assert.equal(citationNavOffered("/matters", false), true);
});
