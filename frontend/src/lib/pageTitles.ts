import { PRODUCT_NAME } from "./productCopy";
import { WORKSPACE_TITLE } from "./workspace";

// R1 (15 Oct, D4): every page has its own <title>, "{page} · Pravrudhi-Nyaya" (WCAG 2.4.2); the home page keeps the product name alone. The page routes name their title here, in layout.tsx files.
export const PAGE_TITLES = {
  signin: "Sign in",
  screening: WORKSPACE_TITLE,
  demo: "How it works",
  workflows: "Workflows",
  dataHandling: "Data handling",
  guide: "User guide",
  howBuilt: "How it was built",
  settings: "Settings",
  partnerKeys: "API access",
  citations: "Case citations",
  matters: "Offence rules",
} as const;

export type PageTitleKey = keyof typeof PAGE_TITLES;

export const pageTitle = (key: PageTitleKey): string => `${PAGE_TITLES[key]} \u00b7 ${PRODUCT_NAME}`;
