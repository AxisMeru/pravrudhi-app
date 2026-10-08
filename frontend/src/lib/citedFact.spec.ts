import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { NEUTRAL_NOTE, citationKind, citationNote, memoCitationCell, memoCitationHeader } from "./citedFact";

const model = { quote: "an invented sentence", quote_source: "model", quote_check: "ok", fact_id: "f1" };
const whole = { quote: "an invented sentence", quote_source: "whole_fact", quote_check: "ok", fact_id: "f2" };

test("the wording branches on quote_source: model quote, whole fact, or no claim", () => {
  assert.equal(citationKind(model), "model");
  assert.equal(citationKind(whole), "whole_fact");
  assert.equal(citationKind({ quote: "x", quote_source: "something_new" }), "none");
  assert.equal(citationKind({ quote: null, quote_source: null }), "none");
  assert.equal(citationKind({ quote: null, quote_source: "model" }), "none");
});

test("the engine's citation_note is used when it is there; without it the page makes no quote claim", () => {
  assert.equal(citationNote({ ...model, citation_note: "the engine's own sentence" }), "the engine's own sentence");
  assert.equal(citationNote({ ...whole, citation_note: "  another engine sentence " }), "another engine sentence");
  assert.equal(citationNote({ ...model, citation_note: "" }), NEUTRAL_NOTE);
  assert.equal(citationNote(model), NEUTRAL_NOTE);
  assert.equal(citationNote({ ...model, quote_check: "quote_not_found" }), NEUTRAL_NOTE);
  assert.equal(citationNote(whole), "cites your fact f2 in full (the judge names the fact; it does not quote words)");
  assert.equal(citationNote({ ...whole, fact_id: null }), "cites your fact in full (the judge names the fact; it does not quote words)");
  assert.equal(citationNote({ quote: "x", quote_source: "something_new" }), null);
  assert.ok(!/word-for-word|verbatim/i.test(NEUTRAL_NOTE));
});

test("the memo says Supporting quote only for model quotes, and Cited fact otherwise", () => {
  assert.equal(memoCitationHeader([model, { quote: null }]), "Supporting quote");
  assert.equal(memoCitationHeader([whole]), "Cited fact");
  assert.equal(memoCitationHeader([model, whole]), "Cited fact");
  assert.equal(memoCitationHeader([{ quote: null }]), "Cited fact");
  assert.equal(memoCitationCell(model), '"an invented sentence" (f1) (cites the supporting fact)');
  assert.equal(memoCitationCell({ ...model, citation_note: "engine sentence" }), '"an invented sentence" (f1) (engine sentence)');
  assert.equal(memoCitationCell(whole), "cites your fact f2 in full (the judge names the fact; it does not quote words)");
  assert.equal(memoCitationCell({ quote: null }), "no cited fact");
});

test("no page string claims a verbatim span or a highlighted passage", () => {
  const root = join(__dirname, "..");
  for (const f of ["app/matters/page.tsx", "lib/memo.ts", "lib/demo/steps.ts", "lib/surfaceCopy.ts", "lib/signedStrings.ts", "lib/citedFact.ts"]) {
    const text = readFileSync(join(root, f), "utf8");
    const strings = text.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    assert.doesNotMatch(strings, /verbatim span|highlighted passage/i, f);
  }
});
