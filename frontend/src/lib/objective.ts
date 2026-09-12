// Data helpers for the objective detail page: routing to it, and joining the runs that were scored under this
// objective's track -- the only association the ledger records between an objective and the work it produced.
// Kept out of lib/api.ts so this join logic does not contend with pages already built against it.

import { IS_DEMO, runs as fetchRuns, type BenchmarkProgress, type RunHandle } from "./api";
import { percent } from "./num";

export function objectiveHref(id: string): string {
  return `/objectives/detail?id=${encodeURIComponent(id)}`;
}

// `Progress.to_dict()` (application/objectives.py) always carries these fields via `asdict`, but lib/api.ts's
// `BenchmarkProgress` predates the paired McNemar comparison and never declared them. The values are really on
// every row the engine or the demo snapshot sends; this reads them without editing api.ts.
export interface PairedProgress extends BenchmarkProgress {
  paired: boolean;
  wins: number | null;
  losses: number | null;
  p_mcnemar: number | null;
}

export function withPairedStats(p: BenchmarkProgress): PairedProgress {
  const row = p as Partial<PairedProgress>;
  return {
    ...p,
    paired: row.paired ?? false,
    wins: row.wins ?? null,
    losses: row.losses ?? null,
    p_mcnemar: row.p_mcnemar ?? null,
  };
}

// A percentage already screened by lib/num.ts's `percent`, with an explicit sign prepended -- every delta this
// page shows is a change against a baseline, so the sign is the point.
export function signedPercent(v: number | null | undefined, digits = 1): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const s = percent(v, digits);
  return v > 0 ? `+${s}` : s;
}

interface NightTrack {
  night: number;
  track: string;
}

async function nightTracks(): Promise<NightTrack[]> {
  if (IS_DEMO) {
    const { demo } = await import("./demo");
    const rows = ((await demo()) as unknown as Record<string, unknown>)["nights"];
    return Array.isArray(rows) ? (rows as NightTrack[]) : [];
  }
  // A product install answers 404 here (roles.py: Studio's); the night tracks are simply absent for it. Upstream
  // request r-d73f9cea decides whether a user's own nights should be theirs to see.
  return [];
}

function nightOf(handle: RunHandle): number | undefined {
  const v = (handle as Record<string, unknown>).night;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export interface ObjectiveActivity {
  // `null` means the runs fetch itself failed -- distinct from an empty array, which means it answered and this
  // track genuinely has no run yet (mirrors lib/home.ts's HomeData discipline: a caller must be able to tell
  // empty from failed).
  runs: RunHandle[] | null;
}

// Everything scored on this objective's track: a run whose night was recorded against the track. A `RunHandle`
// does not name an objective directly -- the track, joined through the night it was scored on, is the only link
// the ledger supports.
export async function objectiveActivity(track: string): Promise<ObjectiveActivity> {
  const [allRuns, nights] = await Promise.allSettled([fetchRuns(), nightTracks()]);
  if (allRuns.status !== "fulfilled") return { runs: null };
  const nightsList = nights.status === "fulfilled" ? nights.value : [];
  const nightsOnTrack = new Set(nightsList.filter((n) => n.track === track).map((n) => n.night));
  return {
    runs: allRuns.value.filter((r) => {
      const night = nightOf(r);
      return night !== undefined && nightsOnTrack.has(night);
    }),
  };
}
