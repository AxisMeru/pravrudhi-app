import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { IMAGES_ACCEPTED, SCAN_ACCEPT, SCAN_TEXT, keptByName, mimeOfFile, docNameOf, repairedLine, rowScan, scanRefusalLine, scanBody, MAX_SCAN_BYTES, canDrawImage, cropRect, documentLine, pageLines, parseCrop, parseScanIngest } from "./scannedIntake";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);

test("R1's OCR words are exactly hers, by hash (OCR_LIMITS_V2 3d1f0ef19f36)", () => {
  assert.equal(h(SCAN_TEXT.unreadablePage), "27d902d9a913ef3a");
  assert.equal(h(SCAN_TEXT.ocrLine), "b2497ad790916492");
  assert.equal(h(SCAN_TEXT.dateLine), "02dcab75a2b5c7d4");
  assert.equal(h(SCAN_TEXT.low_confidence), "c83d9723e60da83d");
  assert.equal(h(SCAN_TEXT.timeout), "4f3bc8352bdb2893");
  assert.equal(h(SCAN_TEXT.language_not_supported), "6ceb2553c4ccbae1");
  assert.equal(h(SCAN_TEXT.ocr_unavailable), "1b75b9fead542580");
  assert.equal(h(SCAN_TEXT.repairedPage), "6d58ad2bbb36f4d0", "R1 20 Oct: the narrower repaired-page line");
  assert.equal(h(SCAN_TEXT.page_limit), "940c7c869c69f005");
  assert.equal(h(SCAN_TEXT.photoRefused), "b7857975b161bd99");
  assert.doesNotMatch(Object.values(SCAN_TEXT).join(" "), /garbled|scans?\b|\d+ ?%|accura/i, "R1 v3: no garbled, no scans, no figures");
  assert.equal(h(SCAN_TEXT.cropCaption), "88826b4533d074a7");
  assert.equal(h(SCAN_TEXT.heicRefused), "6e81ca38216b082b");
  assert.equal(h(SCAN_TEXT.tooLarge), "9d84711266c2da06");
  assert.equal(documentLine(2), "2 page(s) could not be read, so this paper is only partly searched.");
  assert.equal(h(documentLine(2).replace("2 ", "{n} ")), "e012b937c611ed63");
});

const body = { doc_id: "d", indexed_complete: false, pages_unreadable: 1, ocr_line: "engine line", pages: [
  { page: 1, source: "text_layer", confidence: null, readable: true, reason: null, line: null },
  { page: 2, source: "ocr", confidence: 91.4, readable: true, reason: null, line: null },
  { page: 3, source: "unreadable", confidence: 41, readable: false, reason: "low_confidence", line: "This page could not be read." },
  { page: "x", source: "ocr" }, { page: 5, source: "magic", readable: true },
] };

test("ingest pages: an unreadable page gets the engine's line and R1's reason line, readable pages say nothing, a malformed page is dropped, confidence never reaches the view", () => {
  const v = parseScanIngest(body)!;
  assert.deepEqual(v.pages.map((p) => p.page), [1, 2, 3]);
  assert.equal(v.indexedComplete, false);
  assert.equal(v.pagesUnreadable, 1);
  assert.deepEqual(pageLines(v.pages[0]), []);
  assert.deepEqual(pageLines(v.pages[1]), []);
  assert.deepEqual(pageLines(v.pages[2]), ["This page could not be read.", "This page could not be read well enough."]);
  assert.doesNotMatch(JSON.stringify(v), /91\.4|"confidence"|\b41\b/);
  assert.equal(parseScanIngest(null), null);
  assert.equal(parseScanIngest({ doc_id: "d" }), null);
});

