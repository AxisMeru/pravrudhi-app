import assert from "node:assert/strict";
import test from "node:test";

import { BANNED } from "./wordingAudit";
import { DO_NOT_CLAIM } from "./surfaceCopy";
import { ABOUT_LINE, PRODUCT_DESCRIPTION, PRODUCT_LINE, PRODUCT_NAME } from "./productCopy";

// R1's exact words (13 Oct 2026), pinned byte for byte so an edit cannot slip in; Studio's equality check pins the same text.
test("the product name and the two lines are R1's exact text", () => {
  assert.equal(PRODUCT_NAME, "Pravrudhi-Nyaya");
  assert.equal(
    PRODUCT_LINE,
    "Element-by-element screening of Indian criminal matters. For each offence it covers under the BNS and the IPC, every ingredient is set against the facts in your papers. An ingredient is shown as supported only where a cited fact appears to carry it, as a suggestion for you to check; where none does, it is referred back to you.",
  );
  assert.equal(
    ABOUT_LINE,
    "Nyāya is the Indian school of reasoning in which a claim is accepted only when each step is shown and its evidence named. Pravrudhi-Nyaya is built to follow that discipline when it reads a matter file.",
  );
});

test("neither line, nor the description, trips the wording audit or the do-not-claim list", () => {
  for (const s of [PRODUCT_LINE, ABOUT_LINE, PRODUCT_DESCRIPTION]) {
    assert.doesNotMatch(s, BANNED, s);
    for (const re of DO_NOT_CLAIM) assert.doesNotMatch(s, re, s);
  }
});

test("the product edition is named and described by these constants, whatever the engine reports", async () => {
  const { PRODUCT } = await import("./edition");
  assert.equal(PRODUCT.edition, PRODUCT_NAME);
  assert.equal(PRODUCT.tagline, PRODUCT_LINE);
});
