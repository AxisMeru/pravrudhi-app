"use client";

import { useSyncExternalStore } from "react";

import { THEME_LABELS } from "@/lib/navCopy";
import { THEME_CHOICES, readTheme, saveTheme, type ThemeChoice } from "@/lib/theme/theme";

/**
 * Light / Dark / System, in the sidebar footer. The stored choice is read through useSyncExternalStore with a null server snapshot, so the server-rendered markup and the first client render agree
 * (no hydration mismatch); until then nothing is marked as selected. The page itself never waits for this: the head script has already set the theme.
 */
const EVENT = "pravrudhi-theme-change";
function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ThemeSwitch() {
  // The server snapshot is null (nothing selected), so the server markup and the first client render agree; the stored choice appears right after.
  const choice: ThemeChoice | null = useSyncExternalStore(subscribe, readTheme, () => null);
  return (
    <div role="group" aria-label={THEME_LABELS.groupAria} data-testid="theme-switch" className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-[var(--color-text-dim)]">{THEME_LABELS.heading}</div>
      <div className="flex gap-1">
        {THEME_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={choice === c}
            data-testid={`theme-${c}`}
            onClick={() => {
              saveTheme(c);
              window.dispatchEvent(new Event(EVENT));
            }}
            className={`flex-1 rounded-md border px-2 py-1 text-xs max-md:min-h-11 ${
              choice === c
                ? "border-[var(--color-accent)] bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                : "border-[var(--color-control-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-hover)]"
            }`}
          >
            {THEME_LABELS[c]}
          </button>
        ))}
      </div>
    </div>
  );
}
