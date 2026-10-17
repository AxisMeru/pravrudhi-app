import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { DRAFTING_R1 } from "./previewDraftingCopy";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
// R1's hashes: a4_notes_heading, a4_fillins_heading, MORE_NOTES_HEADING, a4_template_only, a4_tick_warning, a8_tick_warning
const PINS: Record<keyof typeof DRAFTING_R1, string> = {
  notesHeading: "bc4f8fae0e8643d4",
  fillInsHeading: "3935f896e34a98a3",
  moreNotesHeading: "290e950a5d5cea6f",
  templateOnly: "59673ff74f88cd62",
  bailTickWarning: "d3b15f2c353fbab9",
  synopsisTickWarning: "c74def998e2a9d3f",
};

test("drafting labels worded by R1 are unchanged", () => {
  for (const [k, pin] of Object.entries(PINS)) assert.equal(h(DRAFTING_R1[k as keyof typeof DRAFTING_R1]), pin, k);
});
