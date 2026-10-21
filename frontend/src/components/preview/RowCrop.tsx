"use client";

import { type RowScan } from "@/lib/scannedIntake";
import { ScanCrop } from "./ScanCrop";
import { useKept } from "./ScanKept";

/** Under a quote or date read from a page image (flag ON only): the engine's own ocr_marker line (R1's words), and the crop from the user's own upload when this browser holds it. No scan info, nothing is rendered. */
export function RowCrop({ scan }: { scan: RowScan | undefined }) {
  const kept = useKept();
  if (!scan) return null;
  return (
    <>
      {scan.fromOcr && scan.marker && <span className="block text-xs text-[var(--color-text-dim)]" data-testid="scan-ocr-marker">{scan.marker}</span>}
      <ScanCrop file={(scan.docName && kept.get(scan.docName)) || null} crop={scan.crop} />
    </>
  );
}
