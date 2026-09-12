"use client";

// The runs that were scored under this objective's track, so a person reading a benchmark number above can go
// look at what produced it. A run does not name an objective directly (see lib/objective.ts's
// `objectiveActivity`), so this is a join through the track's nights, not a stored link -- an empty list here
// means nothing has run on this track yet; `null` means the runs fetch itself failed, not that the join did.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Wrench } from "lucide-react";
import type { RunHandle } from "@/lib/api";
import { objectiveActivity, type ObjectiveActivity } from "@/lib/objective";
import { runHref } from "@/lib/run";

function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNum(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function RunRow({ handle }: { handle: RunHandle }) {
  const target = asStr(handle.target) ?? "model";
  const night = asNum(handle.night);
  const status = asStr(handle.status) ?? "unknown";
  const Icon = target === "harness" ? Wrench : Sparkles;
  return (
    <Link
      href={runHref(handle.id)}
      className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs transition-colors hover:bg-[var(--color-surface-raised)]"
    >
      <Icon size={13} className="shrink-0 text-[var(--color-text-dim)]" />
      <span className="capitalize text-[var(--color-text)]">{target}</span>
      {night !== undefined && <span className="text-[var(--color-text-dim)]">night {night}</span>}
      <span className="ml-auto text-[var(--color-text-dim)]">{status}</span>
    </Link>
  );
}

export function LinkedActivity({ track }: { track: string }) {
  const [data, setData] = useState<ObjectiveActivity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    objectiveActivity(track)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [track]);

  if (error) return <p className="text-sm text-[var(--color-danger)]">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--color-text-dim)]">Loading…</p>;
  if (data.runs === null) {
    return <p className="text-sm text-[var(--color-danger)]">Could not load runs for this track.</p>;
  }

  return (
    <div>
      <p className="text-sm leading-6 text-[var(--color-text-dim)]">
        Every run the ledger recorded on track <span className="font-mono">{track}</span>, joined through the
        night each was scored on.
      </p>

      <div className="mt-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-dim)]">Runs</h3>
        {data.runs.length === 0 && (
          <p className="mt-2 text-xs text-[var(--color-text-dim)]">No run has been scored on this track yet.</p>
        )}
        <div className="mt-2 space-y-1.5">
          {data.runs.map((r) => (
            <RunRow key={r.id} handle={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
