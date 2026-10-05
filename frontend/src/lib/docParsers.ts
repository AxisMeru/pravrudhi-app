// In-browser PDF and DOCX text extraction for /matters. Nothing here touches the network: the file's bytes are
// parsed locally and only the extracted text (after the user reviews it) is ever sent anywhere. PDF parsing runs
// in pdf.js's own worker in the browser. No OCR: a scanned PDF yields no text and the caller says so.

import { checkDocxArchive, verifyDocxInflation } from "./docxArchive";
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

// Runs on the main thread only where there is no Worker (the node tests); the browser path is `parseDocxInWorker`.
export async function parseDocxDirect(data: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  // mammoth's node entry takes `buffer`, its browser entry (what the bundler picks) takes `arrayBuffer`.
  const input = typeof Buffer !== "undefined" ? { buffer: Buffer.from(data) } : { arrayBuffer: data };
  const { value } = await mammoth.extractRawText(input);
  return value;
}

export const DOCX_WORKER_TIMEOUT_MS = 20_000;

export interface DocxWorkerLike {
  onmessage: ((e: { data: { ok: boolean; text?: string } }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  postMessage(data: ArrayBuffer, transfer?: Transferable[]): void;
  terminate(): void;
}

function browserDocxWorker(): DocxWorkerLike {
  return new Worker(new URL("./docx.worker.ts", import.meta.url), { type: "module" }) as unknown as DocxWorkerLike;
}

// The archive is checked structurally first (no inflating), then parsed in a worker that is terminated after a
// deadline, so a zip bomb cannot freeze the page.
export function parseDocxInWorker(
  data: ArrayBuffer,
  create: () => DocxWorkerLike = browserDocxWorker,
  timeoutMs: number = DOCX_WORKER_TIMEOUT_MS,
): Promise<string> {
  checkDocxArchive(data);
  return new Promise<string>((resolve, reject) => {
    const worker = create();
    const done = (fn: () => void) => {
      clearTimeout(timer);
      worker.terminate();
      fn();
    };
    const timer = setTimeout(
      () => done(() => reject(new ExtractError("Reading this file took too long. Paste the facts as text instead."))),
      timeoutMs,
    );
    worker.onmessage = (e) =>
      done(() => (e.data.ok && typeof e.data.text === "string" ? resolve(e.data.text) : reject(new Error("unreadable docx"))));
    worker.onerror = () => done(() => reject(new Error("docx worker failed")));
    worker.postMessage(data, [data]);
  });
}

export async function parseDocx(data: ArrayBuffer): Promise<string> {
  if (typeof Worker === "undefined") {
    checkDocxArchive(data);
    await verifyDocxInflation(data);
    return parseDocxDirect(data);
  }
  return parseDocxInWorker(data);
}

export const browserParsers = { pdf: parsePdf, docx: parseDocx };
