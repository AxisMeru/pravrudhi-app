import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import test from "node:test";
import { parseDocx, parsePdf } from "./docParsers";
import { ExtractError, MAX_PDF_PAGES } from "./factsInput";

// Constructed fixtures only: a hand-built PDF and a hand-built (stored, uncompressed) DOCX zip.
const loadLegacy = () => import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as ReturnType<Parameters<typeof parsePdf>[1] & (() => never)>;

function buildPdf(pages: string[]): ArrayBuffer {
  const objs: string[] = [];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((text, i) => {
    const stream = `BT /F1 12 Tf 10 100 Td (${text}) Tj ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out).buffer as ArrayBuffer;
}

function buildDocx(paragraphs: string[]): ArrayBuffer {
  const files: Record<string, string> = {
    "[Content_Types].xml":
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
      .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
      .join("")}</w:body></w:document>`,
  };
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (n: number) => [n & 255, (n >> 8) & 255];
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const [name, body] of Object.entries(files)) {
    const nb = enc.encode(name);
    const db = enc.encode(body);
    const crc = crc32(db);
    const local = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0), ...nb, ...db]);
    central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nb]));
    chunks.push(local);
    offset += local.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const all = [...chunks, ...central, end];
  const buf = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
  let p = 0;
  for (const c of all) {
    buf.set(c, p);
    p += c.length;
  }
  return buf.buffer as ArrayBuffer;
}

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
