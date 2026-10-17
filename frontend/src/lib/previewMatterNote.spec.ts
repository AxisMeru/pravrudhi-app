import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { MATTER_NOTE } from "./previewMatterNote";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);

test("the matter note and the matter-gone line are exactly R1's, by hash, and promise no storage", () => {
  assert.equal(h(MATTER_NOTE.matter_note), "15d02c2e35d26882");
  assert.equal(h(MATTER_NOTE.matter_gone), "2ceca924c5493d98");
  assert.doesNotMatch(MATTER_NOTE.matter_note + MATTER_NOTE.matter_gone, /stay stored|until you delete|permanently|kept/i);
});
