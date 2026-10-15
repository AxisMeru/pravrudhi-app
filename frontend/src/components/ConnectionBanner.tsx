"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { apiBase, health, isAbortError } from "@/lib/api";
import { isHostedBuild } from "@/lib/serviceStatus";

/**
 * What the top of the page says about where its data comes from.
 *
 * From a hosted origin with no engine named, every check fails and the banner stays up; that is the honest state of a web
 * door without a hosted engine yet, not an error in the page.
 */
export function ConnectionBanner() {
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeouts = 0; // consecutive reads that gave NO answer within the timeout (#312): one slow read (an engine just started) is not "not answering"; two in a row are

    async function check() {
      if (document.hidden) return; // a hidden tab does not poll (#312); it checks again the moment it is shown
      try {
        await health();
        timeouts = 0;
        if (!cancelled) setReachable(true);
      } catch (e) {
        if (isAbortError(e) && ++timeouts < 2) return; // the first unanswered read changes nothing; the 5 s poll reads again
        if (!isAbortError(e)) timeouts = 0;
        if (!cancelled) setReachable(false);
      }
    }

    check();
    const id = setInterval(check, 5000);
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (reachable) return null;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-5 py-2 text-sm text-[var(--color-danger)]">
      <AlertTriangle size={14} />
      <span>
        {isHostedBuild() ? (
          <>The hosted engine is not answering right now. It may be outside its service hours; try again later.</>
        ) : (
          <>
            No engine reachable at {apiBase() || window.location.origin}. Start one with <code>pravrudhi app</code>.
          </>
        )}
      </span>
    </div>
  );
}
