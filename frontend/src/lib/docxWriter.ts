// A minimal .docx (Word) writer for the screening memo (MVP: law firms work in Word). No dependency: a .docx is a ZIP of three XML parts, written here in STORE mode (no compression), so the bytes are
// deterministic and nothing is inflated on the way back in. The content is NOT built separately: the document is made FROM THE MARKDOWN MEMO (lib/screening/memo.ts), reading the small subset of
// markdown that memo uses (# ## ### headings, > quotes, - bullets one level deep, **bold**), so the Word memo says exactly what the .md memo says: the same facts, banner, review items and versions.

const enc = new TextEncoder();

// ---- ZIP (store) -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const DOS_TIME = 0x0000;
const DOS_DATE = 0x0021; // 1980-01-01: a fixed stamp, so the same memo always gives the same bytes

export function zipStore(files: ReadonlyArray<{ name: string; data: Uint8Array }>): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, DOS_TIME, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    const head = new Uint8Array(local.buffer);
    parts.push(head, name, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, DOS_TIME, true);
    c.setUint16(14, DOS_DATE, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, f.data.length, true);
    c.setUint32(24, f.data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += head.length + name.length + f.data.length;
  }
  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(eocd.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ---- the document ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const esc = (s: string): string =>
  // control characters are not allowed in XML 1.0; the five markup characters are escaped
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

interface Run {
  text: string;
  bold: boolean;
}

/** Split a line on ** into alternating plain and bold runs. */
function runsOf(s: string): Run[] {
  return s.split("**").map((text, i) => ({ text, bold: i % 2 === 1 })).filter((r) => r.text.length > 0);
}

function run(r: Run, size?: number, italic = false): string {
  const props = `${r.bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}${size ? `<w:sz w:val="${size}"/>` : ""}`;
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
}

function paragraph(runs: string, opts: { indent?: number; hanging?: number; spaceAfter?: number } = {}): string {
  const ind = opts.indent ? `<w:ind w:left="${opts.indent}"${opts.hanging ? ` w:hanging="${opts.hanging}"` : ""}/>` : "";
  return `<w:p><w:pPr><w:spacing w:after="${opts.spaceAfter ?? 120}"/>${ind}</w:pPr>${runs}</w:p>`;
}

const HEADING_SIZE: Record<number, number> = { 1: 36, 2: 28, 3: 24 };

/** One markdown line of the memo's subset as a Word paragraph, or null for a blank line. */
export function paragraphOf(line: string): string | null {
  if (!line.trim()) return null;
  const h = /^(#{1,3}) (.*)$/.exec(line);
  if (h) return paragraph(runsOf(h[2]).map((r) => run({ ...r, bold: true }, HEADING_SIZE[h[1].length])).join(""), { spaceAfter: 160 });
  const q = /^> (.*)$/.exec(line);
  if (q) return paragraph(runsOf(q[1]).map((r) => run(r, undefined, true)).join(""), { indent: 360 });
  const b2 = /^ {2}- (.*)$/.exec(line);
  if (b2) return paragraph("<w:r><w:t xml:space=\"preserve\">◦ </w:t></w:r>" + runsOf(b2[1]).map((r) => run(r)).join(""), { indent: 1080, hanging: 280, spaceAfter: 60 });
  const b1 = /^- (.*)$/.exec(line);
  if (b1) return paragraph("<w:r><w:t xml:space=\"preserve\">• </w:t></w:r>" + runsOf(b1[1]).map((r) => run(r)).join(""), { indent: 720, hanging: 280, spaceAfter: 60 });
  return paragraph(runsOf(line).map((r) => run(r)).join(""));
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** The .docx bytes for a markdown memo (the subset above). Same input, same bytes. */
export function buildDocx(markdown: string): Uint8Array {
  const body = markdown.split(/\r?\n/).map(paragraphOf).filter((p): p is string => p !== null).join("");
  const doc = `${XML}<w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const types = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(types) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "word/document.xml", data: enc.encode(doc) },
  ]);
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
