"use client";

import { useEffect, useState } from "react";

import { health } from "@/lib/api";
import { readAssistantTier, type AssistantTier } from "@/lib/assistantTier";

const POLL_MS = 60_000;

/** The assistant tier for this page. Until the first read lands it is "unavailable" with `loaded: false` (greyed, and the paused line is not shown yet), so a slow or failed read never enables a feature. */
export function useAssistantTier(): { tier: AssistantTier; loaded: boolean } {
  const [state, setState] = useState<{ tier: AssistantTier; loaded: boolean }>({ tier: "unavailable", loaded: false });
  useEffect(() => {
    let off = false;
    const poll = () => readAssistantTier(health).then((tier) => !off && setState({ tier, loaded: true }));
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => {
      off = true;
      clearInterval(t);
    };
  }, []);
  return state;
}
