import { ApiError, apiBase, engineFetch, IS_DEMO } from "./api";

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
  judge: { state: "ready" | "unavailable" | "unknown"; checked_at: string | null };
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
export async function fetchServiceStatus(): Promise<StatusResult> {
  if (IS_DEMO) return { kind: "unknown" };
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

export function isClosed(s: ServiceStatus): boolean {
  return s.service_window?.open_now === false;
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
  | "judge_unavailable"
  | "outside_window"
  | "server"
  | "network";

export interface ClassifiedError {
  kind: AnalyseErrorKind;
  message: string;
  retryAfter?: number;
}

export function classifyAnalyseError(e: unknown): ClassifiedError {
  const name = (e as { name?: string } | null)?.name;
  if (name === "TimeoutError") {
    return { kind: "timeout", message: "The analysis took longer than the time we allow and was stopped. The engine may be warming up; try again in a minute." };
  }
  if (name === "AbortError") return { kind: "cancelled", message: "Analysis cancelled." };
  if (e instanceof ApiError) {
    if (e.status === 429) {
      const wait = e.retryAfter ? ` Try again in ${e.retryAfter} seconds.` : " Try again shortly.";
      return { kind: "rate_limited", message: `Too many requests.${wait}`, retryAfter: e.retryAfter };
    }
    if (e.status === 401) return { kind: "signed_out", message: "Your session has ended. Sign in again to run an analysis." };
    if (e.status === 503 && e.code === "outside_service_window") {
      return { kind: "outside_window", message: "The hosted demo is outside its service hours.", retryAfter: e.retryAfter };
    }
    if (e.status === 503 && e.code === "judge_unavailable") {
      return { kind: "judge_unavailable", message: "The analysis model is starting up or unavailable. Nothing was scored. Try again in a minute or two." };
    }
    return { kind: "server", message: `The engine answered with an error (HTTP ${e.status}). Nothing was scored.` };
  }
  return { kind: "network", message: "Could not reach the engine. Check your connection and try again." };
}

// A hosted build names a Supabase project (or is the static demo); a local `pravrudhi app` install does not.
export function isHostedBuild(): boolean {
  return IS_DEMO || !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}
