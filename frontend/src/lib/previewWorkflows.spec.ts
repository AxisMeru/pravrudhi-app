import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { PREVIEW } from "./previewWorkflows";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const PINS: Record<string, string> = {
  preview_line: "e199e956594cb1fe",
  preview_short: "b9900bac73e05cef",
  wf_unavailable: "3d906df05047c66e",
  wf_busy: "2d4fbfbf50b34057",
  wf_error: "0af66080cc67ec83",
  wf_no_papers: "b5024f38e71d13e9",
};

test("every preview-workflow string is exactly R1's, by hash", () => {
  assert.deepEqual(Object.keys(PREVIEW).sort(), Object.keys(PINS).sort());
  for (const [k, hash] of Object.entries(PINS)) assert.equal(h((PREVIEW as Record<string, string>)[k]), hash, k);
});
