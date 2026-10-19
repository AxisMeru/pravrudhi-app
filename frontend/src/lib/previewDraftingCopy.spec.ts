import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { DRAFTING_DRAFT, DRAFTING_R1 } from "./previewDraftingCopy";

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

// #445 form labels, worded by R1 (19 Oct, file PREVIEW_DRAFTING_STRINGS_445_R1_2026-10-19.md sha12 a9ae23922a5b): 21 keys stand as drafted (hashes from the draft file 2ff46d88342e), four changed (bailLine, consent, tagsHeading, factsSetAside).
const LABEL_PINS: Record<string, string> = {
  bailName: "4abe4799041c98ab",
  bailLine: "db5513d10c620a61",
  synopsisName: "243e6b516834025d",
  synopsisLine: "5fe35b4d6af1141e",
  consent: "6e552f50121b14ee",
  kind: "4fc5a6b4c1ecfa0a",
  kindBail: "7f1f8f31b6d11cc5",
  kindAnticipatory: "1b2242056f8b8ba2",
  forum: "60f6a4163e822a85",
  forumTrial: "db1b317f1921cde4",
  forumSessions: "fd8bf4992c5b7458",
  offenceDate: "7322ea82552960fa",
  firDate: "beb85e13ef5aed80",
  factsHeading: "3683709dabc0ad05",
  factText: "2558566c5e58d4c6",
  factApplicant: "d0a5630d15a63b9a",
  groundsHeading: "8db5f4ac888742f0",
  addFact: "e0812cce24382b45",
  tagsHeading: "6161c19babd88f43",
  sections: "69b909b0d2f0e018",
  documentLabel: "30b7c7b46c3c4144",
  runBail: "b1be0320bd9a7846",
  runSynopsis: "44ddf05f8a56154f",
  needMatter: "5c52c6f7b4503f9f",
  factsSetAside: "f6acb17a8d6398e6",
  keepRows: "ff66399743ead4ab",
  updateRows: "c6439969b08699ba",
  copy: "5147f732753a5783",
};
test("the drafting form labels are R1's words, by hash (every key)", () => {
  assert.deepEqual(Object.keys(DRAFTING_DRAFT).sort(), Object.keys(LABEL_PINS).sort());
  for (const [k, v] of Object.entries(DRAFTING_DRAFT)) assert.equal(h(v), LABEL_PINS[k], k);
});
