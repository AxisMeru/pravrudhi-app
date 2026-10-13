import { CAVEATS, WARMING_NOTE } from "@/lib/surfaceCopy";

// One strip, always shown on the surface's result pages. It does not show the engine's retention_notice (which can carry a promise the app does not
// enforce): retention is stated once, by RetentionBefore. The warming line appears only while the judges report they are warming.
export function CaveatStrip({ warming }: { warming?: boolean }) {
  return (
    <aside
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-dim)]"
      data-testid="caveat-strip"
      aria-label="How to read this analysis"
    >
      <ul className="list-disc space-y-1 pl-4">
        {CAVEATS.map((c) => (
          <li key={c.id}>{c.text}</li>
        ))}
        {warming && <li data-testid="warming-note">{WARMING_NOTE}</li>}
      </ul>
    </aside>
  );
}
