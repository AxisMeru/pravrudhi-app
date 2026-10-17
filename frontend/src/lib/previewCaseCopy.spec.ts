import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { IPC_TEXT_CAVEAT, PREVIEW_CASE } from "./previewCaseCopy";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const PINS: Record<string, string> = {
  name: "d73f98d51a9f2765",
  line: "cc00e10db1fe8fe9",
  run: "546d5d45f1657796",
  pickLegend: "888f61648127b2ef",
  pickNone: "f3f4f1c090a45e1a",
  readingLegend: "1880776e3df6ec3e",
  make: "1db5d6671669726e",
};

test("every cheque case check label is exactly R1's, by hash; the IPC caveat is pinned", () => {
  assert.deepEqual(Object.keys(PREVIEW_CASE).sort(), Object.keys(PINS).sort());
  for (const [k, hash] of Object.entries(PINS)) assert.equal(h((PREVIEW_CASE as Record<string, string>)[k]), hash, k);
  assert.equal(h(IPC_TEXT_CAVEAT), "27c3a9e31e5fa784");
});
