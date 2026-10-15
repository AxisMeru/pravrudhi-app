// The citations panel's logic, apart from the screen: parse the pasted lines, check them one at a time, and read the coverage the engine reports.
// One citation per line, at most MAX_CITATIONS. A line is `citation` or `citation | quote`. The engine checks ONE citation and the quote to look
// for per call and caps how many lookups run at once, so the checks run in sequence. Statuses and refusal wording come from citationCheck.ts and
// citationCheckRun.ts unchanged; this file adds no status of its own.

import { CITATION_EXISTENCE_ONLY } from "./citationExistence";
import { runCitationCheck, type CitationCheckState } from "./citationCheckRun";

export const MAX_CITATIONS = 10;
/** #223 D5: the engine allows about six lookups a minute, so with the existence-only arm ON a batch takes at most five lines per try (the box says so). */
export const MAX_CITATIONS_EXISTENCE = 5;
/** #223 D5 (R1, 15 Oct): the one sentence shown when a batch stops at the engine's rate limit; with no Retry-After it says "about a minute" (the engine's window), never a number it was not told. */
export const batchStopText = (checked: number, total: number, wait?: number): string =>
  `Checked ${checked} of ${total} lines. The check allows only a few lookups a minute; try the rest in ${wait === undefined ? "about a minute" : `${wait} seconds`}.`;
/** #223 D5 (R1): said when the pasted text had more lines than one try takes; the number is the one cap constant. */
export const overCapText = (cap: number = MAX_CITATIONS_EXISTENCE): string => `Only the first ${cap} lines were checked. Check the rest in a second try.`;

/** Shown instead of a result when the engine answers VERIFIED to a line sent WITHOUT a quote: that cannot be true (nothing was looked up in the text), so nothing is shown as verified. */
export const VERIFIED_WITHOUT_QUOTE_TEXT = "The engine answered verified to a citation sent without a quote, which cannot be right, so no result is shown for it.";

/** Shown when the engine's reply carries no recognised coverage. Never a typed-in claim about what the index holds. */
export const COVERAGE_NOT_REPORTED = "Coverage not reported by the engine.";

export interface CitationLine {
  /** 1-based line number in the pasted text, so a row can be matched to the line the user typed. */
  line: number;
  citation: string;
  quote: string | null;
  /** Existence-only index: the user typed words after a | ; they are NOT sent, and the row says so. */
  quoteIgnored?: true;
}

export interface ParsedCitations {
  items: CitationLine[];
  /** Non-empty lines beyond the cap (MAX_CITATIONS, or MAX_CITATIONS_EXISTENCE with the arm ON): not checked, and said so. */
  skipped: number;
}

export function parseCitationLines(text: string, existenceOnly: boolean = CITATION_EXISTENCE_ONLY): ParsedCitations {
  const items: CitationLine[] = [];
  let skipped = 0;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (items.length >= (existenceOnly ? MAX_CITATIONS_EXISTENCE : MAX_CITATIONS)) {
      skipped += 1;
      return;
    }
    const bar = line.indexOf("|");
    // Never cut: an over-long citation or quote must reach checkInputs, which refuses it with the length message. Cutting here would check a
    // prefix of what the user typed (and a prefix that is found would read VERIFIED). The FIRST bar splits; later bars belong to the quote.
    const citation = (bar === -1 ? line : line.slice(0, bar)).trim();
    const quote = bar === -1 ? "" : line.slice(bar + 1).trim();
    // existence-only (flag): no quote is ever sent; a typed quote is said to be unchecked, never silently dropped
    items.push(existenceOnly ? { line: i + 1, citation, quote: null, ...(quote ? { quoteIgnored: true as const } : {}) } : { line: i + 1, citation, quote: quote || null });
  });
  return { items, skipped };
}

export type RowState = CitationCheckState;

export interface PanelRow {
  item: CitationLine;
  state: RowState;
}

type Verify = Parameters<typeof runCitationCheck>[0];

/** A line sent without a quote can never be verified: a VERIFIED answer to one (the result or the product status) is turned into an error, not shown. */
function failClosed(item: CitationLine, state: CitationCheckState): RowState {
  if (item.quote !== null || state.phase !== "result") return state;
  const v = state.view;
  if (v.status === "VERIFIED" || v.product?.status === "verified") return { phase: "error", kind: "server", message: VERIFIED_WITHOUT_QUOTE_TEXT };
  return state;
}

