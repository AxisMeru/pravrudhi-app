// Band: a compact strip of what this user has done so far, each figure a link to the page that explains it.
// A number whose own source could not be read is dropped, not shown as a fabricated zero (see lib/home.ts's
// DoneStrip and S7's report) - real API, real page, or the tile does not appear at all.

import Link from "next/link";
import type { DoneStrip } from "@/lib/home";

function Tile({ href, value, label }: { href: string; value: number; label: string }) {
  return (
    <Link
      href={href}
      className="flex-1 px-4 py-3 text-center transition-colors hover:bg-[var(--color-surface-raised)]"
    >
      <div className="text-xl font-semibold tabular-nums text-[var(--color-text)]">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
    </Link>
  );
}

export function DoneBand({ strip }: { strip: DoneStrip }) {
  const tiles: Array<{ href: string; value: number; label: string }> = [];
  if (strip.objectivesStated !== null) tiles.push({ href: "/objectives", value: strip.objectivesStated, label: "objectives stated" });
  if (strip.runsCompleted !== null) tiles.push({ href: "/runs", value: strip.runsCompleted, label: "runs completed" });
  if (strip.nyayaAsksAnswered !== null) tiles.push({ href: "/nyaya", value: strip.nyayaAsksAnswered, label: "nyaya asks answered" });

  if (tiles.length === 0) return null;

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-border)] px-5 py-3">
        <h2 className="text-sm font-medium text-[var(--color-text)]">What you&apos;ve done</h2>
      </div>
      <div className="flex flex-wrap divide-x divide-[var(--color-border)]">
        {tiles.map((t) => (
          <Tile key={t.href} {...t} />
        ))}
      </div>
    </section>
  );
}
