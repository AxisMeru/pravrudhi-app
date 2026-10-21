// "Scanned papers in" (prabhasa-nyaya#1015, app part), OFF by default: NEXT_PUBLIC_SCANNED_INTAKE=1 (exactly "1") AND the engine flag wf_c1_scanned_intake.
// Contract: Track C's OCR_INTAKE_DESIGN_NOTE_2026-10-19.md (sha12 1e3491dc9087). Words: R1's OCR_LIMITS_V3_R1_2026-10-19.md (sha12 1323a7d5d2eb, which replaces two V2 lines) and OCR_UPLOAD_LINES_R1_2026-10-19.md (sha12 ee4baa2862f7), pinned by hash in scannedIntake.spec.ts.
// Nothing here guesses text: an unreadable page contributes no text and no date, and the crop is drawn only from the user's own kept upload (the engine stores no page image).
export const SCANNED_INTAKE = process.env.NEXT_PUBLIC_SCANNED_INTAKE === "1";

/**
 * Does the engine accept photos (PNG/JPEG/TIFF) yet? NOT while it answers image_not_supported_yet / image_not_enabled (engine #574, PR 2): then a photo of ANY type, HEIC included, is refused in the control BEFORE it is read or sent, with R1's one photo line,
 * the control offers PDFs only, and the "save it as JPEG or PNG" line is never shown (R1: it would send a person round in a circle). The build env NEXT_PUBLIC_SCANNED_IMAGES=1 (exactly "1"), set with the app change that goes with the engine's decoder (PR 3), turns photos on and the HEIC line comes back with it.
 */
export const IMAGES_ACCEPTED = process.env.NEXT_PUBLIC_SCANNED_IMAGES === "1";

/** File types the flag-ON control accepts. Flag OFF keeps the existing lists (".txt,.pdf,.docx") untouched. */
export const SCAN_ACCEPT = IMAGES_ACCEPTED ? ".pdf,.png,.jpg,.jpeg,.tif,.tiff,.heic,application/pdf,image/png,image/jpeg,image/tiff,image/heic" : ".pdf,application/pdf";

export const SCAN_TEXT = {
  unreadablePage: "This page could not be read.",
  ocrLine: "Pages read from page images may contain mistakes. Check each quote against the page image.",
  ocrMarker: "Read from a scanned page: check this against the paper.", // R1 (21 Oct, 00e62215531c5b12): the ENGINE sends it as `ocr_marker` beside every item with `from_ocr: true` and the page renders that string; this copy is used only if the engine says from_ocr and the string is missing
  repairedPage: "The text in the file for this page was damaged, so the page was read from its image.", // R1 (20 Oct, OCR_REASON_LINES ce310fb606eb): the narrower line, shipped by engine #574 (6d58ad2bbb36f4d0)
  low_confidence: "This page could not be read well enough.",
  timeout: "This page took too long to read.",
  page_limit: "This page was not read because the paper has more pages than the tool reads at once.", // R1: over-cap pages, their own reason (940c7c869c69f005); the cap is never printed
  language_not_supported: "This page is in a language the tool does not read.",
  ocr_unavailable: "Scanned pages cannot be read in this deployment.",
  cropCaption: "Page image from your upload.",
  heicRefused: "This photo format is not supported. Save it as JPEG or PNG and add it again.", // shown only when IMAGES_ACCEPTED (PR 3)
  photoRefused: "Photos cannot be added here. Add the paper as a PDF.", // R1 (OCR_PR2_LINES fe1b36cca793): while the engine refuses images (b7857975b161bd99)
  tooLarge: "This file is too large. The limit is 8 MB. Make the file smaller, or split it, and add it again.",
} as const;

/** The document line for a partly read paper: R1's text with {n} filled in ("{n} page(s) could not be read, so this paper is only partly searched."). */
export const documentLine = (n: number): string => `${n} page(s) could not be read, so this paper is only partly searched.`;

export type PageSource = "text_layer" | "ocr" | "unreadable";
export interface ScanPage { page: number; source: PageSource; readable: boolean; reason: string | null; line: string | null; repaired: boolean }
export interface ScanIngest { indexedComplete: boolean | null; pages: ScanPage[]; pagesUnreadable: number; ocrLine: string | null }
export interface Crop { page: number; x: number; y: number; w: number; h: number; pageW: number; pageH: number }

