import assert from "node:assert/strict";
import test from "node:test";
import { parseDocx, parsePdf } from "./docParsers";
import { buildDocx, buildPdf } from "./docFixtures";
import { ExtractError, MAX_PDF_PAGES } from "./factsInput";

const loadLegacy = () => import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as ReturnType<Parameters<typeof parsePdf>[1] & (() => never)>;


test("a pdf's text is extracted, page by page", async () => {
  const text = await parsePdf(buildPdf(["Lata met Kiran.", "Kiran left."]), loadLegacy);
  assert.match(text, /Lata met Kiran\./);
  assert.match(text, /Kiran left\./);
});

test("a pdf over the page limit is refused with the limit named", async () => {
  const pages = Array.from({ length: MAX_PDF_PAGES + 1 }, (_, i) => `p${i}`);
  await assert.rejects(parsePdf(buildPdf(pages), loadLegacy), (e: unknown) => e instanceof ExtractError && /limit is 50/.test(e.message));
});

test("bytes that are not a pdf throw rather than returning empty text", async () => {
  await assert.rejects(parsePdf(new TextEncoder().encode("not a pdf at all").buffer as ArrayBuffer, loadLegacy));
});

test("a docx's paragraphs are extracted", async () => {
  const text = await parseDocx(buildDocx(["Lata met Kiran.", "Kiran left."]));
  assert.match(text, /Lata met Kiran\./);
  assert.match(text, /Kiran left\./);
});

test("bytes that are not a docx throw rather than returning empty text", async () => {
  await assert.rejects(parseDocx(new TextEncoder().encode("not a zip").buffer as ArrayBuffer));
});
