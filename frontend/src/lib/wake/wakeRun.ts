// Cold start with progress (#1038, engine 0.6.31 contract): start + poll orchestration as a pure function over injected IO (no fetch here, so it is unit-testable with a fake clock).
// The engine no longer runs the screening for the user: the page polls the user's wake status and, when both judges are ready (or the second failed and a ticket was issued), ITSELF sends the normal screening.
// Fail-closed: anything unreadable or unanswered ends as a "stopped" view with nothing scored; a screening is allowed only after ready, or after partial with a ticket.
import { parseWakeBody, wakeView, WAKE_UNREADABLE_VIEW, type Wake, type WakeView } from "./wake";
import { failBothLine } from "./wakeCopy";

export type WakeStart = { kind: "not_allowed" } | { kind: "started"; body: unknown };
export interface WakeIO {
  /** POST /analyse-facts/wake: 503 not_allowed (or any other answer) -> not_allowed; 202/200 -> started with the status body. */
  start: () => Promise<WakeStart>;
  /** GET /analyse-facts/wake/status (keyed by the signed-in user). Throws on a failed read. */
  poll: () => Promise<unknown>;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Called with the view after the start answer and after each poll. */
  onView: (v: WakeView) => void;
  signal?: AbortSignal;
  /** Skip the start call: a wake this page already began and may still be open is followed, never started a second time (the user has a daily cap and a cooldown). */
  resume?: boolean;
  /** The page's own limit when the engine gives no deadline. */
  maxMs?: number;
  now?: () => number;
}
export type WakeOutcome = { kind: "not_allowed" } | { kind: "ready"; ticket: string | null } | { kind: "partial"; ticket: string | null } | { kind: "stopped"; view: WakeView; terminal: boolean };

const MIN_POLL_S = 2;
const MAX_POLL_S = 10;
const DEFAULT_POLL_S = 5;
const MAX_POLL_FAILURES = 3;
/** app#549 (R2): just above the engine's 570 s wake deadline (+ DEADLINE_MARGIN_S), below the 900 s lease: the 32B's 444-449 s start fits with slack and a slower one is not cut off at 480 s. */
export const DEFAULT_MAX_MS = 600_000;
const DEADLINE_MARGIN_S = 30;

export async function runWake(io: WakeIO): Promise<WakeOutcome> {
  const now = io.now ?? Date.now;
  const began = now();
  const cur: { wake: Wake | null; ticket: string | null } = { wake: null, ticket: null };
  let limitMs = io.maxMs ?? DEFAULT_MAX_MS;
  const see = (body: unknown): WakeOutcome | null => {
    const p = parseWakeBody(body);
    if (!p.wake) return null;
    cur.wake = p.wake;
    if (p.ticket) cur.ticket = p.ticket;
    if (p.wake.deadlineS !== null) limitMs = Math.min(limitMs, (p.wake.deadlineS + DEADLINE_MARGIN_S) * 1000);
    const v = wakeView(p.wake);
    io.onView(v);
    if (p.wake.state === "ready") return { kind: "ready", ticket: cur.ticket };
    if (p.wake.state === "partial") return { kind: "partial", ticket: cur.ticket };
    if (v.phase === "stopped") return { kind: "stopped", view: v, terminal: true };
    return null;
  };
  if (!io.resume) {
    const st = await io.start();
    if (st.kind === "not_allowed") return { kind: "not_allowed" };
    const first = see(st.body);
    if (first) return first;
    if (!cur.wake) return stop(WAKE_UNREADABLE_VIEW, io);
  }
  let failures = 0;
  for (;;) {
    if (io.signal?.aborted) throw new DOMException("cancelled", "AbortError");
    if (now() - began > limitMs) return stop({ phase: "stopped", rows: cur.wake ? wakeView(cur.wake).rows : [], line: "", warning: failBothLine(true) }, io);
    const every = Math.min(MAX_POLL_S, Math.max(MIN_POLL_S, cur.wake?.pollAfterS ?? DEFAULT_POLL_S)) * 1000;
    await io.sleep(every, io.signal);
    let body: unknown;
    try {
      body = await io.poll();
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "AbortError") throw e;
      // the status is allowlist-gated like the start: a user who may not wake reads 503 not_allowed (never a state): today's refusal stands
      if ((e as { name?: string } | null)?.name === "WakeNotAllowedError") return { kind: "not_allowed" };
      if (++failures >= MAX_POLL_FAILURES) return stop(WAKE_UNREADABLE_VIEW, io);
      continue;
    }
    if (!parseWakeBody(body).wake) {
      if (++failures >= MAX_POLL_FAILURES) return stop(WAKE_UNREADABLE_VIEW, io);
      continue;
    }
    failures = 0;
    const out = see(body);
    if (out) return out;
  }
}

function stop(view: WakeView, io: WakeIO): WakeOutcome {
  io.onView(view);
  return { kind: "stopped", view, terminal: false };
}
