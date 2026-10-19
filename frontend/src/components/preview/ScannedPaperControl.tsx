"use client";

import { useRef, useState } from "react";

import { previewPost } from "@/lib/previewApi";
import { SCAN_ACCEPT, SCAN_TEXT, documentLine, pageLines, parseScanIngest, repairedLine, scanBody, scanRefusalLine, type ScanIngest } from "@/lib/scannedIntake";

const BTN = "inline-flex min-h-[44px] items-center rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const toBase64 = (buf: ArrayBuffer): string => {
  let s = ""; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

/**
 * "Add a scanned paper" (flag-ON only): sends any PDF as pdf_base64 and a png/jpeg/tiff photo as image_base64; the engine decides per page whether it reads a text layer or the scan
 * (pages[].source). The file stays in this browser (onKept) so a crop can be drawn from it later; the engine keeps no page image. Per-page states are the engine's own lines and R1's reason lines.
 */
export function ScannedPaperControl({ matter, busy, onAdded, onKept, onRefusal }: {
  matter: string; busy: boolean; onAdded: () => Promise<void>; onKept: (file: File) => void;
  onRefusal: (status: number, body: Record<string, unknown> | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState<{ name: string; ingest: ScanIngest } | null>(null);
  const [working, setWorking] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const add = async (file: File) => {
    setWorking(true); setLast(null); setRefusal(null);
    try {
      const r = scanBody(matter, file.name, file.type, file.size, toBase64(await file.arrayBuffer()));
      if (!r.ok) { const line = scanRefusalLine(r.reason, null, null); return line ? setRefusal(line) : onRefusal(422, null); }
      const a = await previewPost("/matter-spans/documents", r.body);
      if (a.status !== 200) { const line = scanRefusalLine(null, a.status, a.body); return line ? setRefusal(line) : onRefusal(a.status, a.body); }
      const ingest = parseScanIngest(a.body);
      const docId = typeof a.body?.doc_id === "string" ? a.body.doc_id : null;
      if (docId) onKept(file);
      if (ingest) setLast({ name: file.name, ingest });
      await onAdded();
    } finally { setWorking(false); }
  };
  return (
    <div className="space-y-2" data-testid="scan-add">
      <input ref={input} type="file" accept={SCAN_ACCEPT} className="hidden" data-testid="scan-file" aria-label="Add a scanned paper" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void add(f); }} />
      <button type="button" className={BTN} disabled={busy || working} onClick={() => input.current?.click()} data-testid="scan-add-button">{working ? "Working" : "Add a scanned paper"}</button>
      {refusal && <p className="text-sm text-[var(--color-text)]" data-testid="scan-refusal">{refusal}</p>}
      {last && (
        <div className="text-sm text-[var(--color-text)]" data-testid="scan-result">
          {last.ingest.pages.some((p) => p.source === "ocr") && <p data-testid="scan-ocr-line">{SCAN_TEXT.ocrLine}</p>}
          {last.ingest.pagesUnreadable > 0 && <p data-testid="scan-doc-line">{documentLine(last.ingest.pagesUnreadable)}</p>}
          <ul>{last.ingest.pages.filter((p) => !p.readable).map((p) => (
            <li key={p.page} data-testid="scan-page-unreadable">Page {p.page}: {pageLines(p).join(" ")}</li>
          ))}{last.ingest.pages.filter((p) => p.repaired).map((p) => (
            <li key={`r${p.page}`} data-testid="scan-page-repaired">Page {p.page}: {repairedLine(p)}</li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}
