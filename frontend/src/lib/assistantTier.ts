// The assistant tier (AxisMeru/pravrudhi-app#122; L2A, 14 Oct): the engine's /api/health says whether the assistant features (the frontier reader, the A0/CMA entry) may be used.
// FAIL CLOSED: the tier is "available" only when the engine says so, in so many words. A field that is absent (an older engine), a malformed one, "unavailable" with any reason,
// or a health call that fails or times out all read as "unavailable": the assistant features are greyed. The paused line says screening works as normal, so it is shown only when the
// engine ANSWERED (field absent or unavailable), never when the read failed. The reason code is never shown.

export const ASSISTANT_PAUSED_TEXT = "The assistant features are paused; screening works as normal";

export type AssistantTier = "available" | "unavailable";

/** The tier a health answer states. Anything but an explicit `assistant_tier.state === "available"` is "unavailable". */
export function assistantTierOf(health: unknown): AssistantTier {
  if (typeof health !== "object" || health === null) return "unavailable";
  const tier = (health as { assistant_tier?: unknown }).assistant_tier;
  if (typeof tier !== "object" || tier === null) return "unavailable";
  return (tier as { state?: unknown }).state === "available" ? "available" : "unavailable";
}

/**
 * The tier after a health read that may have failed. `answered` is true only when the engine answered: the paused line ("...screening works as normal") is shown only then.
 * A failed or timed-out read is still "unavailable" (the features stay greyed) but `answered` is false and no line is shown: the service-status notice covers an unreachable engine.
 */
export async function readAssistantTier(read: () => Promise<unknown>, timeoutMs = 8_000): Promise<{ tier: AssistantTier; answered: boolean }> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("health read timed out")), timeoutMs));
    return { tier: assistantTierOf(await Promise.race([read(), timeout])), answered: true };
  } catch {
    return { tier: "unavailable", answered: false };
  }
}
