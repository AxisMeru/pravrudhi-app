import { PREVIEW } from "@/lib/previewWorkflows";

/** The one plain line under a workflow (R1's words, lib/previewWorkflows.ts); there is no status label, so without `line` it renders nothing. */
export function PreviewBadge({ line = false, short = false }: { line?: boolean; short?: boolean }) {
  if (!line) return null;
  return <span className="text-xs text-[var(--color-text-dim)]" data-testid="preview-line">{short ? PREVIEW.preview_short : PREVIEW.preview_line}</span>;
}
