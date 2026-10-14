"use client";

import { useEffect, useState } from "react";

import { health } from "@/lib/api";
import { readAssistantState, type AssistantState } from "@/lib/assistantTier";

const POLL_MS = 60_000;

/** The assistant state for this page. Until the first read lands it is "not_configured" (nothing new is shown); a failed or timed-out read is "unreachable" (greyed, no line). */
export function useAssistantState(): AssistantState {
  const [state, setState] = useState<AssistantState>("not_configured");
  useEffect(() => {
    let off = false;
    const poll = () => readAssistantState(health).then((s) => !off && setState(s));
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => {
      off = true;
      clearInterval(t);
    };
  }, []);
  return state;
}
