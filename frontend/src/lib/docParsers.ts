// In-browser PDF and DOCX text extraction for /matters. Nothing here touches the network: the file's bytes are
// parsed locally and only the extracted text (after the user reviews it) is ever sent anywhere. PDF parsing runs
// in pdf.js's own worker in the browser. No OCR: a scanned PDF yields no text and the caller says so.

import { ExtractError, MAX_PDF_PAGES } from "./factsInput";

type PdfJs = typeof import("pdfjs-dist");

async function loadPdfjsBrowser(): Promise<PdfJs> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

export async function parsePdf(data: ArrayBuffer, load: () => Promise<PdfJs> = loadPdfjsBrowser): Promise<string> {
  const pdfjs = await load();
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  try {
    if (doc.numPages > MAX_PDF_PAGES) {
      throw new ExtractError(`This PDF has ${doc.numPages} pages; the limit is ${MAX_PDF_PAGES}.`);
    }
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let out = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        out += item.str + (item.hasEOL ? "\n" : " ");
      }
      pages.push(out);
    }
    return pages.join("\n");
  } finally {
    await task.destroy();
  }
}

export async function parseDocx(data: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  // mammoth's node entry takes `buffer`, its browser entry (what the bundler picks) takes `arrayBuffer`.
  const input = typeof Buffer !== "undefined" ? { buffer: Buffer.from(data) } : { arrayBuffer: data };
  const { value } = await mammoth.extractRawText(input);
  return value;
}

export const browserParsers = { pdf: parsePdf, docx: parseDocx };
