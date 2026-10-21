import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { PREVIEW_HEARING } from "./previewHearingCopy";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const PINS: Record<string, string> = {
  name: "c30f3734394fd70d",
  line: "28769912899bc73e",
  dateLabel: "122bf2d2fb7692fd",
  datePlaceholder: "51a498bc1a85fc9c",
  run: "f9c1fca13a1acd0a",
};

test("hearing pack labels are R1's words, unchanged", () => {
  assert.deepEqual(Object.keys(PREVIEW_HEARING).sort(), Object.keys(PINS).sort());
  for (const [k, pin] of Object.entries(PINS)) assert.equal(h(PREVIEW_HEARING[k as keyof typeof PREVIEW_HEARING]), pin, k);
});
