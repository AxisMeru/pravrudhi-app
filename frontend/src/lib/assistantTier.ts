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

export function assistantStateOf(health: unknown): AssistantState {
  if (typeof health !== "object" || health === null) return "not_configured";
  const tier = (health as { assistant_tier?: unknown }).assistant_tier;
  if (typeof tier !== "object" || tier === null) return "not_configured";
  const { state, reason } = tier as { state?: unknown; reason?: unknown };
  if (state === "available") return "available";
  if (state === "unavailable" && typeof reason === "string" && PAUSED_REASONS.includes(reason)) return "paused";
  return "not_configured";
}

/** The state after a health read that may have failed: a rejection or a timeout is "unreachable" (greyed, no line). */
export async function readAssistantState(read: () => Promise<unknown>, timeoutMs = 8_000): Promise<AssistantState> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("health read timed out")), timeoutMs));
    return assistantStateOf(await Promise.race([read(), timeout]));
  } catch {
    return "unreachable";
  }
}
