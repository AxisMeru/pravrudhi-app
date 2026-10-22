import type { WakeView } from "@/lib/wake/wake";
import { WAKE_GLOSS } from "@/lib/wake/wakeCopy";

/** #1038: the per-model start-up rows and the one progress line (R1's words). Shown only while the engine reports a start in progress; no percentage, no estimate. */
export function WakeProgress({ view }: { view: WakeView }) {
  if (view.phase !== "waiting" && view.phase !== "scoring") return null;
  return (
    <div className="flex flex-col gap-2" data-testid="wake-progress">
      <p className="text-base font-medium text-[var(--color-text)]" aria-live="polite" data-testid="wake-line">{view.line}</p>
      <ul className="flex flex-col gap-1 text-sm text-[var(--color-text)]">
        {view.rows.map((r) => (
          <li key={r.role} data-testid={`wake-row-${r.role}`} data-state={r.state}>
            <span className="font-medium">{r.label}</span>: {r.status}
          </li>
        ))}
      </ul>
      <p className="text-sm text-[var(--color-text-dim)]" data-testid="wake-gloss">{WAKE_GLOSS}</p>
    </div>
  );
}

/** The partial-load warning, above the result, always visible. */
export function WakeWarning({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-[var(--color-warn-border)] bg-[var(--color-warn-bg)] p-3 text-sm text-[var(--color-warn)]" role="status" data-testid="wake-warning">{text}</p>
  );
}
