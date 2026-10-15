// A minimal .docx (Word) writer for the screening memo (MVP: law firms work in Word). No dependency: a .docx is a ZIP of a few XML parts (the document, its styles and list numbering, and the
// document properties), written here in STORE mode (no compression), so the bytes are
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

/**
 * The memo emits bold in exactly one place: a label at the START of a line ("**Label**", then the rest). Only that leading span is bold; every other "*" in the line is the
 * submitter's own text and stays as typed, so the Word memo says exactly what the .md memo says ("a ** b", "the **price**" and the anonymisation mark "***" are not markup).
 */
function runsOf(s: string): Run[] {
  const lead = /^\*\*([^*]+)\*\*/.exec(s);
  if (!lead) return s.length > 0 ? [{ text: s, bold: false }] : [];
  const rest = s.slice(lead[0].length);
  return rest.length > 0 ? [{ text: lead[1], bold: true }, { text: rest, bold: false }] : [{ text: lead[1], bold: true }];
}

function run(r: Run): string {
  return `<w:r>${r.bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
}

/** A paragraph: a named style (the headings, the quote, the list) rather than direct formatting, so Word's navigation pane, outline and list tools work. */
function paragraph(runs: string, opts: { style?: string; list?: 0 | 1 } = {}): string {
  const style = opts.style ? `<w:pStyle w:val="${opts.style}"/>` : "";
  const num = opts.list === undefined ? "" : `<w:numPr><w:ilvl w:val="${opts.list}"/><w:numId w:val="1"/></w:numPr>`;
  const ppr = style || num ? `<w:pPr>${style}${num}</w:pPr>` : "";
  return `<w:p>${ppr}${runs}</w:p>`;
}

/** One markdown line of the memo's subset as a Word paragraph, or null for a blank line. */
export function paragraphOf(line: string): string | null {
  if (!line.trim()) return null;
  const h = /^(#{1,3}) (.*)$/.exec(line);
  if (h) return paragraph(runsOf(h[2]).map((r) => run(r)).join(""), { style: `Heading${h[1].length}` });
  const q = /^> (.*)$/.exec(line);
  if (q) return paragraph(runsOf(q[1]).map((r) => run(r)).join(""), { style: "Quote" });
  const b2 = /^ {2}- (.*)$/.exec(line);
  if (b2) return paragraph(runsOf(b2[1]).map((r) => run(r)).join(""), { style: "ListBullet", list: 1 });
  const b1 = /^- (.*)$/.exec(line);
  if (b1) return paragraph(runsOf(b1[1]).map((r) => run(r)).join(""), { style: "ListBullet", list: 0 });
  return paragraph(runsOf(line).map((r) => run(r)).join(""));
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const LANG = "en-IN";

const STYLES = `${XML}<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="${LANG}" w:eastAsia="${LANG}" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults>`
  + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
  + [[1, 36, 160], [2, 28, 160], [3, 24, 120]]
    .map(([n, sz, after]) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${n === 1 ? 0 : 200}" w:after="${after}"/><w:outlineLvl w:val="${Number(n) - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`)
    .join("")
  + `<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="360"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>`
  + `<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style></w:styles>`;

// One bullet list, two levels (the memo's "- " and "  - " lines), as real Word list numbering rather than typed bullet characters.
const NUMBERING = `${XML}<w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>`
  + `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="280"/></w:pPr></w:lvl>`
  + `<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u25e6"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1080" w:hanging="280"/></w:pPr></w:lvl>`
  + `</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

const DOC_RELS = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;

const APP_PROPS = `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Pravrudhi-Nyaya</Application></Properties>`;

/** The document title: the memo's first heading (its text, without the markup), else "Screening memo". Not a timestamp: the same memo gives the same bytes. */
function titleOf(markdown: string): string {
  const h = /^# (.*)$/m.exec(markdown);
  return (h ? h[1].replace(/\*\*/g, "").trim() : "") || "Screening memo";
}

/** The .docx bytes for a markdown memo (the subset above). Same input, same bytes. */
export function buildDocx(markdown: string): Uint8Array {
  const body = markdown.split(/\r?\n/).map(paragraphOf).filter((p): p is string => p !== null).join("");
  const doc = `${XML}<w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const types = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`
    + `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`
    + `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>`
    + `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`
    + `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const core = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(titleOf(markdown))}</dc:title><dc:language>${LANG}</dc:language></cp:coreProperties>`;
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(types) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "word/document.xml", data: enc.encode(doc) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(DOC_RELS) },
    { name: "word/styles.xml", data: enc.encode(STYLES) },
    { name: "word/numbering.xml", data: enc.encode(NUMBERING) },
    { name: "docProps/core.xml", data: enc.encode(core) },
    { name: "docProps/app.xml", data: enc.encode(APP_PROPS) },
  ]);
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
