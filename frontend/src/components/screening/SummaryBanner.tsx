import { BANNER_STANDING_LINE, STRUCTURE_NOTE, type Chip } from "@/lib/screening/copy";
import type { ScreeningSummary } from "@/lib/screening/model";

export function SummaryBanner({ summary }: { summary: ScreeningSummary }) {
  return (
    <div
      className={`rounded-md border p-3 ${summary.allSupported ? "border-[var(--color-ok-border)] bg-[var(--color-ok-bg)]" : "border-[var(--color-border)] bg-[var(--color-bg)]"}`}
      data-testid="summary-banner"
      role="status"
    >
      <p className="text-sm font-medium text-[var(--color-text)]" data-testid="summary-text">{summary.text}</p>
      <p className="mt-1 text-xs text-[var(--color-text-dim)]">{BANNER_STANDING_LINE}</p>
      {summary.allSupported && (
        <p className="mt-1 text-xs text-[var(--color-text-dim)]" data-testid="structure-note">{STRUCTURE_NOTE}</p>
      )}
    </div>
  );
}

export const CHIP_TONE: Readonly<Record<Chip, string>> = {
  supported: "border-[var(--color-ok-border)] bg-[var(--color-ok-bg)] text-[var(--color-ok)]",
  // A suggestion is neither a finding nor an error: dashed and neutral, so it never reads as a supported ingredient.
  suggested: "border-dashed border-[var(--color-info-border)] text-[var(--color-info)]",
  not_supported: "border-[var(--color-border)] text-[var(--color-text-dim)]",
  // Amber, never red: a review item is an invitation to look, not a failure.
  review: "border-[var(--color-warn-border)] bg-[var(--color-warn-bg)] text-[var(--color-warn)]",
};
