import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { NS_HIDDEN_SPLIT, NS_SUBMIT, NS_SUBMIT_LINKS, NS_SUBMIT_LINK_TEXT } from "./nyayasiddhiSubmit";

// R1's final strings, pinned by sha256[:16] (NYAYASIDDHI_SUBMIT_STRINGS_R1_FINAL_HASHES.txt, with oracle_note = R2's one sentence).
const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const PINS: Record<string, string> = {
  heading: "c3ff81b6c553472b",
  intro: "a13390d604b5bbb2",
  status_line: "461612e66db52a50",
  not_a_ranking: "755b0cf7f0b29a3d",
  no_outside_yet: "83304958d7a78df4",
  step1: "4c14f5d4085ee4af",
  step2: "3c05da1d7aa479b6",
  step3: "f5987700ec21f621",
  step4: "f13e7d01bcb91a62",
  step5: "fdbe3a600aee7dc1",
  step6: "a4973025ee2019fc",
  after_submit: "ea80e285d050af68",
  oracle_note: "4a55e98b148cd683",
  template_heading: "f51ab132bbc54878",
  checker_heading: "38e55f2b5e88a01f",
  checker_text: "d834bab39ae4e5be",
  limits_heading: "e4d1388cac52b87e",
  limit1: "ab3d58c09bacb165",
  limit2: "9bc86289785c819b",
  limit3: "d6e80e398abea50f",
  limit4: "c9452178f98219bd",
  no_upload: "6cbdb77fff81e510",
  link_dataset: "3439c77aa67dcd3f",
  link_checker: "1ab62344b74f7f66",
  link_back: "8101ab85abc9f789",
};

test("every submission-page sentence is exactly R1's, by hash", () => {
  for (const [k, hash] of Object.entries(PINS)) assert.equal(h((NS_SUBMIT as Record<string, unknown>)[k] as string), hash, k);
  assert.deepEqual(Object.keys(PINS).sort(), Object.keys(NS_SUBMIT).filter((k) => k !== "templateFields" && k !== "hidden_split").sort());
  assert.equal(h(NS_HIDDEN_SPLIT), "1502d9c1b8e3fdf1");
  assert.equal(NS_SUBMIT.hidden_split, NS_HIDDEN_SPLIT);
});

test("the template has nine fields and the link text is R1's", () => {
  assert.equal(NS_SUBMIT.templateFields.length, 9);
  assert.equal(h(NS_SUBMIT_LINK_TEXT), "d2b7ad05a8091b01");
});

test("the page links only to public files of the AxisMeru/nyayasiddhi dataset", () => {
  for (const u of Object.values(NS_SUBMIT_LINKS)) assert.match(u, /^https:\/\/huggingface\.co\/datasets\/AxisMeru\/nyayasiddhi(\/|$)/, u);
});

test("the oracle note makes no claim that a reference file is published (R2, 17 Oct)", () => {
  assert.doesNotMatch(NS_SUBMIT.oracle_note, /publish|reference/i);
  assert.equal(NS_SUBMIT.oracle_note, "A file whose verdicts equal the released labels on every scored item is not accepted.");
});
