import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { MATTER_NOTE } from "./previewMatterNote";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);

test("the matter note, its scanned-paper line and the matter-gone line are exactly R1's, by hash", () => {
  // #478 (20 Oct): R1's matter note (MATTER_PAPERS_WORDS_FINAL 9544b4acd0c9) replaces the 17 Oct container-local note (15d02c2e35d26882)
  assert.equal(h(MATTER_NOTE.matter_note), "8bb3053cf8c7acdc"); // R1, 22 Oct: the signed-out / list-not-shown note (replaces the v3 note 6fb40c9d10855f79)
  assert.equal(h(MATTER_NOTE.matter_note_list), "559d274110ed22e2"); // the signed-in ym_note, unchanged
  assert.equal(h(MATTER_NOTE.matter_note_images), "a5d57a3133af43c8");
  assert.equal(h(MATTER_NOTE.matter_gone), "2ceca924c5493d98");
  assert.doesNotMatch(MATTER_NOTE.matter_note + MATTER_NOTE.matter_note_images, /permanent|safe\b|secure|encrypt|backup|irrecoverab/i);
  assert.doesNotMatch(MATTER_NOTE.matter_note, /restarts|keep your own copies/, "the stale 17 Oct sentences are gone");
  assert.doesNotMatch(MATTER_NOTE.matter_note, /cannot be listed here|Keep the matter number|lost when you reload/, "the v3 sentences are gone: false once the list exists");
  assert.match(MATTER_NOTE.matter_note, /When you are signed in, Your matters lists your matters, and you can open or delete them there\./, "no claim that a list is visible to this reader");
});
