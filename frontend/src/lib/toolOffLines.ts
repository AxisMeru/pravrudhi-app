// R1's per-tool "switched off" lines (r1-seat2/TOOL_OFF_LINES_R1_2026-10-21.md sha12 27fd5ce28704, Researcher's sample-matter review bd16f56e98d6, finding 6): shown ONLY when the engine answers 404 for the route
// (its flag is off); a matter that is gone keeps its own line (the page checks the list route first). Same words as the signed toolsOffLine ("not switched on in this deployment"). Hashes are pinned in toolOffLines.spec.ts.
export const TOOL_OFF_FALLBACK = "This tool is not switched on in this deployment.";

/** Engine route -> R1's line for that tool. A route not listed here falls back to TOOL_OFF_FALLBACK. */
export const TOOL_OFF_BY_ROUTE: Readonly<Record<string, string>> = {
  "/matter-spans/matters": "Papers for a matter is not switched on in this deployment.",
  "/matter-spans/documents": "Papers for a matter is not switched on in this deployment.",
  "/chronology": "Chronology is not switched on in this deployment.",
  "/review-agenda": "Review agenda is not switched on in this deployment.",
  "/matter-citation-sweep": "Citation sweep is not switched on in this deployment.",
  "/quashing-agenda": "Quashing agenda is not switched on in this deployment.",
  "/cheque-case-check": "Cheque case check is not switched on in this deployment.",
  "/matter-hearing-pack": "Hearing pack is not switched on in this deployment.",
  "/s138-checklist": "Section 138 checklist is not switched on in this deployment.",
  "/bail-draft": "Drafting the grounds is not switched on in this deployment.",
  "/synopsis-dates": "Drafting the synopsis and list of dates is not switched on in this deployment.",
};

export const toolOffLine = (route: string): string => TOOL_OFF_BY_ROUTE[route] ?? TOOL_OFF_FALLBACK;
