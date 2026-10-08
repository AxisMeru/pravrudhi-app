import { BANNER_STANDING_LINE, type Chip } from "@/lib/screening/copy";
import type { ScreeningSummary } from "@/lib/screening/model";

export function SummaryBanner({ summary }: { summary: ScreeningSummary }) {
  return (
    <div
      className={`rounded-md border p-3 ${summary.allSupported ? "border-emerald-500/40 bg-emerald-500/10" : "border-[var(--color-border)] bg-[var(--color-bg)]"}`}
      data-testid="summary-banner"
      role="status"
    >
      <p className="text-sm font-medium text-[var(--color-text)]" data-testid="summary-text">{summary.text}</p>
      <p className="mt-1 text-xs text-[var(--color-text-dim)]">{BANNER_STANDING_LINE}</p>
    </div>
  );
}

export const CHIP_TONE: Readonly<Record<Chip, string>> = {
  supported: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  not_supported: "border-[var(--color-border)] text-[var(--color-text-dim)]",
  // Amber, never red: a review item is an invitation to look, not a failure.
  review: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};
