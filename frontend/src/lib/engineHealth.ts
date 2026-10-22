"use client";

import { useEffect, useState } from "react";

import { health } from "@/lib/api";

/** What the engine's public /api/health says right now (app#519): never cached across reads, never stale. */
export type EngineRead = { kind: "loading" } | { kind: "ok"; version: string } | { kind: "down" };

/** Reads /api/health once on mount. ok:true with a version string = ok; any failure, a timeout, ok:false or a body without a version = down (the page never shows a version it did not just read). */
export function useEngineRead(): EngineRead {
  const [read, setRead] = useState<EngineRead>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    const load = (): void => {
      health()
        .then((h) => { if (live) setRead(h.ok === true && typeof h.version === "string" && h.version !== "" ? { kind: "ok", version: h.version } : { kind: "down" }); })
        .catch(() => { if (live) setRead({ kind: "down" }); });
    };
    // A hidden tab makes no health read (#323): wait until it is shown.
    if (document.hidden) {
      const onShow = (): void => { if (!document.hidden) { document.removeEventListener("visibilitychange", onShow); load(); } };
      document.addEventListener("visibilitychange", onShow);
      return () => { live = false; document.removeEventListener("visibilitychange", onShow); };
    }
    load();
    return () => { live = false; };
  }, []);
  return read;
}
