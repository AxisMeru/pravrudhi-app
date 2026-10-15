"use client";

import { useEffect, useState } from "react";

import { isSignedIn } from "@/lib/api";

/**
 * True only when the engine says, clearly, that nobody is signed in (a 401, or an engine with no identity route). Anything else (signed in, an error, a dropped connection) is false, so a signed-in
 * person is never shown a sign-in line that is not their situation (#223 D4; the same rule as the assistant entry, #125).
 * Disabled (the arm without the existence-only line) it makes no identity request at all (R2, #228).
 */
export function useSignedOut(enabled: boolean): boolean {
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    isSignedIn(ac.signal).then((v) => setOut(v === false), () => {});
    return () => ac.abort();
  }, [enabled]);
  return out && enabled;
}
