import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { MATTER_NOTE } from "./previewMatterNote";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);

test("the matter note, its scanned-paper line and the matter-gone line are exactly R1's, by hash", () => {
  // #478 (20 Oct): R1's matter note (MATTER_PAPERS_WORDS_FINAL 9544b4acd0c9) replaces the 17 Oct container-local note (15d02c2e35d26882)
  assert.equal(h(MATTER_NOTE.matter_note), "6fb40c9d10855f79");
  assert.equal(h(MATTER_NOTE.matter_note_images), "a5d57a3133af43c8");
  assert.equal(h(MATTER_NOTE.matter_gone), "2ceca924c5493d98");
  assert.doesNotMatch(MATTER_NOTE.matter_note + MATTER_NOTE.matter_note_images, /permanent|safe\b|secure|encrypt|backup|irrecoverab/i);
  assert.doesNotMatch(MATTER_NOTE.matter_note, /restarts|keep your own copies/, "the stale 17 Oct sentences are gone");
  assert.match(MATTER_NOTE.matter_note, /lost when you reload this page, and your matters cannot be listed here/, "option A interim: true today (no list-my-matters route; the matter id lives in the open page)");
});