test("an unreadable page whose engine line is missing still says R1's exact line; an unknown reason adds no line of ours", () => {
  const v = parseScanIngest({ pages: [{ page: 1, source: "unreadable", readable: false, reason: "future_reason", line: null }] })!;
  assert.deepEqual(pageLines(v.pages[0]), ["This page could not be read."]);
  const t = parseScanIngest({ pages: [{ page: 1, source: "unreadable", readable: false, reason: "timeout", line: null }] })!;
  assert.deepEqual(pageLines(t.pages[0]), ["This page could not be read.", "This page took too long to read."]);
  const L = parseScanIngest({ pages: [{ page: 7, source: "unreadable", readable: false, reason: "page_limit", line: null }] })!;
  assert.deepEqual(pageLines(L.pages[0]), ["This page could not be read.", "This page was not read because the paper has more pages than the tool reads at once."], "an over-cap page has its own reason line, never the timeout line");
});

test("a page marked readable:false is never treated as readable, whatever its source", () => {
  const v = parseScanIngest({ pages: [{ page: 1, source: "ocr", readable: false, reason: "low_confidence", line: null }] })!;
  assert.equal(v.pages[0].readable, false);
  assert.equal(v.pagesUnreadable, 1);
});

test("crop boxes: a valid box scales to an image of the same page at any resolution; a bad box is no crop", () => {
  const c = parseCrop({ page: 3, x: 112, y: 840, w: 1280, h: 96, page_w: 2480, page_h: 3508, unit: "px at ocr_dpi" })!;
  assert.deepEqual(cropRect(c, 2480, 3508), { sx: 112, sy: 840, sw: 1280, sh: 96 });
  assert.deepEqual(cropRect(c, 1240, 1754), { sx: 56, sy: 420, sw: 640, sh: 48 });
  assert.equal(parseCrop(null), null);
  assert.equal(parseCrop({ page: 1, x: 0, y: 0, w: 0, h: 5, page_w: 10, page_h: 10 }), null);
  assert.equal(parseCrop({ page: 1, x: 8, y: 0, w: 5, h: 5, page_w: 10, page_h: 10 }), null);
  assert.equal(parseCrop({ page: 1, x: "1", y: 0, w: 5, h: 5, page_w: 10, page_h: 10 }), null);
});

test("only png and jpeg are drawn in the browser; PDF, TIFF and HEIC fall back to the quote with its page number", () => {
  for (const m of ["image/png", "image/jpeg", "image/jpg"]) assert.equal(canDrawImage(m), true, m);
  for (const m of ["application/pdf", "image/tiff", "image/heic", "image/svg+xml", ""]) assert.equal(canDrawImage(m), false, m);
});

test("the documents request carries exactly one of pdf_base64 or image_base64 (+ mime), never text, and refuses over the cap or an unknown type before sending", () => {
  const M = "0123456789abcdef0123456789abcdef";
  assert.deepEqual(scanBody(M, " FIR ", "application/pdf", 10, "QQ==" ), { ok: true, body: { matter_id: M, name: "FIR", pdf_base64: "QQ==" } });
  assert.deepEqual(scanBody(M, "", "image/png", 10, "QQ==", true), { ok: true, body: { matter_id: M, name: "paper", image_base64: "QQ==", mime: "image/png" } });
  assert.deepEqual(scanBody(M, "a", "image/tiff", 10, "QQ==", true), { ok: true, body: { matter_id: M, name: "a", image_base64: "QQ==", mime: "image/tiff" } });
  assert.deepEqual(scanBody(M, "a", "image/png", MAX_SCAN_BYTES + 1, "QQ=="), { ok: false, reason: "too_big" });
  assert.deepEqual(scanBody(M, "a", "image/heic", 10, "QQ==", true), { ok: false, reason: "heic" });
  assert.deepEqual(scanBody(M, "a", "image/heif", 10, "QQ==", true), { ok: false, reason: "heic" });
  assert.deepEqual(scanBody(M, "a", "image/webp", 10, "QQ==", true), { ok: false, reason: "type" });
  const r = scanBody(M, "a", "application/pdf", 10, "QQ==");
  assert.ok(r.ok && !("text" in r.body) && !("image_base64" in r.body));
});

