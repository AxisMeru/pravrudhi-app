"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { THEME_ICON_ARIA, THEME_ICON_TOOLTIP } from "@/lib/navCopy";
import { nextTheme, readTheme, saveTheme, type ThemeChoice } from "@/lib/theme/theme";

/**
 * One borderless icon button (the sidebar brand row on md and up, the top strip on a phone): each press moves System -> Light -> Dark -> System. The stored choice is read through useSyncExternalStore with a null server snapshot, so the server markup and the
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
// z-[55] from md up: the sidebar is a flex item with z-50, so a lower z-index would put its brand row over the button (the click would land on the brand text).
// One borderless icon, as in a typical app (Advisor Q6, 20 Oct). From md up it sits in the sidebar's brand row (left of the notification bell); on a phone it sits in the top strip the layout reserves
// above every page, opposite the drawer toggle. The icon is small and borderless; the hit area stays 44 px everywhere (Interim lead P3, 16 Oct). One element for both, so there is one button, one id, one test id.
const BOX = "fixed right-3 top-1.5 z-30 md:z-[55] flex h-11 w-11 items-center justify-center rounded-md text-[var(--color-text-dim)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 md:left-[8.75rem] md:right-auto md:top-3 print:hidden";

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
