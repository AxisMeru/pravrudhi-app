import assert from "node:assert/strict";
import test from "node:test";

import { citationNavOffered, citationsPanelOffered } from "./citationNav";

test("the citation check is offered in the nav only when the build turns it on; every other page is unaffected", () => {
  assert.equal(citationNavOffered("/citations", false), false);
  assert.equal(citationNavOffered("/citations", true), true);
  assert.equal(citationNavOffered("/matters", false), true);
});

test("the Screening citations panel is rendered only when the nav flag AND the existence-only flag are both on", () => {
  assert.equal(citationsPanelOffered(false, false), false);
  assert.equal(citationsPanelOffered(true, false), false);
  assert.equal(citationsPanelOffered(false, true), false);
  assert.equal(citationsPanelOffered(true, true), true);
});
