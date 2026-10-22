import { ASSISTANT_SESSION_BILLED_CODE, ASSISTANT_SESSION_BILLED_LINE } from "./assistantBilled";
import { INTERNAL_ERROR_LINE, internalErrorLine, isInternalError } from "./internalError";
import { ApiError, apiBase, engineFetch, hasWebSession, health, isAbortError, isHostedEngine, IS_DEMO } from "./api";
import { CODED_ERROR_TEXT, SERVICE_ERROR_TEXT, SESSION_401_TEXT } from "./signedStrings";
import { INVALID_ENGINE_ANSWER_TEXT, NOT_SIGNED_IN_TEXT, SIGN_IN_UNVERIFIED_TEXT } from "./surfaceCopy";

export interface ServiceWindowStatus {
  timezone: string;
  open: string;
  close: string;
  enforced: boolean;
  open_now: boolean;
  next_open_utc: string | null;
}

export interface ServiceStatus {
  engine_version: string;
  service_window: ServiceWindowStatus | null;
  judge: { state: "ready" | "warming" | "unavailable" | "unknown"; checked_at: string | null };
  /** Engine 0.6.24 (engine #571): which workflows are switched on, by their wf_* flag id. Absent on an older engine. Flags only, no secret. */
  workflows?: Record<string, boolean>;
}

export type StatusResult =
  | { kind: "ok"; status: ServiceStatus }
  | { kind: "offline" }
  | { kind: "unknown" };

export const STATUS_TIMEOUT_MS = 8_000;

// GET /api/v1/status is the single source of truth for whether the hosted engine is inside its service window.
// A dead network or a gateway error page (not JSON) is "offline"; an engine that predates the route (404) is
// "unknown" and must never block the form. Only a network failure, a timeout or a 5xx means offline; any other
// 4xx or a body that is not the status JSON (e.g. an SPA fallback page) is "unknown", so the form stays usable.
/**
 * The keyed GET /api/v1/status is asked only where it can answer: a visitor with no web session on a HOSTED engine would be refused (401 in the console of every page), so for that visitor the app
 * uses the public reachability read it already has (GET /api/health) and treats the service window as unknown, which never closes the form (Lead-2, 15 Oct: no keyed status for anonymous visitors).
 * A signed-in visitor, and any visitor of an engine that serves the page itself, still read the status.
 */
export function statusNeedsKey(hosted: boolean, signedIn: boolean): boolean {
  return !hosted || signedIn;
}

async function publicReachability(): Promise<StatusResult> {
  try {
    await health();
    return { kind: "unknown" };
  } catch (e) {
    // a read that gave no answer in time (#312) is inconclusive, like a 4xx: it never closes the form ("unknown"); only a refusal or a failed connection is "offline"
    if (isAbortError(e)) return { kind: "unknown" };
    return e instanceof ApiError && e.status < 500 ? { kind: "unknown" } : { kind: "offline" };
  }
}

export async function fetchServiceStatus(): Promise<StatusResult> {
  if (IS_DEMO) return { kind: "unknown" };
  if (!statusNeedsKey(isHostedEngine(), await hasWebSession())) return publicReachability();
  try {
    const res = await engineFetch(`${apiBase()}/api/v1/status`, {
      cache: "no-store",
      authOptional: true,
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    if (res.status >= 500) return { kind: "offline" };
    if (!res.ok) return { kind: "unknown" };
    try {
      const body = (await res.json()) as ServiceStatus;
      if (body === null || typeof body !== "object" || !("service_window" in body)) return { kind: "unknown" };
      return { kind: "ok", status: body };
    } catch {
      return { kind: "unknown" };
    }
  } catch {
    return { kind: "offline" };
  }
}

/**
 * The app closes the form ONLY when the engine really enforces its service window and it is outside it: `enforced === true && open_now === false`. The engine reports its window
 * (production: 09:00-21:00 London) even when it does not enforce it (`enforced: false`, it answers 24/7), and `open_now` alone would disable Screening after 21:00 although the engine
 * would still answer (Lead-2/L2A, 14 Oct). A missing window, or `enforced` that is not exactly true, never closes the form.
 */
export function isClosed(s: ServiceStatus): boolean {
  const w = s.service_window;
  return w?.enforced === true && w.open_now === false;
}

function hhmmIn(utcIso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(new Date(utcIso));
}

// The service window is configured in the engine's timezone; the visitor sees it in their own.
export function formatNextOpen(w: ServiceWindowStatus, viewerTz: string = Intl.DateTimeFormat().resolvedOptions().timeZone, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const wall = (hhmm: string): string => {
    // Resolve today's wall-clock HH:MM in the engine timezone to an instant, then render it in the viewer zone.
    for (let off = -14 * 60; off <= 14 * 60; off += 15) {
      const [h, m] = hhmm.split(":").map(Number);
      const t = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h, m) - off * 60_000;
      const got = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: w.timezone }).format(new Date(t));
      if (got === hhmm) return hhmmIn(new Date(t).toISOString(), viewerTz);
    }
    return hhmm;
  };
  return `${wall(w.open)}–${wall(w.close)} (${viewerTz})`;
}

