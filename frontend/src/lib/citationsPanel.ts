// The citations panel's logic, apart from the screen: parse the pasted lines, check them one at a time, and read the coverage the engine reports.
// One citation per line, at most MAX_CITATIONS. A line is `citation` or `citation | quote`. The engine checks ONE citation and the quote to look
// for per call and caps how many lookups run at once, so the checks run in sequence. Statuses and refusal wording come from citationCheck.ts and
// citationCheckRun.ts unchanged; this file adds no status of its own.

import { runCitationCheck, type CitationCheckState } from "./citationCheckRun";

export const MAX_CITATIONS = 10;

/** Shown for a line with no quote until the engine can check existence alone (a quote is required today). Never a status. */
export const NO_QUOTE_TEXT = "Not checked: add the quoted words after a | on the same line.";

/** Shown when the engine's reply carries no recognised coverage. Never a typed-in claim about what the index holds. */
export const COVERAGE_NOT_REPORTED = "Coverage not reported by the engine.";

export interface CitationLine {
  /** 1-based line number in the pasted text, so a row can be matched to the line the user typed. */
  line: number;
  citation: string;
  quote: string | null;
}

export interface ParsedCitations {
  items: CitationLine[];
  /** Non-empty lines beyond MAX_CITATIONS: not checked, and said so. */
  skipped: number;
}

export function parseCitationLines(text: string): ParsedCitations {
  const items: CitationLine[] = [];
  let skipped = 0;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (items.length >= MAX_CITATIONS) {
      skipped += 1;
      return;
    }
    const bar = line.indexOf("|");
    // Never cut: an over-long citation or quote must reach checkInputs, which refuses it with the length message. Cutting here would check a
    // prefix of what the user typed (and a prefix that is found would read VERIFIED). The FIRST bar splits; later bars belong to the quote.
    const citation = (bar === -1 ? line : line.slice(0, bar)).trim();
    const quote = bar === -1 ? "" : line.slice(bar + 1).trim();
    items.push({ line: i + 1, citation, quote: quote || null });
  });
  return { items, skipped };
}

export type RowState = CitationCheckState | { phase: "needs_quote"; message: string };

export interface PanelRow {
  item: CitationLine;
  state: RowState;
}

type Verify = Parameters<typeof runCitationCheck>[0];

/** Checks the items in order, one at a time; `onRow` fires after each so the screen fills as results arrive. A quote-less line is not sent. */
export async function checkCitations(
  verify: Verify,
  items: readonly CitationLine[],
  signal?: AbortSignal,
  onRow?: (rows: PanelRow[]) => void,
): Promise<PanelRow[]> {
  const rows: PanelRow[] = items.map((item) => ({ item, state: { phase: "idle" } as RowState }));
  for (let i = 0; i < rows.length; i += 1) {
    if (signal?.aborted) break;
    const { item } = rows[i];
    if (item.quote === null) {
      rows[i] = { item, state: { phase: "needs_quote", message: NO_QUOTE_TEXT } };
    } else {
      rows[i] = { item, state: { phase: "checking" } };
      onRow?.([...rows]);
      rows[i] = { item, state: await runCitationCheck(verify, item.citation, item.quote, signal) };
    }
    onRow?.([...rows]);
  }
  return rows;
}

/**
 * The coverage line from the engine's own field. The shape is PROVISIONAL until the engine fixes it: a non-empty string is shown as sent;
 * an object with `courts` (strings) and `judgments` (the RESOLVABLE count) is worded from those two facts (and a year range if both ends are numbers);
 * anything else is the fallback. Nothing is ever filled in from this app.
 */
export function coverageLine(coverage: unknown): string {
  if (typeof coverage === "string" && coverage.trim()) return coverage.trim();
  if (coverage && typeof coverage === "object") {
    const c = coverage as { courts?: unknown; judgments?: unknown; year_min?: unknown; year_max?: unknown };
    const courts = Array.isArray(c.courts) && c.courts.length > 0 && c.courts.every((x) => typeof x === "string" && x.trim()) ? (c.courts as string[]) : null;
    const n = typeof c.judgments === "number" && Number.isInteger(c.judgments) && c.judgments >= 0 ? c.judgments : null;
    if (courts && n !== null) {
      const years = typeof c.year_min === "number" && typeof c.year_max === "number" ? ` (${c.year_min} to ${c.year_max})` : "";
      // `judgments` must be the engine's RESOLVABLE count (the judgments a citation can resolve to), not the size of the index (R1, at mounting).
      return `Citations resolve for ${n.toLocaleString("en-GB")} ${courts.join(", ")} judgments${years}; other courts answer not in index, which is no evidence either way.`;
    }
  }
  return COVERAGE_NOT_REPORTED;
}
