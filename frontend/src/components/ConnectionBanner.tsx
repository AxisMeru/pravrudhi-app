"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { apiBase, health } from "@/lib/api";

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

    async function check() {
      try {
        await health();
        if (!cancelled) setReachable(true);
      } catch {
        if (!cancelled) setReachable(false);
      }
    }

    check();
    const id = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (reachable) return null;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-5 py-2 text-sm text-[var(--color-danger)]">
      <AlertTriangle size={14} />
      <span>
        No engine reachable at {apiBase() || window.location.origin}. Start one with <code>pravrudhi app</code>.
      </span>
    </div>
  );
}
