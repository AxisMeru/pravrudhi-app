import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkFacts,
  ExtractError,
  extractText,
  MAX_FACTS,
  MAX_FACT_CHARS,
  MAX_FILE_BYTES,
  NO_TEXT_MESSAGE,
  UNREADABLE_MESSAGE,
} from "./factsInput";

const f = (name: string, body: string, size = body.length) => ({
  name,
  size,
  text: async () => body,
  arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
});

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
  const r = await extractText({
    ...f("a.txt", "x"),
    size: MAX_FILE_BYTES + 1,
    text: async () => ((read = true), "x"),
  });
  assert.equal(r.ok, false);
  assert.equal(read, false);
});

test("an unsupported extension is refused", async () => {
  assert.equal((await extractText(f("a.exe", "x"))).ok, false);
});

test("pdf/docx with no parser wired are refused honestly", async () => {
  const r = await extractText(f("a.pdf", "x"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /not available/);
});

test("a pdf is parsed with the supplied parser", async () => {
  const r = await extractText(f("a.pdf", "x"), { pdf: async () => "  Fact from pdf.  " });
  assert.deepEqual(r, { ok: true, text: "Fact from pdf." });
});

test("a docx is parsed with the supplied parser", async () => {
  const r = await extractText(f("a.DOCX", "x"), { docx: async () => "Fact from docx." });
  assert.deepEqual(r, { ok: true, text: "Fact from docx." });
});

test("a parser that throws is an unreadable-file error, never empty text", async () => {
  const r = await extractText(f("a.pdf", "x"), {
    pdf: async () => {
      throw new Error("InvalidPDFException");
    },
  });
  assert.deepEqual(r, { ok: false, message: UNREADABLE_MESSAGE });
});

test("an ExtractError message reaches the user", async () => {
  const r = await extractText(f("a.pdf", "x"), {
    pdf: async () => {
      throw new ExtractError("This PDF has 80 pages; the limit is 50.");
    },
  });
  assert.deepEqual(r, { ok: false, message: "This PDF has 80 pages; the limit is 50." });
});

test("a parse that never finishes times out with a message", async () => {
  const r = await extractText(f("a.pdf", "x"), { pdf: () => new Promise<string>(() => {}) }, 20);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /took too long/);
});

test("a parsed document with no text is the no-text message, not facts", async () => {
  const r = await extractText(f("a.pdf", "x"), { pdf: async () => " \n " });
  assert.deepEqual(r, { ok: false, message: NO_TEXT_MESSAGE });
});

test("an oversize pdf is refused before any parser runs", async () => {
  let ran = false;
  const r = await extractText({ ...f("a.pdf", "x"), size: MAX_FILE_BYTES + 1 }, { pdf: async () => ((ran = true), "x") });
  assert.equal(r.ok, false);
  assert.equal(ran, false);
});
