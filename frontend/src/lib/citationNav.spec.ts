import assert from "node:assert/strict";
import test from "node:test";

import { citationNavOffered } from "./citationNav";

test("the citation check is offered in the nav only when the build turns it on; every other page is unaffected", () => {
  assert.equal(citationNavOffered("/citations", false), false);
  assert.equal(citationNavOffered("/citations", true), true);
  assert.equal(citationNavOffered("/matters", false), true);
});

test("the /citations notice for a build that does not serve the check: R1's signed sentence, never 'not yet served'", async () => {
  const { CITATION_NOT_OFFERED_TEXT, CITATION_NOT_OFFERED_LINK } = await import("./citationNav");
  assert.equal(CITATION_NOT_OFFERED_TEXT, "A citation check is not offered in this version of the app.");
  assert.equal(CITATION_NOT_OFFERED_LINK, "Go to Screening");
  assert.doesNotMatch(CITATION_NOT_OFFERED_TEXT, /not yet served|dev stack/i);
});