test("refusal lines: a photo (HEIC by mime, or the engine's image refusal codes) says R1's photo line while photos are refused, and any over-size answer (413 / pdf_too_large / over the cap) says R1's line, never the engine's PDF/bytes text; other refusals are not ours", () => {
  const M = "0123456789abcdef0123456789abcdef";
  assert.equal(IMAGES_ACCEPTED, process.env.NEXT_PUBLIC_SCANNED_IMAGES === "1", "photos are on only with the build env set for PR 3");
  for (const m of ["image/png", "image/jpeg", "image/tiff", "image/heic", "image/heif"]) assert.deepEqual(scanBody(M, "a", m, 10, "QQ==", false), { ok: false, reason: "photo" }, `${m}: refused before reading while the engine refuses photos`);
  assert.equal(scanRefusalLine("photo", null, null), SCAN_TEXT.photoRefused);
  assert.deepEqual(scanBody(M, "a", "application/pdf", 10, "QQ==", false), { ok: true, body: { matter_id: M, name: "a", pdf_base64: "QQ==" } }, "a PDF still goes");
  assert.equal(scanRefusalLine("heic", null, null), IMAGES_ACCEPTED ? SCAN_TEXT.heicRefused : SCAN_TEXT.photoRefused, "no HEIC line while photos are refused");
  for (const code of ["image_not_supported_yet", "image_not_enabled"]) {
    assert.equal(scanRefusalLine(null, 422, { error: code }), SCAN_TEXT.photoRefused, code);
    assert.equal(scanRefusalLine(null, 422, { code }), SCAN_TEXT.photoRefused, code);
  }
  assert.doesNotMatch(Object.values(SCAN_TEXT).filter((x) => x !== SCAN_TEXT.heicRefused).join(" "), /JPEG or PNG/, "the save-as line appears nowhere else");
  assert.equal(SCAN_ACCEPT.includes("image/"), IMAGES_ACCEPTED, "the control offers PDFs only while photos are refused");
  assert.equal(scanRefusalLine("too_big", null, null), SCAN_TEXT.tooLarge);
  assert.equal(scanRefusalLine(null, 413, { detail: "The PDF is larger than 8000000 bytes" }), SCAN_TEXT.tooLarge);
  assert.equal(scanRefusalLine(null, 422, { error: "pdf_too_large" }), SCAN_TEXT.tooLarge);
  assert.doesNotMatch(SCAN_TEXT.tooLarge, /PDF|bytes|\d{6}/);
  assert.equal(scanRefusalLine(null, 503, { error: "ocr_unavailable" }), null);
  assert.equal(scanRefusalLine("type", null, null), null);
});

const SAMPLE = {
  results: [{ span_id: 41, doc_id: "d", page: 3, text: "The petitioner states that the cheque dated 2 February 2021 was returned unpaid.", read_from: "ocr", confidence: 91.4, crop: { page: 3, x: 112, y: 840, w: 1280, h: 96, page_w: 2480, page_h: 3508, unit: "px at ocr_dpi" } }, { span_id: 12, doc_id: "d", page: 1, text: "IN THE COURT", read_from: "text_layer", confidence: null, crop: null }],
  pages: [{ page: 1, source: "text_layer", confidence: null, readable: true, reason: null, line: null }, { page: 2, source: "ocr", confidence: 88, readable: true, reason: null, line: null, repaired: true }, { page: 4, source: "unreadable", confidence: 52.3, readable: false, reason: "low_confidence", line: "This page could not be read." }],
  pages_unreadable: 1,
};

test("Track C's sample: the garbled-layer page says R1's repaired line, the unreadable page says it could not be read and shows no text, the text-layer page says nothing", () => {
  const v = parseScanIngest(SAMPLE)!;
  assert.deepEqual(v.pages.map((p) => [p.page, p.repaired]), [[1, false], [2, true], [4, false]]);
  assert.equal(repairedLine(v.pages[1]), SCAN_TEXT.repairedPage);
  assert.equal(repairedLine(v.pages[0]), null);
  assert.equal(repairedLine(v.pages[2]), null);
  assert.deepEqual(pageLines(v.pages[2]), ["This page could not be read.", "This page could not be read well enough."]);
  assert.equal(v.pagesUnreadable, 1);
});

test("a repaired flag on an unreadable page is never honoured (nothing was read)", () => {
  const v = parseScanIngest({ pages: [{ page: 1, source: "unreadable", readable: false, reason: "low_confidence", line: null, repaired: true }] })!;
  assert.equal(v.pages[0].repaired, false);
});

