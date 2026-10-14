"use client";

import { useEffect, useState } from "react";

import { health } from "@/lib/api";
import { readAssistantTier, type AssistantTier } from "@/lib/assistantTier";

const POLL_MS = 60_000;

/** The assistant tier for this page. `loaded` means the engine ANSWERED a health read; until then, and after a failed or timed-out read, the tier is "unavailable" with `loaded: false` (greyed, no paused line), so a slow or failed read never enables a feature. */
export function useAssistantTier(): { tier: AssistantTier; loaded: boolean } {
  const [state, setState] = useState<{ tier: AssistantTier; loaded: boolean }>({ tier: "unavailable", loaded: false });
  useEffect(() => {
    let off = false;
    const poll = () => readAssistantTier(health).then((r) => !off && setState({ tier: r.tier, loaded: r.answered }));
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => {
      off = true;
      clearInterval(t);
    };
  }, []);
  return state;
}
