import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { NS_LINKS, NS_LINKS_HEADING, NS_LINKS_NOTE } from "./nyayasiddhiLinks";

const h = (s: string) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

test("the Links block words are R1's, pinned by hash, in order", () => {
  assert.equal(h(NS_LINKS_HEADING), "9024c197d84940e4");
  assert.equal(h(NS_LINKS_NOTE), "2ddc74867756737f");
  assert.deepEqual(NS_LINKS.map((l) => h(l.label)), ["c37f888ab5b5b81c", "866956901fd15362", "c47e9b05586c922b", "62682c3a509baec4", "f88a7762196b0deb", "46bd822638f75b6e"]);
});

test("the targets are exactly the Researcher's checked public pages of the dataset, https only", () => {
  const B = "https://huggingface.co/datasets/AxisMeru/nyayasiddhi";
  assert.deepEqual(NS_LINKS.map((l) => l.href), [B, `${B}/tree/main`, `${B}/blob/main/scorer/s6_scorer.py`, `${B}/blob/main/submission680/PARTICIPANT_README.md`, `${B}/blob/main/submission680/SUBMISSION_PATH_680.md`, `${B}/tree/main/results`]);
  for (const l of NS_LINKS) assert.match(l.href, /^https:\/\/huggingface\.co\/datasets\/AxisMeru\/nyayasiddhi(\/|$)/);
});

test("no label promises an outcome or claims a status", () => {
  for (const l of NS_LINKS) assert.doesNotMatch(l.label, /download|submit now|get started|official|leaderboard|\d+ files/i);
});
