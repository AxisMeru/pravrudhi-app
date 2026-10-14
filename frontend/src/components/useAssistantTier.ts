"use client";

import { useEffect, useState } from "react";

import { assistantProvider, health, isSignedIn } from "@/lib/api";
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

/** The provider name for the consent line (GET /api/assistant), read once the tier is available. Null until then and on any failure. */
export function useAssistantProvider(state: AssistantState): string | null {
  const [provider, setProvider] = useState<string | null>(null);
  useEffect(() => {
    if (state !== "available") return;
    let off = false;
    assistantProvider().then((p) => !off && setProvider(p));
    return () => {
      off = true;
    };
  }, [state]);
  return provider;
}

/** Whether this browser is signed in: null until /api/me has answered (nothing is shown or enabled meanwhile), then true or false. Read once. */
export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let off = false;
    isSignedIn().then((v) => !off && setSignedIn(v));
    return () => {
      off = true;
    };
  }, []);
  return signedIn;
}
