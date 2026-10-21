// Cold start with progress (#1038): the engine's `wake` block on a job, read defensively, and the pure view the screening page renders from it.
// Fail-closed: anything the page cannot read is "unreadable", never a state it did not read. No percentage is ever shown (progress is null today).
import { WAKE_DONE_BOTH, WAKE_FAIL_BOTH, WAKE_LABEL, WAKE_POLL_ERROR, WAKE_PROGRESS_ALL, WAKE_PROGRESS_FIRST_READY, WAKE_PROGRESS_SECOND_READY, WAKE_STATUS, WAKE_WARN_FIRST_FAILED, WAKE_WARN_SECOND_FAILED, failBothLine } from "./wakeCopy";

export type WakeRole = "first" | "second";
export type WakeModelState = "waiting" | "starting" | "ready" | "failed";
export type WakeState = "waking" | "ready" | "partial" | "failed" | "timeout";
export type WakeReason = "second_judge_unavailable" | "first_judge_unavailable" | "start_timeout";
export interface WakeModel { role: WakeRole; state: WakeModelState; progress: number | null }
export interface Wake { state: WakeState; models: WakeModel[]; reason: WakeReason | null }

const STATES: readonly WakeState[] = ["waking", "ready", "partial", "failed", "timeout"];
const MODEL_STATES: readonly WakeModelState[] = ["waiting", "starting", "ready", "failed"];
const REASONS: readonly WakeReason[] = ["second_judge_unavailable", "first_judge_unavailable", "start_timeout"];

/** Reads a job's `wake` value. Absent or not an object -> null (the page behaves exactly as today). An unknown state -> null; unknown model rows or bad progress are dropped. */
export function parseWake(raw: unknown): Wake | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const state = STATES.find((s) => s === o.state);
  if (!state) return null;
  const models: WakeModel[] = [];
  if (Array.isArray(o.models)) {
    for (const m of o.models) {
      if (typeof m !== "object" || m === null) continue;
      const r = m as Record<string, unknown>;
      const role: WakeRole | null = r.role === "first" || r.role === "second" ? r.role : null;
      const ms = MODEL_STATES.find((s) => s === r.state);
      if (!role || !ms || models.some((x) => x.role === role)) continue;
      const p = r.progress;
      models.push({ role, state: ms, progress: typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1 ? p : null });
    }
  }
  const reason = REASONS.find((x) => x === o.reason) ?? null;
  return { state, models, reason };
}

export interface WakeRow { role: WakeRole; label: string; status: string; state: WakeModelState }
export interface WakeView {
  /** "waiting": show rows and the progress line. "scoring": both ready. "partial": result with the warning above it. "stopped": nothing scored, show `warning`. */
  phase: "waiting" | "scoring" | "partial" | "stopped";
  rows: WakeRow[];
  line: string;
  warning: string | null;
}

const ROLES: readonly WakeRole[] = ["first", "second"];
function rowsOf(w: Wake): WakeRow[] {
  return ROLES.map((role) => {
    const state = w.models.find((m) => m.role === role)?.state ?? "waiting";
    return { role, label: WAKE_LABEL[role], status: WAKE_STATUS[state], state };
  });
}

/** The pure state reducer: a wake block -> what the page shows. */
export function wakeView(w: Wake): WakeView {
  const rows = rowsOf(w);
  const first = rows[0].state;
  const second = rows[1].state;
  switch (w.state) {
    case "ready":
      return { phase: "scoring", rows, line: WAKE_DONE_BOTH, warning: null };
    case "partial":
      return { phase: "partial", rows, line: "", warning: WAKE_WARN_SECOND_FAILED };
    case "failed":
    case "timeout": {
      const timeout = w.state === "timeout" || w.reason === "start_timeout";
      if (w.reason === "first_judge_unavailable" && second !== "failed") return { phase: "stopped", rows, line: "", warning: WAKE_WARN_FIRST_FAILED };
      return { phase: "stopped", rows, line: "", warning: failBothLine(timeout) };
    }
    default: {
      const line = first === "ready" && second !== "ready" ? WAKE_PROGRESS_FIRST_READY : second === "ready" && first !== "ready" ? WAKE_PROGRESS_SECOND_READY : WAKE_PROGRESS_ALL;
      return { phase: "waiting", rows, line, warning: null };
    }
  }
}

/** A poll that cannot be read or answered (S10). */
export const WAKE_UNREADABLE_VIEW: WakeView = { phase: "stopped", rows: [], line: "", warning: WAKE_POLL_ERROR };
export { WAKE_FAIL_BOTH };