export type AnalyseErrorKind =
  | "timeout"
  | "cancelled"
  | "rate_limited"
  | "signed_out"
  | "not_signed_in"
  | "sign_in_unverified"
  | "judge_unavailable"
  | "service_config_missing"
  | "assistant_session_billed"
  | "agent_at_capacity"
  | "agent_unavailable"
  | "judges_offline"
  | "judges_warming"
  | "invalid_answer"
  | "outside_window"
  | "server"
  | "network";

export interface ClassifiedError {
  kind: AnalyseErrorKind;
  message: string;
  retryAfter?: number;
  /** Only for invalid_answer: the run id the unreadable answer carried, if it had one. */
  runId?: string | null;
}

export function classifyAnalyseError(e: unknown, internalLine: string | null = INTERNAL_ERROR_LINE): ClassifiedError {
  const name = (e as { name?: string } | null)?.name;
  if (name === "TimeoutError") {
    return { kind: "timeout", message: "The analysis models did not answer in time, so we stopped waiting. They may be switched off at the moment. No result was returned. Try again later." };
  }
  if (name === "AbortError") return { kind: "cancelled", message: "Analysis cancelled." };
  if (name === "NotSignedInError") return { kind: "not_signed_in", message: NOT_SIGNED_IN_TEXT };
  if (name === "InvalidEngineAnswerError") return { kind: "invalid_answer", message: INVALID_ENGINE_ANSWER_TEXT, runId: (e as { runId?: string | null }).runId ?? null };
  if (name === "SignInUnverifiedError") return { kind: "sign_in_unverified", message: SIGN_IN_UNVERIFIED_TEXT };
  if (e instanceof ApiError) {
    if (e.status === 429) {
      // Signed sentence verbatim; the seconds the engine asked for follow it, since the signed text says "the number of seconds shown".
      const wait = e.retryAfter ? ` Seconds to wait: ${e.retryAfter}.` : "";
      return { kind: "rate_limited", message: `${SERVICE_ERROR_TEXT.rate_limited}${wait}`, retryAfter: e.retryAfter };
    }
    if (e.status === 401) return { kind: "signed_out", message: SESSION_401_TEXT };
    if (e.status === 503 && e.code === "outside_service_window") {
      return { kind: "outside_window", message: SERVICE_ERROR_TEXT.outside_service_window, retryAfter: e.retryAfter };
    }
    // The engine reads the judges' endpoint limit and says so (pravrudhi #312): parked on purpose, so nothing to wait for.
    if (e.status === 503 && e.code === "judges_offline") {
      return { kind: "judges_offline", message: SERVICE_ERROR_TEXT.judges_offline };
    }
    if (e.status === 503 && e.code === "judge_unavailable" && e.reason === "judges_warming") {
      // Signed: "... Try again after the number of seconds shown." With no Retry-After there is no number to show, so the
      // two sentences before it are used alone.
      const full = SERVICE_ERROR_TEXT.judges_warming;
      const message = e.retryAfter ? `${full} Seconds to wait: ${e.retryAfter}.` : full.slice(0, full.indexOf(" Try again after")).trim();
      return { kind: "judges_warming", message, retryAfter: e.retryAfter };
    }
    if (e.status === 503 && e.code === "judge_unavailable") {
      return { kind: "judge_unavailable", message: SERVICE_ERROR_TEXT.judge_unavailable };
    }
    if (e.status === 503 && e.code === "agent_at_capacity") return { kind: "agent_at_capacity", message: CODED_ERROR_TEXT.agent_at_capacity };
    if (e.status === 503 && e.code === "agent_unavailable") return { kind: "agent_unavailable", message: CODED_ERROR_TEXT.agent_unavailable };
    if (e.status === 503 && e.code === "service_config_missing") {
      return { kind: "service_config_missing", message: SERVICE_ERROR_TEXT.service_config_missing };
    }
    if (e.status === 502 && e.code === ASSISTANT_SESSION_BILLED_CODE) return { kind: "assistant_session_billed", message: ASSISTANT_SESSION_BILLED_LINE };
    const generic = `The engine answered with an error (HTTP ${e.status}). Nothing was scored.`;
    return { kind: "server", message: isInternalError(e) ? internalErrorLine(generic, internalLine) : generic };
  }
  return { kind: "network", message: "Could not reach the engine. Check your connection and try again." };
}

// A hosted build names a Supabase project (or is the static demo); a local `pravrudhi app` install does not.
export function isHostedBuild(): boolean {
  return IS_DEMO || !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}
