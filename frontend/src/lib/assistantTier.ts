// The assistant tier (AxisMeru/pravrudhi-app#122/#123; Lead-2 and L2A, 14 Oct): the engine's /api/health says whether the assistant features (the frontier reader, the A0/CMA entry) may be used.
// Three states, and users must not see "paused" unless the engine says a CONFIGURED tier is paused:
//  - available: the features behave as before.
//  - paused: the tier is configured but refused or over budget (state "unavailable" with reason upstream_error, quota or budget_floor): the features are greyed and ONE line says so.
//  - not configured (the default): the field is absent (an older engine, production today), malformed, "unavailable" with reason no_key or disabled, or ANY other or unknown reason: nothing new is shown; the features look exactly as they did before this change. The line is never shown from a guess.
//  - unreachable: the health read failed or timed out. Fail closed: the features are greyed (never usable) but NO line is shown, because nothing was answered (R1's rule). The reason code is never shown.

export const ASSISTANT_PAUSED_TEXT = "The assistant features are paused; screening works as normal";

export type AssistantState = "available" | "paused" | "not_configured" | "unreachable";

/** The reasons that mean a configured tier is refused or over budget. Any other reason (no_key, disabled, a new one) is not "paused". */
export const PAUSED_REASONS: readonly string[] = ["upstream_error", "quota", "budget_floor"];

/** Greyed features: a paused tier, or a health read that did not answer. */
export const isGreyed = (s: AssistantState) => s === "paused" || s === "unreachable";

/**
 * What the pages show for a tier state (R1 14 Oct): the paused line and the greying of the assistant-backed workflow row apply ONLY when the assistant is offered (the entry build flag is on).
 * While it is off, the guard pauses can read "paused" once the engine route is on, and a page must never describe or grey a feature that is not offered.
 */
export function pausedTreatment(state: AssistantState, entryOn: boolean): { line: boolean; grey: boolean } {
  return { line: entryOn && state === "paused", grey: entryOn && isGreyed(state) };
}

export function assistantStateOf(health: unknown): AssistantState {
  if (typeof health !== "object" || health === null) return "not_configured";
  const tier = (health as { assistant_tier?: unknown }).assistant_tier;
  if (typeof tier !== "object" || tier === null) return "not_configured";
  const { state, reason } = tier as { state?: unknown; reason?: unknown };
  if (state === "available") return "available";
  if (state === "unavailable" && typeof reason === "string" && PAUSED_REASONS.includes(reason)) return "paused";
  return "not_configured";
}

/**
 * How long to wait before the next health read. A healthy tier keeps the slow poll. A failed or slow read ("unreachable") is retried SOON but not forever at the same pace (Track-B, #311: a flat 5 s retry on top of
 * the connection banner's own poll doubled the request rate while the engine was down): the retry delay doubles per consecutive failure (5, 10, 20, 40 s) up to the 60 s poll, with +-20% jitter so tabs do not
 * line up, and starts over on the first success (the caller resets its failure count).
 */
export const TIER_POLL_MS = 60_000;
export const TIER_RETRY_MS = 5_000;
export const nextTierPollDelay = (state: AssistantState, consecutiveFailures = 1, random = 0.5): number => {
  if (state !== "unreachable") return TIER_POLL_MS;
  const base = Math.min(TIER_POLL_MS, TIER_RETRY_MS * 2 ** Math.max(0, consecutiveFailures - 1));
  return Math.round(base * (0.8 + 0.4 * random));
};

/** The state after a health read that may have failed: a rejection or a timeout is "unreachable" (greyed, no line). */
export async function readAssistantState(read: () => Promise<unknown>, timeoutMs = 8_000): Promise<AssistantState> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("health read timed out")), timeoutMs));
    return assistantStateOf(await Promise.race([read(), timeout]));
  } catch {
    return "unreachable";
  }
}

export interface TierPollerDeps {
  read: () => Promise<AssistantState>;
  onState: (s: AssistantState) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
  random?: () => number;
}

/**
 * The polling loop behind useAssistantState, written without React so it can be tested (R2, #311): one read, then the next after nextTierPollDelay(answer, consecutive failures, jitter); the failure
 * count starts over on a read that answers; stop() cancels the pending timer and ignores a read still in flight. Returns stop.
 */
export function startTierPoller({ read, onState, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t as ReturnType<typeof setTimeout>), random = Math.random }: TierPollerDeps): () => void {
  let off = false;
  let timer: unknown;
  let failures = 0;
  const poll = () =>
    read().then((s) => {
      if (off) return;
      onState(s);
      failures = s === "unreachable" ? failures + 1 : 0;
      timer = setTimer(poll, nextTierPollDelay(s, failures, random()));
    });
  poll();
  return () => {
    off = true;
    if (timer !== undefined) clearTimer(timer);
  };
}

