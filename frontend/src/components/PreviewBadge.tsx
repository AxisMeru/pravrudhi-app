import { PREVIEW } from "@/lib/previewWorkflows";

/** The "Preview" label of a preview workflow entry point (R1's words, lib/previewWorkflows.ts); `line` adds R1's one-sentence explanation. */
export function PreviewBadge({ line = false, short = false }: { line?: boolean; short?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="preview-badge">
      <span className="rounded border border-[var(--color-warn-border)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-warn)]">{PREVIEW.preview_badge}</span>
      {line && <span className="text-xs text-[var(--color-text-dim)]" data-testid="preview-line">{short ? PREVIEW.preview_short : PREVIEW.preview_line}</span>}
    </span>
  );
}