/** Checks the items in order, one at a time; `onRow` fires after each so the screen fills as results arrive. A quote-less line is SENT as an existence-only check. */
export async function checkCitations(
  verify: Verify,
  items: readonly CitationLine[],
  signal?: AbortSignal,
  onRow?: (rows: PanelRow[]) => void,
  existenceOnly: boolean = CITATION_EXISTENCE_ONLY,
): Promise<PanelRow[]> {
  const rows: PanelRow[] = items.map((item) => ({ item, state: { phase: "idle" } as RowState }));
  for (let i = 0; i < rows.length; i += 1) {
    if (signal?.aborted) break;
    const { item } = rows[i];
    rows[i] = { item, state: { phase: "checking" } };
    onRow?.([...rows]);
    rows[i] = { item, state: failClosed(item, await runCitationCheck(verify, item.citation, item.quote, signal)) };
    onRow?.([...rows]);
    // #223 D5: with the arm ON the first 429 ends the run (the rest stay unchecked and are said so ONCE, by the view); the OFF arm goes on as before
    const st = rows[i].state;
    if (existenceOnly && st.phase === "error" && st.kind === "rate_limited") break;
  }
  return rows;
}

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
const fmt = (n: number) => n.toLocaleString("en-GB");

/** Appended outside the hosted app (guides, screenshots, demos): the citation check is not served in the hosted deployment yet. */
export const DEV_STACK_ONLY_TEXT = "Dev stack only; not served in the hosted deployment.";

/**
 * The coverage line, built ONLY from the engine's served fields (R1-signed sentence, 12 Oct): `resolvable_cases` (the judgments a citation can
 * resolve to), `courts_resolvable` (court label -> resolvable count), `year_min`/`year_max` (over those cases) and `note` (it says SCC-family only).
 * The index total (`judgments_held`) and the held courts and years are never read. The Supreme Court figure sums every label that starts
 * with "Supreme Court" and says how many labels that is; the rest is "other courts". Data that does not add up (the per-court counts must sum to
 * `resolvable_cases`) or fields that are missing give the plain fallback, never a partial claim. `devStack` appends the dev-stack-only sentence.
 */
export function coverageLine(coverage: unknown, opts: { devStack?: boolean } = {}): string {
  if (!coverage || typeof coverage !== "object") return COVERAGE_NOT_REPORTED;
  const c = coverage as { resolvable_cases?: unknown; courts_resolvable?: unknown; year_min?: unknown; year_max?: unknown; note?: unknown };
  const per = c.courts_resolvable;
  if (!isCount(c.resolvable_cases) || !per || typeof per !== "object" || Array.isArray(per) || !isCount(c.year_min) || !isCount(c.year_max)) return COVERAGE_NOT_REPORTED;
  const entries = Object.entries(per as Record<string, unknown>);
  if (entries.length === 0 || !entries.every(([k, v]) => k.trim() && isCount(v))) return COVERAGE_NOT_REPORTED;
  const counts = entries.map(([k, v]) => [k, v as number] as const);
  const total = c.resolvable_cases;
  if (counts.reduce((a, [, v]) => a + v, 0) !== total) return COVERAGE_NOT_REPORTED;
  const sc = counts.filter(([k]) => k.startsWith("Supreme Court"));
  const scN = sc.reduce((a, [, v]) => a + v, 0);
  const labels = counts.length;
  const split =
    sc.length === 0
      ? ""
      : ` (Supreme Court ${fmt(scN)}${sc.length > 1 ? ` under ${COUNT_WORDS[sc.length] ?? sc.length} labels` : ""}; other courts ${fmt(total - scN)})`;
  const scc = typeof c.note === "string" && /SCC-family/i.test(c.note) ? "; SCC-family citations only" : "";
  const base =
    `Citations resolve for ${fmt(total)} judgments from ${labels} court label${labels === 1 ? "" : "s"}${split}, with years ${c.year_min} to ${c.year_max} ` +
    `(the index's year field)${scc}. A citation to any other court or reporter answers not in index, which is no evidence either way.`;
  return opts.devStack ? `${base} ${DEV_STACK_ONLY_TEXT}` : base;
}
