import { CAVEATS } from "@/lib/surfaceCopy";

// One strip, always shown on the surface's result pages. The retention notice is the engine's own text, shown verbatim
// once a result carries it; the warming line appears only while the judges report they are warming.
export function CaveatStrip({ retentionNotice, warming }: { retentionNotice?: string | null; warming?: boolean }) {
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
        {retentionNotice && <li data-testid="retention-notice">{retentionNotice}</li>}
        {warming && <li data-testid="warming-note">The analysis models are warming up; the first run can take a few minutes.</li>}
      </ul>
    </aside>
  );
}
