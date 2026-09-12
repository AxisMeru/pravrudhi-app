// Data-shaping for the home page's bands. Every function here is pure: given what the engine (or the recorded
// demo) actually returned, decide what a band should show, including the honest "nothing yet" case. Fetching
// lives in the page; this file only turns raw responses into what a band renders.
//
// Every source here is one this product engine actually serves a signed-in user (checked against
// api/roles.py's USER_FACING set in AxisMeru/pravrudhi, not assumed): objectives, runs, Nyaya asks. Studio-only
// surfaces (appetite, heartbeat, swarm, nights, requests, candidates) 404 there and never belonged on this
// page - S7's report is the record of finding them still wired in, unused, months after the product/Studio
// split (ADR-0049).

import {
  runs as fetchRuns,
  objectives as fetchObjectives,
  nyayaAsks as fetchNyayaAsks,
  type RunHandle,
  type Objective,
  type BenchmarkProgress,
  type NyayaAsk,
} from "./api";
import { RUNNING_STATUSES, asStr, asNum, runHref } from "./run";
import { objectiveHref, withPairedStats } from "./objective";

export interface HomeData {
  // `null` means the fetch itself failed or the engine does not serve this yet - distinct from an empty array,
  // which means it answered and there is genuinely nothing. A number derived from `null` is dropped, not shown
  // as zero (heartbeat.spec.ts's own discipline before heartbeat.ts was deleted: "a caller must be able to tell
  // empty from failed").
  objectives: Objective[] | null;
  runHandles: RunHandle[] | null;
  nyayaAsks: NyayaAsk[] | null;
}

export async function loadHome(): Promise<HomeData> {
  const [objs, rns, asks] = await Promise.allSettled([fetchObjectives(), fetchRuns(), fetchNyayaAsks()]);
  return {
    objectives: objs.status === "fulfilled" ? objs.value.objectives : null,
    runHandles: rns.status === "fulfilled" ? rns.value : null,
    nyayaAsks: asks.status === "fulfilled" ? asks.value : null,
  };
}

// ---------------------------------------------------------------------------
// Band 1: the result. The largest measured, honestly-labelled improvement across every objective's benchmarks.

export interface BiggestResult {
  objectiveId: string;
  objectiveHref: string;
  benchmark: string;
  scorer: string | null;
  model: string;
  n: number;
  baseline: number;
  current: number;
  delta: number;
  deltaLo: number | null;
  deltaHi: number | null;
  significant: boolean;
  paired: boolean;
  wins: number | null;
  losses: number | null;
  pMcnemar: number | null;
}

// A row only counts once it has a delta against a baseline. Among those, a significant result outranks a
// merely larger one -- an unverified swing is not "the biggest result", it is noise that happens to be big.
function betterRow(a: MeasuredProgress, b: MeasuredProgress): boolean {
  if (a.significant !== b.significant) return a.significant;
  return a.delta > b.delta;
}

// A `BenchmarkProgress` row with its optional fields narrowed to what "measured" guarantees, so the object
// picked as the winner can be read back without every field re-checked against null.
type MeasuredProgress = BenchmarkProgress & {
  delta: number;
  baseline: NonNullable<BenchmarkProgress["baseline"]>;
  latest: NonNullable<BenchmarkProgress["latest"]>;
};

function isMeasured(p: BenchmarkProgress): p is MeasuredProgress {
  return p.state === "measured" && p.delta !== null && p.baseline !== null && p.latest !== null;
}

export function biggestResult(objs: Objective[] | null): BiggestResult | null {
  let best: { obj: Objective; p: MeasuredProgress } | null = null;
  for (const obj of objs ?? []) {
    for (const p of obj.progress) {
      if (!isMeasured(p)) continue;
      if (!best || betterRow(p, best.p)) best = { obj, p };
    }
  }
  if (!best) return null;
  const { obj, p } = best;
  const spec = obj.benchmarks.find((b) => b.id === p.benchmark);
  const paired = withPairedStats(p);
  return {
    objectiveId: obj.id,
    objectiveHref: objectiveHref(obj.id),
    benchmark: p.benchmark,
    scorer: spec?.tool ?? null,
    model: p.latest.model,
    n: p.baseline.n,
    baseline: p.baseline.value,
    current: p.latest.value,
    delta: p.delta,
    deltaLo: p.delta_lo,
    deltaHi: p.delta_hi,
    significant: p.significant,
    paired: paired.paired,
    wins: paired.wins,
    losses: paired.losses,
    pMcnemar: paired.p_mcnemar,
  };
}

// ---------------------------------------------------------------------------
// Band 2: what is running right now, against the user's own objectives. (Studio's appetite/heartbeat/swarm
// concepts do not apply here - a product user's "now" is their own run, not the whole engine's self-improvement
// loop; see S7's report.)

export interface RunningRun {
  id: string;
  href: string;
  target: string;
  model: string | null;
  bench: string | null;
  budgetGpuH: number | null;
}

export function runningRun(handles: RunHandle[] | null): RunningRun | null {
  const running = (handles ?? []).find((h) => RUNNING_STATUSES.has(asStr(h.status) ?? ""));
  if (!running) return null;
  return {
    id: running.id,
    href: runHref(running.id),
    target: asStr(running.target) ?? "model",
    model: asStr(running.model) ?? null,
    bench: asStr(running.bench) ?? null,
    budgetGpuH: asNum(running.budget_gpu_h) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Band 3: a slim strip of real, per-user numbers - each dropped rather than shown as zero when its own source
// could not be read, and each linking only to a page this repository actually has.

export interface DoneStrip {
  objectivesStated: number | null;
  runsCompleted: number | null;
  nyayaAsksAnswered: number | null;
}

const COMPLETED_RUN_STATUSES = new Set(["finished", "failed"]);

export function doneStrip(data: HomeData): DoneStrip {
  return {
    objectivesStated: data.objectives?.length ?? null,
    runsCompleted:
      data.runHandles === null
        ? null
        : data.runHandles.filter((h) => COMPLETED_RUN_STATUSES.has(asStr(h.status) ?? "")).length,
    nyayaAsksAnswered: data.nyayaAsks?.length ?? null,
  };
}
