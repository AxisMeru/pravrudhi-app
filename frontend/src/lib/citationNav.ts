import { CITATIONS_GO_LABEL } from "./workspace";
// The Citation check nav and palette entries (#75 item 3). The engine tells the client nothing about whether its citation index is set, so the
// entries are offered only when the build says so: NEXT_PUBLIC_CITATION_NAV=1, turned on together with the product-status flag, only after the
// index is set in production. The page itself stays reachable by URL and answers a 503 with the signed "index not available" sentence.
export const CITATION_NAV_ENABLED = process.env.NEXT_PUBLIC_CITATION_NAV === "1";

export function citationNavOffered(href: string, enabled: boolean = CITATION_NAV_ENABLED): boolean {
  return enabled || href !== "/citations";
}

// The Case citations panel under a Screening result (L2A/Lead-2, 15 Oct, explorer gap review): shown only on a build that serves the citation check
// (the nav flag) AND answers existence only (NEXT_PUBLIC_CITATION_EXISTENCE_ONLY=1). With either off it says "preview: existence check only", asks for
// "|" quotes and surfaces an unmapped 422, so it is not rendered at all.
export const CITATIONS_PANEL_ENABLED = CITATION_NAV_ENABLED && process.env.NEXT_PUBLIC_CITATION_EXISTENCE_ONLY === "1";

export function citationsPanelOffered(nav: boolean = CITATION_NAV_ENABLED, existenceOnly: boolean = process.env.NEXT_PUBLIC_CITATION_EXISTENCE_ONLY === "1"): boolean {
  return nav && existenceOnly;
}

// /citations on a build that does not serve the check (nav flag off): the page is a notice and a way back, never a form and never "not yet served" (Lead-2, 15 Oct). The sentence is R1's signed
// guide wording for a build with no citation check; the link label is a plain way back (R1 to confirm).
export const CITATION_NOT_OFFERED_TEXT = "A citation check is not offered in this version of the app.";
export const CITATION_NOT_OFFERED_LINK = CITATIONS_GO_LABEL; // "Go to Matter workspace": the workspace's one name (lib/workspace.ts)
