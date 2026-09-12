// Band: what is running right now, against the user's own objective. Studio's appetite/heartbeat/swarm
// concepts (what the whole engine's self-improvement loop wants, its last beat, how many agent processes are
// working) do not apply to a product user - none of the three ever rendered anything real here (they were
// never fetched: S7's report), and this repository has no /swarm page for the old "agents working" link to
// point to.

import Link from "next/link";
import { Activity, Play } from "lucide-react";
import type { RunningRun } from "@/lib/home";
import { fixed } from "@/lib/num";

export function NowBand({ running }: { running: RunningRun | null }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-[var(--color-text-dim)]" />
        <h2 className="text-sm font-medium text-[var(--color-text)]">Right now</h2>
      </div>

      <div className="mt-3">
        {running ? (
          <Link
            href={running.href}
            className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text)] hover:text-[var(--color-accent)]"
          >
            <Play size={14} className="shrink-0 text-[var(--color-accent)]" />
            <span className="capitalize">{running.target}</span>
            {running.model && <span className="font-mono">{running.model}</span>}
            {running.bench && <span className="text-[var(--color-text-dim)]">on {running.bench}</span>}
            {running.budgetGpuH !== null && (
              <span className="text-[var(--color-text-dim)]">— {fixed(running.budgetGpuH, 1)} GPU-h budget</span>
            )}
          </Link>
        ) : (
          <p className="text-sm text-[var(--color-text-dim)]">No run in progress right now.</p>
        )}
      </div>
    </section>
  );
}
