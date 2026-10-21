"use client";

import { useEffect, useState } from "react";

import { isSignedIn } from "@/lib/api";

/**
 * True only when the engine says, clearly, that nobody is signed in (a 401, or an engine with no identity route). Anything else (signed in, an error, a dropped connection) is false, so a signed-in
 * person is never shown a sign-in line that is not their situation (#223 D4; the same rule as the assistant entry, #125).
 * Disabled (the arm without the existence-only line) it makes no identity request at all (R2, #228).
 */
export function useSignedOut(enabled: boolean): boolean {
  return useSessionCheck(enabled).signedOut;
}

/** How long the identity call may take before the check is over and counted as "could not be verified" (R2, #499: a slow call must not leave the area empty with no end). */
export const SESSION_CHECK_TIMEOUT_MS = 8000;

/**
 * The same check with its completion visible. `state` is "checking" until the identity call has come back (immediately "in" when disabled so a disabled check offers nothing new), then "out" (a clear 401, or an engine
 * with no identity route: the earlier rule), "in", or "unverified" (a 5xx, 403, a dropped connection or the timeout: the call gave no answer). A page that offers buttons only to a signed-in visitor renders none of them,
 * and no sign-in line, while "checking", so neither the server-rendered HTML nor the first client paint shows a button the visitor may then lose (R1 D50B_LIVE_RENDER db7f6b1e611f); "unverified" shows one neutral line and
 * nothing else (R1 on #499: the signed-out line can be false for someone signed in, and the signed-in actions cannot be vouched for). The call is bounded by SESSION_CHECK_TIMEOUT_MS and by unmount.
 */
export type SessionCheckState = "checking" | "in" | "out" | "unverified";
export function useSessionCheck(enabled: boolean): { signedOut: boolean; checked: boolean; state: SessionCheckState } {
  const [state, setState] = useState<SessionCheckState>("checking");
  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    let over = false;
    const finish = (v: boolean | null) => { if (over) return; over = true; clearTimeout(timer); setState(v === true ? "in" : v === false ? "out" : "unverified"); };
    const timer = setTimeout(() => { finish(null); ac.abort(); }, SESSION_CHECK_TIMEOUT_MS);
    isSignedIn(ac.signal).then((v) => finish(v), () => finish(null));
    return () => { over = true; clearTimeout(timer); ac.abort(); };
  }, [enabled]);
  return { signedOut: enabled && state === "out", checked: !enabled || state !== "checking", state: enabled ? state : "in" };
}
