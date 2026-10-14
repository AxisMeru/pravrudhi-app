// The assistant tier (AxisMeru/pravrudhi-app#122; L2A, 14 Oct): the engine's /api/health says whether the assistant features (the frontier reader, the A0/CMA entry) may be used.
// FAIL CLOSED: the tier is "available" only when the engine says so, in so many words. A field that is absent (an older engine), a malformed one, "unavailable" with any reason,
// or a health call that fails or times out all read as "unavailable": the assistant features are greyed and screening works as normal. The reason code is never shown.

export const ASSISTANT_PAUSED_TEXT = "The assistant features are paused; screening works as normal";

export type AssistantTier = "available" | "unavailable";

/** The tier a health answer states. Anything but an explicit `assistant_tier.state === "available"` is "unavailable". */
export function assistantTierOf(health: unknown): AssistantTier {
  if (typeof health !== "object" || health === null) return "unavailable";
  const tier = (health as { assistant_tier?: unknown }).assistant_tier;
  if (typeof tier !== "object" || tier === null) return "unavailable";
  return (tier as { state?: unknown }).state === "available" ? "available" : "unavailable";
}

/** The tier after a health read that may have failed (a rejection or a timeout is "unavailable"). */
export async function readAssistantTier(read: () => Promise<unknown>, timeoutMs = 8_000): Promise<AssistantTier> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("health read timed out")), timeoutMs));
    return assistantTierOf(await Promise.race([read(), timeout]));
  } catch {
    return "unavailable";
  }
}
