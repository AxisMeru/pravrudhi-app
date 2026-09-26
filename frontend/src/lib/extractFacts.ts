// Client-side text extraction for the Matters page's PDF/DOCX upload (pravrudhi-app#5): turns an uploaded
// document into candidate facts, one per line -- the SAME shape the existing "Facts (one per line)" textarea
// already takes. No new engine endpoint and no new model call: the extracted text lands in that same
// editable textarea, reviewable and correctable before it ever reaches analyseFacts(), which still does
// exactly what it always did with a plain string[].
//
// Both libraries run entirely in the browser (this app is `output: "export"`, no server to extract on): pdfjs-
// dist for PDF text layers, mammoth for DOCX. A scanned/image-only PDF has no text layer to extract -- that is
// reported as an error to the caller, never silently returned as an empty fact list.

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return extractPdfText(file);
  if (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocxText(file);
  }
  throw new Error("Only .pdf and .docx files are supported.");
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Resolved as a static asset by Next.js's webpack build (new URL(..., import.meta.url)), never a network
  // fetch to a CDN -- this stays self-contained in the static export.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    pages.push(pageText);
  }
  const text = pages.join("\n\n").trim();
  if (!text) {
    throw new Error("No text could be extracted from this PDF -- it may be a scanned image with no text layer.");
  }
  return text;
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  const text = value.trim();
  if (!text) {
    throw new Error("No text could be extracted from this document.");
  }
  return text;
}

// Splits extracted document text into candidate one-per-line facts: paragraph breaks first, then sentence
// boundaries within a paragraph, then drops anything too short to be a meaningful fact (headers, page
// numbers, stray whitespace) -- a heuristic starting point for the user to review and edit, never assumed
// correct on its own.
export function segmentIntoFacts(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/);
  const sentences = paragraphs.flatMap((p) => p.replace(/\n/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9])/));
  return sentences.map((s) => s.trim()).filter((s) => s.length >= 15);
}
