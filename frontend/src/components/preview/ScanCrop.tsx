"use client";

import { useEffect, useRef, useState } from "react";

import { SCAN_TEXT, canDrawImage, cropRect, type Crop } from "@/lib/scannedIntake";

/**
 * The page-image crop beside a quote that was read from a scan (flag-ON only). Drawn in the browser from the user's OWN kept upload: the engine stores no page image,
 * and nothing is sent anywhere. For a file the browser cannot draw (PDF here, TIFF, HEIC) or on any failure it renders nothing: the caller still shows the quote with its page number.
 */
export function ScanCrop({ file, crop }: { file: Blob | null; crop: Crop | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawnFor, setDrawnFor] = useState<{ file: Blob; crop: Crop } | null>(null);
  const drawn = !!file && !!crop && drawnFor?.file === file && drawnFor.crop === crop;
  useEffect(() => {
    let alive = true;
    if (!file || !crop || !canDrawImage(file.type)) return;
    (async () => {
      try {
        const bmp = await createImageBitmap(file);
        const canvas = ref.current;
        if (!alive || !canvas) return bmp.close();
        const { sx, sy, sw, sh } = cropRect(crop, bmp.width, bmp.height);
        const scale = Math.min(1, 720 / sw);
        canvas.width = Math.max(1, Math.round(sw * scale));
        canvas.height = Math.max(1, Math.round(sh * scale));
        canvas.getContext("2d")?.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        bmp.close();
        setDrawnFor({ file, crop });
      } catch { /* no crop: the quote and its page number stand alone */ }
    })();
    return () => { alive = false; };
  }, [file, crop]);
  if (!file || !crop || !canDrawImage(file.type)) return null;
  return (
    <figure className={drawn ? "mt-1" : "hidden"} data-testid="scan-crop">
      <canvas ref={ref} className="max-w-full rounded border border-[var(--color-border)]" aria-label={SCAN_TEXT.cropCaption} role="img" />
      <figcaption className="text-xs text-[var(--color-text-dim)]" data-testid="scan-crop-caption">{SCAN_TEXT.cropCaption}</figcaption>
    </figure>
  );
}
