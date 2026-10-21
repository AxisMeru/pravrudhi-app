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

/**
 * The same check with its completion visible: `checked` is false until the identity call has come back (any answer, an error included; immediately true when disabled). A page that offers buttons only to a signed-in
 * visitor renders none of them, and no sign-in line, while `checked` is false, so neither the server-rendered HTML nor the first client paint shows a button the visitor may then lose (R1 D50B_LIVE_RENDER db7f6b1e611f).
 */
export function useSessionCheck(enabled: boolean): { signedOut: boolean; checked: boolean } {
  const [out, setOut] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    isSignedIn(ac.signal).then((v) => { setOut(v === false); setDone(true); }, () => { if (!ac.signal.aborted) setDone(true); });
    return () => ac.abort();
  }, [enabled]);
  return { signedOut: out && enabled, checked: !enabled || done };
}
