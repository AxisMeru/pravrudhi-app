// Navigation and appearance labels of Pravrudhi-Nyaya (13 Oct 2026). Labels only: every route path stays as it was. R1 reads this file once; the wording audit scans it.
export const THEME_LABELS = {
  heading: "Appearance",
  groupAria: "Colour theme",
  light: "Light",
  dark: "Dark",
  system: "System",
} as const;

/** The sidebar's group headings. */
export const NAV_GROUP_LABELS = { work: "Work", reference: "Reference", account: "Account", studio: "Studio" } as const;

/** Item labels of the firm surface; the paths do not change. R1 reads this list once (13 Oct 2026: "Offence rules" for /matters). */
export const NAV_LABELS = {
  screening: "Screening",
  matters: "Offence rules",
  citations: "Citation check",
  workflows: "Workflows",
  dataHandling: "Data handling",
  settings: "Settings",
  safety: "Safety record",
  benchmarks: "Benchmarks",
  demo: "How it works",
  howBuilt: "How it was built",
} as const;
