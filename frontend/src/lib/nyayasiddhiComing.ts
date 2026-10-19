import { NS_HIDDEN_SPLIT } from "./nyayasiddhiSubmit";
import type { ResultRow } from "./nyayasiddhiRows";

// The "not populated yet" block on /benchmarks (app#429 PR-A, #681): R1's final page strings (NYAYASIDDHI_PAGE_STRINGS_R1_FINAL.txt, sha12 78a4a5d4a1c2), pinned by hash in nyayasiddhiComing.spec.ts.
// The hidden-set sentence is the ONE constant NS_HIDDEN_SPLIT (R1, sha256[:16] be3ec6e37f5180ec). No count, no date, no promise. coming_versions is NOT here: it belongs to the version selector (PR-C).
export const NS_COMING = {
  coming_heading: "Not on this page yet",
  coming_outside: "No outside party has submitted a system yet. Every row here is the organisers' own.",
  coming_status: "Every row so far says reported by the entrant. A row says re-scored or reproduced only after we have done that.",
  coming_rows: "Rows are added here when we have scored and checked them.",
} as const;

/**
 * The lines the block shows, each true of the rows the page actually has. An empty list of rows shows only the heading, the hidden-set sentence and the rows line;
 * the "no outside party" and "self-reported" lines appear only when every shown row is an organiser entry / says self-reported.
 */
export function comingLines(rows: readonly ResultRow[]): string[] {
  const lines: string[] = [];
  if (rows.length > 0 && rows.every((r) => r.organiserEntry)) lines.push(NS_COMING.coming_outside);
  if (rows.length > 0 && rows.every((r) => r.status === "self-reported")) lines.push(NS_COMING.coming_status);
  lines.push(NS_HIDDEN_SPLIT, NS_COMING.coming_rows);
  return lines;
}
