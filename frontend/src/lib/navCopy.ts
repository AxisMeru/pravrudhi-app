import { WORKSPACE_NAV_LABEL } from "./workspace";
// Navigation and appearance labels of Pravrudhi-Nyaya (13 Oct 2026). Labels only: every route path stays as it was. R1 reads this file once; the wording audit scans it.
/** The one theme button (app#378). R1's exact strings (16 Oct): aria-label and title come from these constants per current choice and nowhere else. */
export const THEME_ICON_ARIA = {
  system: "Colour theme: follows your device setting. Press to use light.",
  light: "Colour theme: light. Press to use dark.",
  dark: "Colour theme: dark. Press to follow your device setting.",
} as const;
export const THEME_ICON_TOOLTIP = {
  system: "Colour theme: device setting",
  light: "Colour theme: light",
  dark: "Colour theme: dark",
} as const;

/** The sidebar's group headings. */
export const NAV_GROUP_LABELS = { work: "Work", reference: "Reference", account: "Account", studio: "Studio" } as const;

/** Item labels of the firm surface; the paths do not change. R1 reads this list once (13 Oct 2026: "Offence rules" for /matters). */
export const NAV_LABELS = {
  screening: WORKSPACE_NAV_LABEL,
  matters: "Offence rules",
  citations: "Citation check",
  workflows: "Workflows",
  matterTools: "Matter tools", // 03c5481ef61b7703 (R1 WEB_UX_POLISH_R1_STRINGS 42e7a5eb51a6): nothing else on the entry, no badge, count or description
  dataHandling: "Data handling",
  settings: "Settings",
  safety: "Safety record",
  benchmarks: "Benchmarks",
  demo: "How it works",
  howBuilt: "How it was built",
} as const;
