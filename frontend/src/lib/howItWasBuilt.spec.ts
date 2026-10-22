import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import test from "node:test";

import { HOW_BUILT_CARDS, HOW_BUILT_STORY, HOW_BUILT_TITLE } from "./howItWasBuilt";

// The text is the explorer's signed #914 set (v5, sha256 2ac5468a…); this pins it byte for byte, so a changed word fails here and needs R1's read.
const SIGNED = createHash("sha256").update(JSON.stringify([HOW_BUILT_STORY, HOW_BUILT_CARDS]), "utf8").digest("hex");
const ALL = [HOW_BUILT_STORY, ...HOW_BUILT_CARDS.flatMap((c) => [c.title, ...c.items.map((i) => (i.label ? i.label + ": " : "") + i.text)])].join("\n");

test("How it was built: six cards of four lines, the customer layer only", () => {
  assert.equal(HOW_BUILT_TITLE, "How it was built");
  assert.equal(HOW_BUILT_CARDS.length, 6);
  for (const c of HOW_BUILT_CARDS) assert.equal(c.items.length, 4, c.title);
  assert.equal(SIGNED, "f45ad846469d591089952c8db43fad8fcd115648380860801139c786810883cb");
});

test("How it was built: no figures, no internal source map, the naming and the extraction caveat are as signed", () => {
  assert.doesNotMatch(ALL.replace("v5.x", ""), /\d/, "no figures (the model-line name v5.x is a name, not a figure)");
  assert.doesNotMatch(ALL, /sha256|BULK_RECORD|source map|INTERNAL/i);
  assert.match(ALL, /Prabhāsa-Nyāya/);
  assert.match(ALL, /Pravrudhi-Nyaya/);
  assert.doesNotMatch(ALL, /Prabhasa-Nyaya/);
  assert.match(ALL, /model-extracted, no human review/i);
  assert.doesNotMatch(ALL, /criminal-law only/i);
  assert.match(HOW_BUILT_STORY, /The product refers to a lawyer rather than guess\.$/);
  assert.equal(ALL, ALL.normalize("NFC"));
});
