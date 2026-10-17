import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { NS_DRAWER } from "./nyayasiddhiDrawer";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const PINS: Record<string, string> = {
  open_button: "afc115cabb3f2954",
  dialog_title: "42cdae8bda4983ab",
  close_button: "7d9eb7acb13e2462",
  version_label: "3eb1f61b89f1ab77",
  version_note: "dcedf5bd789bbe4e",
  field_system: "6725e7bbcd28f3a8",
  field_version: "85419f266e9d638f",
  field_split: "32afaa7843336480",
  field_unit: "4e545960f1bffc13",
  field_stack: "f4b4b028ecbb6856",
  field_date: "3c1ab0b0cec6b8f1",
  field_status: "920e413c7d411b61",
  field_errors: "23316c70fe8de1fe",
  field_about: "3458a2ee2095b693",
  links_heading: "4da6402815fc1869",
  link_manifest: "1ccb2bf9f936352e",
  link_predictions: "6f66c41df078a5aa",
  hash_manifest: "e53009438f40c28b",
  hash_predictions: "9bcd3e5f48bba4b3",
  links_note: "c7f57c8fed8a95c9",
};

test("every drawer and selector label is exactly R1's, by hash (20 keys)", () => {
  assert.equal(Object.keys(PINS).length, 20);
  assert.deepEqual(Object.keys(NS_DRAWER).sort(), Object.keys(PINS).sort());
  for (const [k, hash] of Object.entries(PINS)) assert.equal(h((NS_DRAWER as Record<string, string>)[k]), hash, k);
});
