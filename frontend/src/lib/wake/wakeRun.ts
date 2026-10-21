// Cold start with progress (#1038): start + poll orchestration as a pure function over injected IO (no fetch here, so it is unit-testable with a fake clock).
// Fail-closed: anything unreadable or unanswered ends as a "stopped" view with nothing scored; a result is returned only from a job the engine reports done.
import { parseWake, wakeView, WAKE_UNREADABLE_VIEW, type WakeView } from "./wake";
import { failBothLine } from "./wakeCopy";

export interface WakeJob { status: string; wake: unknown; result?: unknown }
export type WakeStart = { kind: "not_allowed" } | { kind: "started"; jobId: string; pollAfterS: number; wake: unknown };
export interface WakeIO {
  start: () => Promise<WakeStart>;
  poll: (jobId: string) => Promise<WakeJob>;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Called with the view after the start answer and after each poll. */
  onView: (v: WakeView) => void;
  signal?: AbortSignal;
  /** The page stops polling after this long (the engine's hard maximum is 420 s; it never prints the number). */
  maxMs?: number;
  now?: () => number;
}
export type WakeOutcome = { kind: "not_allowed" } | { kind: "done"; wire: unknown } | { kind: "stopped"; view: WakeView };

const MIN_POLL_S = 2;
const MAX_POLL_S = 10;
const MAX_POLL_FAILURES = 3;
const DEFAULT_MAX_MS = 480_000;

export async function runWake(io: WakeIO): Promise<WakeOutcome> {
  const now = io.now ?? Date.now;
  const began = now();
  const st = await io.start();
  if (st.kind === "not_allowed") return { kind: "not_allowed" };
  let wake = parseWake(st.wake);
  if (wake) io.onView(wakeView(wake));
  const every = Math.min(MAX_POLL_S, Math.max(MIN_POLL_S, Number.isFinite(st.pollAfterS) ? st.pollAfterS : 2)) * 1000;
  let failures = 0;
  for (;;) {
    if (io.signal?.aborted) throw new DOMException("cancelled", "AbortError");
    if (now() - began > (io.maxMs ?? DEFAULT_MAX_MS)) return stop({ phase: "stopped", rows: wake ? wakeView(wake).rows : [], line: "", warning: failBothLine(true) }, io);
    await io.sleep(every, io.signal);
    let job: WakeJob;
    try {
      job = await io.poll(st.jobId);
      failures = 0;
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "AbortError") throw e;
      if (++failures >= MAX_POLL_FAILURES) return stop(WAKE_UNREADABLE_VIEW, io);
      continue;
    }
    wake = parseWake(job.wake) ?? wake;
    const v = wake ? wakeView(wake) : null;
    if (v) io.onView(v);
    if (job.status === "done") {
      if (job.result === undefined || job.result === null) return stop(WAKE_UNREADABLE_VIEW, io);
      return { kind: "done", wire: job.result };
    }
    if (job.status === "failed") return stop(v && v.phase === "stopped" ? v : WAKE_UNREADABLE_VIEW, io);
    if (job.status !== "pending" && job.status !== "running") return stop(WAKE_UNREADABLE_VIEW, io);
    // a wake that reads "failed"/"timeout" while the job is still open: stop only when the job itself says failed (the engine's word), keep showing the rows
  }
}

function stop(view: WakeView, io: WakeIO): WakeOutcome {
  io.onView(view);
  return { kind: "stopped", view };
}
