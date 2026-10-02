import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFacts, extractText, MAX_FACTS, MAX_FACT_CHARS, MAX_FILE_BYTES, NO_TEXT_MESSAGE } from "./factsInput";

const f = (name: string, body: string, size = body.length) => ({ name, size, text: async () => body });

test("one fact per non-empty line", () => {
  const r = checkFacts("a\n\n  b  \n");
  assert.deepEqual(r, { ok: true, facts: ["a", "b"] });
});

test("more than 8 facts is refused with the limit, not truncated", () => {
  const r = checkFacts(Array.from({ length: MAX_FACTS + 1 }, (_, i) => `f${i}`).join("\n"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /limit is 8/);
});

test("an over-length fact names its line and the limit", () => {
  const r = checkFacts(`ok\n${"x".repeat(MAX_FACT_CHARS + 1)}`);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /Fact 2 .*4000/);
});

test("exactly at the limits passes", () => {
  const r = checkFacts(Array.from({ length: MAX_FACTS }, () => "x".repeat(MAX_FACT_CHARS)).join("\n"));
  assert.equal(r.ok, true);
});

test("empty input is refused", () => assert.equal(checkFacts("  \n ").ok, false));

test("txt yields editable text", async () => {
  assert.deepEqual(await extractText(f("a.txt", "Fact one.\nFact two.")), { ok: true, text: "Fact one.\nFact two." });
});

test("a blank file gets the no-text message", async () => {
  assert.deepEqual(await extractText(f("a.txt", "  \n")), { ok: false, message: NO_TEXT_MESSAGE });
});

test("an oversize file is refused before reading", async () => {
  let read = false;
  const r = await extractText({ name: "a.txt", size: MAX_FILE_BYTES + 1, text: async () => ((read = true), "x") });
  assert.equal(r.ok, false);
  assert.equal(read, false);
});

test("an unsupported extension is refused", async () => {
  assert.equal((await extractText(f("a.exe", "x"))).ok, false);
});

test("pdf/docx are refused honestly until a parser lands", async () => {
  const r = await extractText(f("a.pdf", "x"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /not available/);
});
