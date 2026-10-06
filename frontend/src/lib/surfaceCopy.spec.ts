import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { CAVEATS, DO_NOT_CLAIM, NOT_VALIDATED_LABEL, citationQuery, pickCorpusHit, showNotValidated, validatedById } from "./surfaceCopy";
import { STATUTE_NOTICE } from "./statuteNotice";

test("the caveat strip says what a reviewer needs: a model reads the facts, the two-part stack, the mark, the statute notice", () => {
  const ids = CAVEATS.map((c) => c.id);
  assert.deepEqual(ids, ["model", "stack", "validated", "statute"]);
  const text = CAVEATS.map((c) => c.text).join(" ");
  assert.match(text, /not a court's finding and not legal advice/);
  assert.match(text, /judge model/);
  assert.match(text, /Lean/);
  assert.ok(CAVEATS.some((c) => c.text === STATUTE_NOTICE));
});

test("no copy on the surface makes a claim on the do-not-claim list, and none carries a count of contracts", () => {
  const copy = [...CAVEATS.map((c) => c.text), NOT_VALIDATED_LABEL];
  // The page's visible strings: its source with whole-line comments dropped (a developer comment is not copy).
  const page = readFileSync(join(__dirname, "..", "app", "matters", "page.tsx"), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  for (const re of DO_NOT_CLAIM.slice(0, 3).concat(DO_NOT_CLAIM[4])) {
    for (const s of copy) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(page, re, String(re));
  }
  for (const s of copy) assert.doesNotMatch(s, /\d+ (of|out of) \d+|\b\d+ contracts\b/i);
});

test("the not-validated mark is read from the registry: only a positively validated contract goes unmarked", () => {
  const v = validatedById([{ id: "bns69", validated: true }, { id: "bns302", validated: false }, { id: "x", validated: undefined as never }]);
  assert.equal(showNotValidated(v, "bns69"), false);
  assert.equal(showNotValidated(v, "bns302"), true);
  assert.equal(showNotValidated(v, "x"), true);
  assert.equal(showNotValidated(v, "unlisted"), true);
});

test("with no registry read at all there is no mark (the engine still refers unvalidated contracts)", () => {
  for (const bad of [undefined, null, [], "x" as never, {} as never]) assert.equal(showNotValidated(validatedById(bad), "bns69"), false);
});

test("a statute is looked up by the section the contract names, and only the matching hit is used", () => {
  const ref = { act: "BNS", section: "69", corpus_id: "BNS/Section 69", in_corpus: true, title: "t" };
  assert.equal(citationQuery(ref), "BNS section 69");
  assert.equal(citationQuery({ ...ref, in_corpus: false }), null);
  assert.equal(citationQuery({ ...ref, section: null }), null);
  assert.equal(citationQuery({ ...ref, corpus_id: null }), null);
  const hits = [{ id: "BNS/Section 690" }, { id: "BNS/Section 69" }];
  assert.deepEqual(pickCorpusHit(hits, "BNS/Section 69"), { id: "BNS/Section 69" });
  assert.equal(pickCorpusHit(hits, "IPC/Section 1"), null);
  assert.equal(pickCorpusHit(undefined, "x"), null);
});