test("rows from the sample: an OCR quote carries its crop, the doc name and the date line; a text-layer quote carries nothing; flag OFF carries nothing at all", () => {
  const [ocr, text] = SAMPLE.results as unknown as Record<string, unknown>[];
  const on = rowScan(ocr, "defence-note", true)!;
  assert.deepEqual(on.crop && [on.crop.page, on.crop.pageW], [3, 2480]);
  assert.equal(on.docName, "defence-note");
  assert.equal(on.fromOcr, true);
  assert.equal(rowScan(text, "FIR", true), undefined);
  assert.equal(rowScan(ocr, "x", false), undefined);
  assert.deepEqual(rowScan({ from_ocr: true }, "d", true), { docName: "d", crop: null, fromOcr: true });
});

test("the paper name behind a 'name p. N' source string", () => {
  assert.equal(docNameOf("courier-note-B p.1"), "courier-note-B");
  assert.equal(docNameOf("defence note, p. 12"), "defence note");
  assert.equal(docNameOf("FIR"), "FIR");
  assert.equal(docNameOf(null), null);
});

test("the repaired line follows pages[].repaired only: the engine's retired internal field alone shows nothing, a repaired readable ocr page shows R1's line, a text-layer page marked repaired shows nothing", () => {
  const v = parseScanIngest({ pages: [
    { page: 1, source: "ocr", readable: true, reason: null, line: null, garbled_text_layer: true },
    { page: 2, source: "ocr", readable: true, reason: null, line: null, repaired: true },
    { page: 3, source: "text_layer", readable: true, reason: null, line: null, repaired: true },
  ] })!;
  assert.deepEqual(v.pages.map((p) => repairedLine(p)), [null, SCAN_TEXT.repairedPage, null]);
});

test("kept uploads are found by paper name only through the engine's doc_id, and never for a name two papers share (R2: never another file's crop)", () => {
  const a = new File(["a"], "a.png", { type: "image/png" }), b = new File(["b"], "b.png", { type: "image/png" });
  const kept = new Map([["d1", a], ["d2", b]]);
  const m = keptByName([{ docId: "d1", name: "scan.png" }, { docId: "d2", name: "other.png" }], kept);
  assert.equal(m.get("scan.png"), a);
  assert.equal(m.get("other.png"), b);
  const dup = keptByName([{ docId: "d1", name: "scan.png" }, { docId: "d2", name: "scan.png" }], kept);
  assert.equal(dup.size, 0, "two papers with one name: no crop at all");
  const gone = keptByName([{ docId: "d9", name: "scan.png" }], kept);
  assert.equal(gone.size, 0, "a paper whose doc_id has no kept file shows no crop");
  assert.equal(keptByName([], kept).size, 0);
});

test("the mime type falls back to the extension when the browser gives none", () => {
  assert.equal(mimeOfFile("A.PNG", ""), "image/png");
  assert.equal(mimeOfFile("scan.jpeg", ""), "image/jpeg");
  assert.equal(mimeOfFile("x.TIF", ""), "image/tiff");
  assert.equal(mimeOfFile("x.heic", ""), "image/heic");
  assert.equal(mimeOfFile("file.pdf", ""), "application/pdf");
  assert.equal(mimeOfFile("x.png", "image/jpeg"), "image/jpeg", "the browser's type wins when it gives one");
  assert.equal(mimeOfFile("noext", ""), "");
});

test("a row's own `source` key (document and page text) is never read as the way it was read: only read_from, crop and from_ocr decide", () => {
  assert.equal(rowScan({ source: "ocr" }, "d", true), undefined);
  assert.equal(rowScan({ source: "courier-note-B p.1" }, "courier-note-B", true), undefined);
  assert.deepEqual(rowScan({ source: "courier-note-B p.1", read_from: "ocr" }, "courier-note-B", true), { docName: "courier-note-B", crop: null, fromOcr: true });
  assert.equal(rowScan({ source: "x", read_from: "text_layer" }, "d", true), undefined);
});