const rec = (x: unknown): Record<string, unknown> | null => (typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const finite = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const SOURCES: readonly string[] = ["text_layer", "ocr", "unreadable"];

/** The ingest answer's per-page states. The engine's own `line` and `ocr_line` are used when it sent them; an unknown source or a malformed page is dropped, never guessed. Confidence is read by the engine, never shown. */
export function parseScanIngest(b: Record<string, unknown> | null): ScanIngest | null {
  if (!b || !Array.isArray(b.pages)) return null;
  const pages = b.pages.flatMap((p): ScanPage[] => {
    const r = rec(p); const page = finite(r?.page); const source = typeof r?.source === "string" ? r.source : null;
    if (!r || page === null || source === null || !SOURCES.includes(source)) return [];
    const readable = r.readable === true && source !== "unreadable";
    return [{ page, source: source as PageSource, readable, reason: typeof r.reason === "string" ? r.reason : null, line: typeof r.line === "string" ? r.line : null, repaired: readable && source === "ocr" && r.repaired === true }];
  });
  const unreadable = pages.filter((p) => !p.readable).length;
  const n = finite(b.pages_unreadable);
  return { indexedComplete: typeof b.indexed_complete === "boolean" ? b.indexed_complete : null, pages, pagesUnreadable: n !== null && n >= 0 ? n : unreadable, ocrLine: typeof b.ocr_line === "string" ? b.ocr_line : null };
}

/** The line under an unreadable page: the engine's own sentence (or R1's exact one), and the reason line when the reason is one we word. */
export function pageLines(p: ScanPage): string[] {
  if (p.readable) return [];
  const reason = p.reason && p.reason in SCAN_TEXT ? SCAN_TEXT[p.reason as keyof typeof SCAN_TEXT] : null;
  return [p.line ?? SCAN_TEXT.unreadablePage, ...(reason ? [reason] : [])];
}

/** The line for a page whose damaged text layer was re-read from its image (Track C v3: pages[].repaired:true, which replaced the internal garbled_text_layer; OCR_GARBLED_LAYER_v3 733074c1ce63); R1's plain words, never the word "garbled". */
export const repairedLine = (p: ScanPage): string | null => (p.repaired ? SCAN_TEXT.repairedPage : null);

/** What a quote or date row carries from a page image (flag ON only): where the crop comes from, the crop box, and whether its date was read from the image. */
export interface RowScan { docName: string | null; crop: Crop | null; fromOcr: boolean; marker: string | null }
export function rowScan(r: Record<string, unknown>, docName: string | null, enabled: boolean = SCANNED_INTAKE): RowScan | undefined {
  if (!enabled) return undefined;
  const crop = parseCrop(r.crop), fromOcr = r.from_ocr === true || r.read_from === "ocr"; // `read_from` (Track C, 19 Oct): a row's own `source` key keeps its old meaning (document and page text) and is never read here
  // OCR_MARKER_FIELD_CONTRACT (fc8683d55b51): `ocr_marker` is the engine's line and is rendered as sent, only for from_ocr true; absent from_ocr = not from a scanned page = nothing shown
  const sent = typeof r.ocr_marker === "string" && r.ocr_marker.trim() ? r.ocr_marker : null;
  const marker = fromOcr ? sent ?? SCAN_TEXT.ocrMarker : null;
  return crop || fromOcr ? { docName, crop, fromOcr, marker } : undefined;
}

/** The document name of a "name p. N" / "name, p. N" source string. */
export const docNameOf = (source: string | null): string | null => (source ? source.replace(/,?\s*p\.?\s*\d+\s*$/, "").trim() || null : null);

/** A span's crop box, or null when it is absent or not a usable box (the quote is then shown with its page number only). */
export function parseCrop(x: unknown): Crop | null {
  const r = rec(x); if (!r) return null;
  const [page, cx, cy, w, h, pageW, pageH] = ["page", "x", "y", "w", "h", "page_w", "page_h"].map((k) => finite(r[k]));
  if (page === null || cx === null || cy === null || w === null || h === null || pageW === null || pageH === null) return null;
  if (w <= 0 || h <= 0 || pageW <= 0 || pageH <= 0 || cx < 0 || cy < 0 || cx + w > pageW + 0.5 || cy + h > pageH + 0.5) return null;
  return { page, x: cx, y: cy, w, h, pageW, pageH };
}

/** The crop rectangle in the pixels of an image of the same page at any resolution: the box is relative to page_w by page_h, so it works whatever the OCR dpi was. */
export function cropRect(c: Crop, imgW: number, imgH: number): { sx: number; sy: number; sw: number; sh: number } {
  const kx = imgW / c.pageW, ky = imgH / c.pageH;
  return { sx: Math.round(c.x * kx), sy: Math.round(c.y * ky), sw: Math.max(1, Math.round(c.w * kx)), sh: Math.max(1, Math.round(c.h * ky)) };
}

/** Image types the browser can draw itself (a plain canvas crop). Scanned PDFs need the pdf.js path (its own PR); TIFF and HEIC are not drawn by browsers. */
export const canDrawImage = (mime: string): boolean => /^image\/(png|jpe?g)$/.test(mime);

/** HEIC is refused by the engine in v1 (Track C, OCR_UPLOAD_WIRE_v2 aac86fb28729); the plain line is Track C's, R1 to confirm, so the app only shows what the engine answers and never reads the file. */
export const SCAN_MIME = ["application/pdf", "image/png", "image/jpeg", "image/tiff"] as const;
export const MAX_SCAN_BYTES = 8_000_000; // decoded size cap, same as a PDF (engine max_pdf_bytes)

export type ScanBodyResult = { ok: true; body: Record<string, unknown> } | { ok: false; reason: "too_big" | "heic" | "photo" | "type" };

/** The request body for the engine's documents route: exactly one of pdf_base64 | image_base64 (+ mime), never text. Pure: the caller supplies the base64. */
export function scanBody(matterId: string, name: string, mime: string, size: number, base64: string, imagesAccepted: boolean = IMAGES_ACCEPTED): ScanBodyResult {
  if (size > MAX_SCAN_BYTES) return { ok: false, reason: "too_big" };
  // while the engine refuses photos, any image type (HEIC too) is refused here, before the file is read or sent
  if (!imagesAccepted && /^image\//.test(mime)) return { ok: false, reason: "photo" };
  const nm = name.trim().slice(0, 200) || "paper";
  if (mime === "application/pdf") return { ok: true, body: { matter_id: matterId, name: nm, pdf_base64: base64 } };
  if (mime === "image/png" || mime === "image/jpeg" || mime === "image/tiff") return { ok: true, body: { matter_id: matterId, name: nm, image_base64: base64, mime } };
  if (mime === "image/heic" || mime === "image/heif") return { ok: false, reason: "heic" };
  return { ok: false, reason: "type" };
}

/** R1's two upload refusal lines (OCR_UPLOAD_LINES_R1 ee4baa2862f7): HEIC by mime, and ANY over-size answer (engine code pdf_too_large / HTTP 413, whose own text says "PDF" and shows raw bytes, so it is never shown). Null = not one of these. */
export function scanRefusalLine(reason: string | null, status: number | null, body: Record<string, unknown> | null): string | null {
  // while the engine refuses images: any photo, HEIC included, and the engine's own image refusal codes, answer R1's one photo line
  if (body?.error === "image_not_supported_yet" || body?.error === "image_not_enabled" || body?.code === "image_not_supported_yet" || body?.code === "image_not_enabled") return SCAN_TEXT.photoRefused;
  if (reason === "photo") return SCAN_TEXT.photoRefused;
  if (reason === "heic") return IMAGES_ACCEPTED ? SCAN_TEXT.heicRefused : SCAN_TEXT.photoRefused;
  if (reason === "too_big" || status === 413 || body?.error === "pdf_too_large" || body?.code === "pdf_too_large") return SCAN_TEXT.tooLarge;
  return null;
}

/** The mime type of an uploaded file: the browser's, else by extension (some systems give an empty type), else "". */
export function mimeOfFile(name: string, type: string): string {
  if (type) return type.toLowerCase();
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  return ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", tif: "image/tiff", tiff: "image/tiff", heic: "image/heic", heif: "image/heif" } as Record<string, string>)[ext] ?? "";
}

/**
 * The user's kept uploads by the paper NAME the engine's rows carry: a name maps to a file only when exactly one paper in the matter has that name and the kept file is the very one the engine
 * stored under that doc_id; two papers with one name give no crop (never the wrong file's crop). The uploads are keyed by doc_id and cleared when the matter changes.
 */
export function keptByName(papers: readonly { docId: string; name: string }[], kept: ReadonlyMap<string, File>): ReadonlyMap<string, File> {
  const count = new Map<string, number>();
  for (const p of papers) count.set(p.name, (count.get(p.name) ?? 0) + 1);
  const out = new Map<string, File>();
  for (const p of papers) { const f = kept.get(p.docId); if (f && count.get(p.name) === 1) out.set(p.name, f); }
  return out;
}
