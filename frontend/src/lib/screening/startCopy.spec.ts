import assert from "node:assert/strict";
import test from "node:test";

import { DROP_ZONE_LINE, DROP_ZONE_TYPES, FACTS_HEADING, OFFENCE_HEADING, OFFENCE_SEARCH_EMPTY, OFFENCE_SEARCH_LABEL, START_PANEL_CLOSE_LABEL, START_PANEL_DATA_LINK, START_PANEL_EXAMPLE_BUTTON, START_PANEL_HEADING, START_PANEL_LINE, START_PANEL_OWN_BUTTON, START_PANEL_STEPS } from "./copy";
import { offenceMark } from "../surfaceCopy";

// R1's exact words for the Matter workspace's first-run panel, headings, drop zone and offence search (P5, 15 Oct).
test("the first-run panel, headings, drop zone and search words are R1's, exactly", () => {
  assert.equal(START_PANEL_HEADING, "Start a screening");
  assert.equal(START_PANEL_LINE, "See which ingredients of an offence your facts support, which they do not, and what to check before you rely on it.");
  assert.deepEqual([...START_PANEL_STEPS], ["Paste or upload the facts", "Pick the offence", "Read the checklist and export the memo"]);
  assert.equal(START_PANEL_EXAMPLE_BUTTON, "Try an example from a public court order");
  assert.equal(START_PANEL_OWN_BUTTON, "Paste your own facts");
  assert.equal(START_PANEL_DATA_LINK, "What is kept and what is sent (Data handling)");
  assert.equal(START_PANEL_CLOSE_LABEL, "Close this panel");
  assert.equal(FACTS_HEADING, "The facts");
  assert.equal(OFFENCE_HEADING, "The offence");
  assert.equal(DROP_ZONE_LINE, "Drop a file here, or paste the text into the box.");
  assert.equal(DROP_ZONE_TYPES, ".txt, .pdf or .docx");
  assert.equal(OFFENCE_SEARCH_LABEL, "Search by name or section");
  assert.equal(OFFENCE_SEARCH_EMPTY, "No offence matches that search.");
});

test("the offence mark says validated only when every contract is; otherwise the status the visitor most needs to see", () => {
  const v = new Map([["a", true], ["b", true], ["c", false]]);
  assert.equal(offenceMark(v, ["a", "b"]), "validated");
  assert.equal(offenceMark(v, ["a", "c"]), "not validated, verify");
  assert.equal(offenceMark(v, ["a", "zz"]), "not validated, verify");
  assert.equal(offenceMark(null, ["a"]), "validation status unavailable, verify");
  assert.equal(offenceMark(new Map(), ["a"]), "validation status unavailable, verify");
  // the static flag (an offence the app itself lists as not validated) wins over a registry that lists it: both arms
  assert.equal(offenceMark(v, ["a", "b"], true), "not validated, verify");
  assert.equal(offenceMark(v, ["a", "b"], false), "validated");
  assert.equal(offenceMark(null, ["a"], true), "not validated, verify");
});
