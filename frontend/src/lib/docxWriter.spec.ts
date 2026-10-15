import assert from "node:assert/strict";
import test from "node:test";

import mammoth from "mammoth";

import type { AnalyseFactsContract, AnalyseFactsElement, AnalyseFactsResult } from "./api";
import contractElements from "./fixtures/contractElements.json";
import { checkDocxArchive, readEntries, verifyDocxInflation } from "./docxArchive";
import { buildDocx, crc32, paragraphOf } from "./docxWriter";
import { buildScreeningMemo, buildScreeningMemoDocx } from "./screening/memo";

const ab = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
const text = async (u: Uint8Array): Promise<string> => (await mammoth.extractRawText({ buffer: Buffer.from(u) })).value;
/** The visible text of one memo markdown line (markup removed; bullets are real Word list numbering, so the raw text carries no bullet character). */
const plain = (md: string): string[] =>
  md.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.replace(/^#{1,3} /, "").replace(/^> /, "").replace(/^ {2}- /, "").replace(/^- /, "").replace(/\*\*/g, ""));

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("the .docx is a readable archive by the app's own checks, with exactly its eight parts, and the same input gives the same bytes", async () => {
  const bytes = buildDocx("# Title\n\n- **A**: b\n");
  checkDocxArchive(ab(bytes));
  await verifyDocxInflation(ab(bytes));
  assert.deepEqual(readEntries(ab(bytes)).map((e) => e.name), ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/_rels/document.xml.rels", "word/styles.xml", "word/numbering.xml", "docProps/core.xml", "docProps/app.xml"]);
  assert.deepEqual(buildDocx("# Title\n\n- **A**: b\n"), bytes);
  assert.notDeepEqual(buildDocx("# Other\n"), bytes);
});

test("Word reads it back: headings, quotes, bullets and bold text, with markup characters and control characters handled", async () => {
  const md = ["# Screening memo", "", "> A quote & a <tag> \"x\" 'y'", "", "- **Supported by a fact**: the ingredient", "  - F1: a fact with \u0001 a control character", "**Label** end"].join("\n");
  const back = (await text(buildDocx(md))).split("\n").filter((l) => l.trim());
  assert.deepEqual(back, ["Screening memo", "A quote & a <tag> \"x\" 'y'", "Supported by a fact: the ingredient", "F1: a fact with  a control character", "Label end"]);
});

test("blank lines make no paragraph; an unknown line is plain text", () => {
  assert.equal(paragraphOf(""), null);
  assert.equal(paragraphOf("   "), null);
  assert.match(paragraphOf("just a line") ?? "", /<w:t xml:space="preserve">just a line<\/w:t>/);
});

// A full screening memo: the Word memo carries EXACTLY the markdown memo's text, line for line (no new claim, the same fact refs and banner).
const FACTS: AnalyseFactsResult["facts"] = [
  { id: "F1", text: "Invented: Ravi told Meena the toy lorry was his & sold it to her for <500>.", sha256: "a".repeat(64) },
  { id: "F2", text: "Invented: Meena paid Ravi 500 in cash on the same day.", sha256: "b".repeat(64) },
];
const CID = "ipc415_property";
const ELS = contractElements.contracts[CID].elements;
const el = (i: number, over: Partial<AnalyseFactsElement> = {}): AnalyseFactsElement =>
  ({ element: ELS[i], is_denial: false, status: "established", claimed: true, p_established: 0.9, p_established_second: 0.8, fact_id: `F${(i % 2) + 1}`, quote: null, start: null, end: null, quote_check: null, attempts: 1, occurrences: 1, offsets_source: null, quote_source: "whole_fact", error: null, ...over }) as AnalyseFactsElement;
const RESULT = {
  run_id: "r-invented-docx", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", facts: FACTS,
  contracts: [{ contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", elements: [el(0), el(1, { status: "not_established" }), el(2, { status: "not_confirmed" })], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null } as AnalyseFactsContract],
} as AnalyseFactsResult;
const OPTS = { engineVersion: "0.6.3", generatedAt: "2026-10-14T00:00:00Z" };

test("the screening memo as .docx says exactly what the .md memo says, line for line", async () => {
  const md = buildScreeningMemo(RESULT, OPTS);
  const docx = buildScreeningMemoDocx(RESULT, OPTS);
  checkDocxArchive(ab(docx));
  const back = (await text(docx)).split("\n").filter((l) => l.trim());
  assert.deepEqual(back, plain(md));
  assert.ok(back.some((l) => l.includes("Invented: Ravi told Meena the toy lorry was his & sold it to her for <500>.")), "fact text kept whole, markup characters intact");
  assert.ok(back.some((l) => /ingredients supported by a fact/.test(l)) && back.some((l) => l.includes("This is a screening aid, not legal advice")), "banner and the standing line");
});

const RESULT_WITH_STARS = {
  ...RESULT,
  facts: [
    { id: "F1", text: "Mr. *** told ***", sha256: "a".repeat(64) },
    { id: "F2", text: "a ** b", sha256: "b".repeat(64) },
    { id: "F3", text: "the **price** was paid", sha256: "c".repeat(64) },
  ],
} as AnalyseFactsResult;

// R2, 14 Oct: the submitter's own asterisks are text, not markup. Compared against the memo's INTENDED bold spans only (the leading label), never a blanket "**" strip.
test("a fact's own asterisks reach the Word memo exactly as in the .md memo; only the memo's leading label is bold", async () => {
  const md = buildScreeningMemo(RESULT_WITH_STARS, OPTS);
  const docx = buildScreeningMemoDocx(RESULT_WITH_STARS, OPTS);
  const back = (await text(docx)).split("\n").filter((l) => l.trim());
  const intended = md.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.replace(/^#{1,3} /, "").replace(/^> /, "").replace(/^ {2}- /, "").replace(/^(- )?\*\*([^*]+)\*\*/, (_m, b: string | undefined, label: string) => `${label}`).replace(/^- /, ""));
  assert.deepEqual(back, intended);
  for (const s of ["Mr. *** told ***", "a ** b", "the **price**"]) assert.ok(back.some((l) => l.includes(s)), s);
});

// R4 (explorer result review, 15 Oct): a navigable, accessible Word file: heading styles, real list numbering, a document language and title, and the styles/properties parts.
test("the .docx has heading styles, real bullets, en-IN as the document language and a title", () => {
  const bytes = buildDocx("# Screening memo\n\n## Offence\n\n### Ingredients\n\n> a quote\n\n- **A**: b\n  - c\n\nplain\n");
  // the writer stores every part uncompressed: read the local headers in order
  const parts: Record<string, string> = {};
  const buf = Buffer.from(bytes);
  for (let at = 0; at + 30 < buf.length && buf.readUInt32LE(at) === 0x04034b50; ) {
    const size = buf.readUInt32LE(at + 18), nlen = buf.readUInt16LE(at + 26), xlen = buf.readUInt16LE(at + 28);
    const start = at + 30 + nlen + xlen;
    parts[buf.subarray(at + 30, at + 30 + nlen).toString("utf8")] = buf.subarray(start, start + size).toString("utf8");
    at = start + size;
  }
  const doc = parts["word/document.xml"];
  assert.match(doc, /<w:pStyle w:val="Heading1"\/>/);
  assert.match(doc, /<w:pStyle w:val="Heading2"\/>/);
  assert.match(doc, /<w:pStyle w:val="Heading3"\/>/);
  assert.match(doc, /<w:pStyle w:val="Quote"\/>/);
  assert.equal((doc.match(/<w:numPr><w:ilvl w:val="0"\/><w:numId w:val="1"\/><\/w:numPr>/g) ?? []).length, 1, "one top-level list item");
  assert.equal((doc.match(/<w:numPr><w:ilvl w:val="1"\/><w:numId w:val="1"\/><\/w:numPr>/g) ?? []).length, 1, "one second-level list item");
  assert.doesNotMatch(doc, /\u2022|\u25e6/, "no typed bullet characters");
  assert.match(parts["word/styles.xml"], /w:styleId="Heading1"/);
  assert.match(parts["word/styles.xml"], /<w:lang w:val="en-IN"/);
  assert.match(parts["word/numbering.xml"], /<w:numFmt w:val="bullet"\/>/);
  assert.match(parts["docProps/core.xml"], /<dc:title>Screening memo<\/dc:title>/);
  assert.match(parts["docProps/core.xml"], /<dc:language>en-IN<\/dc:language>/);
});
