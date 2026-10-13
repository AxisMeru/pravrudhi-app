// The colour theme choice: "light", "dark" or "system" (follow the operating system). It is the one thing the theme feature keeps in the browser, under THEME_KEY in
// localStorage. "system" is stored by REMOVING the key, so the page follows prefers-color-scheme. All reads and writes are wrapped: storage can be unavailable.

export type ThemeChoice = "light" | "dark" | "system";
export const THEME_KEY = "pravrudhi-theme";
export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "system"];

export function parseTheme(raw: string | null | undefined): ThemeChoice {
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function readTheme(): ThemeChoice {
  try {
    return parseTheme(window.localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

/** Sets or clears data-theme on <html> (no attribute = follow the system). */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function saveTheme(choice: ThemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* storage unavailable (private mode, quota): the choice applies for this page only */
  }
  applyTheme(choice);
}

/** The inline script that runs in <head> before first paint, so a stored choice never flashes the wrong theme. Kept to ES5 and wrapped in try/catch. */
export const THEME_INIT_SCRIPT =
  "(function(){try{var t=window.localStorage.getItem('" + THEME_KEY + "');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();";
