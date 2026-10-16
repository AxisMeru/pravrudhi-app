"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { THEME_ICON_ARIA, THEME_ICON_TOOLTIP } from "@/lib/navCopy";
import { nextTheme, readTheme, saveTheme, type ThemeChoice } from "@/lib/theme/theme";

/**
 * One icon button, top right: each press moves System -> Light -> Dark -> System. The stored choice is read through useSyncExternalStore with a null server snapshot, so the server markup and the
 * first client render agree (no hydration mismatch); until the choice is known it shows the system strings. The page itself never waits for this: the head script has already set the theme.
 * The choice (System by default) persists per browser through saveTheme.
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

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const BOX = "fixed right-6 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-md border border-[var(--color-control-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-hover)] max-md:h-11 max-md:w-11 print:hidden";

export function ThemeSwitch() {
  // Until the stored choice is read (the null server snapshot) the button shows the system strings, the default.
  const stored: ThemeChoice | null = useSyncExternalStore(subscribe, readTheme, () => null);
  const choice: ThemeChoice = stored ?? "system";
  const Icon = ICONS[choice];
  return (
    <button
      type="button"
      aria-label={THEME_ICON_ARIA[choice]}
      title={THEME_ICON_TOOLTIP[choice]}
      id="theme-button"
      data-testid="theme-button"
      data-theme-choice={choice}
      onClick={() => {
        saveTheme(nextTheme(choice));
        window.dispatchEvent(new Event(EVENT));
      }}
      className={BOX}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
