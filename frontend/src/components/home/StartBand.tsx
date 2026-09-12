// Band: state an objective. The product's promise is "state one objective, get one artifact" (ADR-0049) - the
// guided flow at /start (intent -> success -> compiled plan -> create) is that promise, already built; this is
// its one entry point from the front door, not a second, competing form in Studio's own vocabulary (a raw
// target/proposer-model/selection-policy picker posted straight to /api/runs). /start handles demo mode itself,
// so nothing here needs to.

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function StartBand() {
  return (
    <Link
      href="/start"
      className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:bg-[var(--color-surface-raised)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-[var(--color-text)]">State an objective</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-muted)]">
            Say what you want in your own words, see what the engine would do about it, then make it real.
          </p>
        </div>
        <ArrowRight size={18} className="shrink-0 text-[var(--color-text-dim)]" />
      </div>
    </Link>
  );
}
