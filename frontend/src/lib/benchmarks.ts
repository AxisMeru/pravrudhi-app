// The benchmark results page (#638). One data file, `benchmark_results.json`, drives it; this module is the contract:
// what a block must carry before the page may show a figure from it, and the fixed vocabulary of titles, chips, labels and
// banned words (spec: S4_SCORING_TABLE_AND_PAGE_SPEC_2026-10-06, sections 2 and 3). The rule the page enforces is the spec's:
// a block that is not `reviewed`, or that fails any check below, renders as "Result pending" with NO figure; the label comes
// before the number, and a number never appears without its "what it is not" line. No number lives in this file or in the page.

export type BlockId = "bbl" | "citation" | "legalbench" | "sealed_court";
export type BlockStatus = "reviewed" | "pending" | "inconclusive" | "dropped";

export const BLOCK_IDS: readonly BlockId[] = ["bbl", "citation", "legalbench", "sealed_court"];
export const STATUSES: readonly BlockStatus[] = ["reviewed", "pending", "inconclusive", "dropped"];

/** Status words as shown. */
export const STATUS_LABEL: Readonly<Record<BlockStatus, string>> = {
  reviewed: "Reviewed",
  pending: "Result pending",
  inconclusive: "Inconclusive",
  dropped: "Dropped",
};

/** Kind chips (spec 2.2), fixed per block. */
export const KIND_CHIP: Readonly<Record<BlockId, string>> = {
  bbl: "Model legal knowledge (MCQ), not the harness",
  citation: "Harness, our own pre-registered study",
  legalbench: "Harness vs the same model alone; United States law",
  sealed_court: "Sealed Indian court test, signed result",
};

/** Data chips (spec 2.2). */
export const DATA_CHIPS: readonly string[] = ["Real court-derived", "Public benchmark", "Model-generated questions", "Constructed"];

/** Block titles (spec 2.1, items 2 to 5). Where a block is inconclusive or dropped, the title says so. */
export const BLOCK_TITLE: Readonly<Record<BlockId, string>> = {
  bbl: "Our models on an Indian legal-knowledge test",
  citation: "Does our citation checker catch wrong citations?",
  legalbench: "Rule application on a public benchmark",
  sealed_court: "What the sealed Indian court tests found",
};

/** The fixed label shown on every table and card of a block (spec 1.1 to 1.3); the sealed-court block carries its own signed sentences. */
export const FIXED_LABEL: Readonly<Partial<Record<BlockId, string>>> = {
  bbl: "Model legal knowledge (multiple choice). Not the proof harness. Our models were not trained for this test.",
  citation:
    "Model-generated questions; Supreme Court judgments index only; a citation is checked for existence and metadata, not for whether the case supports a stated point. Questions were written by Anthropic Haiku and answered by Anthropic Sonnet.",
  legalbench:
    "United States law (public benchmark). A test of whether an element-by-element harness changes accuracy on a public rule-application task. Not the Indian-law claim. Not a placement on any leaderboard.",
};

export const PAGE_TITLE = "Benchmarks";
export const PAGE_SUBTITLE = "What we test, how, and what the results do and do not show.";
export const PENDING_TEXT = "Result pending";
export const NO_FIGURE_TEXT = "No figure is shown until a second reviewer has checked it.";

/** Block E, "How we test" (spec 2.1, item 6). */
export const HOW_WE_TEST: readonly string[] = [
  "Items are real court-derived or labelled constructed.",
  "Sealed sets are never used for tuning.",
  "Every number is checked by a second reviewer.",
  'Where a result is a non-significant difference it is called "no separation", never a direction.',
  "Numbers are dated.",
];

export const FOOTER_TEXT = "Research results, not legal advice.";

/** Words that never appear on this page, in its data or its fixed text (spec 2.2). */
export const BANNED_WORDS: readonly string[] = ["beats", "safer", "state of the art", "best", "outperforms", "validated"];

const BANNED = BANNED_WORDS.map((w) => new RegExp(`\\b${w.replace(/ /g, "[\\s-]+")}\\b`, "i"));

/** The banned words found in a text (empty when clean). */
export function bannedIn(text: string): string[] {
  return BANNED_WORDS.filter((_w, i) => BANNED[i].test(text));
}

export interface ResultRow {
  arm: string;
  group: string;
  n: number;
  correct: number;
  accuracy: number;
  ci95: [number, number];
  invalid: number;
}

export interface ResultTable {
  title: string;
  columns: string[];
  rows: ResultRow[];
  /** Chance level (0 to 1) for the dashed line; optional (an addition to the contract the spec's 2.3 asks for). */
  chance?: number;
}

export interface PairedResult {
  pair: string;
  only_first_correct: number;
  only_second_correct: number;
  p: number;
  label: "no separation" | "separated";
}

export interface Leaderboard {
  name: string;
  url: string;
  rank: number;
  as_of: string;
  submitted_by: string;
}

export interface ReviewedBlock {
  id: BlockId;
  status: "reviewed";
  reviewer_clear: { reviewer: string; head_sha: string; date: string };
  kind_chip: string;
  data_chip: string;
  what_it_is: string;
  what_it_is_not: string;
  limits: string;
  run: { model_ids: string[]; revisions: string[]; dataset_revision: string; scorer_sha256: string; date: string };
  tables: ResultTable[];
  paired: PairedResult[];
  leaderboard: Leaderboard | null;
}

/** What the page renders for one block. `figures` is non-null ONLY for a reviewed block that passed every check. */
export interface BlockView {
  id: BlockId;
  title: string;
  status: BlockStatus;
  statusLabel: string;
  /** Why a block that claimed to be reviewed was refused (shown nowhere on the page; for tests and the console). */
  refusal: string | null;
  fixedLabel: string | null;
  figures: ReviewedBlock | null;
}

export interface ParsedResults {
  generatedAt: string | null;
  pageVersion: string | null;
  blocks: BlockView[];
  /** Problems with the file as a whole or with a block, in plain words. */
  problems: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const HEX64 = /^[0-9a-f]{64}$/;
const SHA = /^[0-9a-f]{7,40}$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v >= 0;
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(isStr);

function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out));
  else if (isObj(v)) Object.values(v).forEach((x) => allStrings(x, out));
  return out;
}

function checkRow(r: unknown, where: string, errs: string[]): r is ResultRow {
  if (!isObj(r)) return errs.push(`${where}: not an object`), false;
  const ci = r.ci95;
  let ok = true;
  const bad = (m: string) => {
    errs.push(`${where}: ${m}`);
    ok = false;
  };
  if (!isStr(r.arm)) bad("no arm");
  if (!isStr(r.group)) bad("no group");
  if (!isInt(r.n) || (r.n as number) < 1) bad("a number without its n");
  if (!isInt(r.correct)) bad("no correct count");
  if (!isNum(r.accuracy) || r.accuracy < 0 || r.accuracy > 1) bad("accuracy is not between 0 and 1");
  if (!Array.isArray(ci) || ci.length !== 2 || !ci.every(isNum)) bad("a number without its 95% interval");
  else if (!(ci[0] >= 0 && ci[1] <= 1 && ci[0] <= ci[1])) bad("the interval is not ordered inside 0 and 1");
  else if (isNum(r.accuracy) && (r.accuracy < ci[0] - 1e-9 || r.accuracy > ci[1] + 1e-9)) bad("accuracy lies outside its interval");
  if (!isInt(r.invalid)) bad("no invalid count");
  if (isInt(r.n) && isInt(r.correct) && (r.correct as number) > (r.n as number)) bad("more correct than n");
  if (isInt(r.n) && isInt(r.correct) && isNum(r.accuracy) && (r.n as number) > 0 && Math.abs((r.correct as number) / (r.n as number) - r.accuracy) > 0.005) {
    bad("accuracy does not equal correct / n");
  }
  return ok;
}

/** Why a block that says `reviewed` may not be shown; null when every check passes. */
function refuseReviewed(id: BlockId, b: Record<string, unknown>): string | null {
  const errs: string[] = [];
  const rc = b.reviewer_clear;
  if (!isObj(rc) || !isStr(rc.reviewer) || !isStr(rc.head_sha) || !SHA.test(String(rc.head_sha)) || !isStr(rc.date) || !ISO_DATE.test(String(rc.date))) {
    errs.push("no reviewer clearance (reviewer, head_sha, date)");
  }
  if (b.kind_chip !== KIND_CHIP[id]) errs.push("kind chip is not this block's fixed chip");
  if (!isStr(b.data_chip) || !DATA_CHIPS.includes(b.data_chip)) errs.push("data chip is not in the fixed vocabulary");
  for (const f of ["what_it_is", "what_it_is_not", "limits"]) if (!isStr(b[f])) errs.push(`no ${f} (a number never appears without its what-it-is-not line)`);
  const run = b.run;
  if (!isObj(run) || !isStrArray(run.model_ids) || !isStrArray(run.revisions) || !isStr(run.dataset_revision) || !isStr(run.scorer_sha256) || !HEX64.test(String(run.scorer_sha256)) || !isStr(run.date) || !ISO_DATE.test(String(run.date))) {
    errs.push("run record incomplete (model ids, revisions, dataset revision, scorer sha256, date)");
  }
  const tables = b.tables;
  if (!Array.isArray(tables) || tables.length === 0) errs.push("no tables");
  else {
    tables.forEach((t, ti) => {
      if (!isObj(t) || !isStr(t.title) || !Array.isArray(t.columns) || !Array.isArray(t.rows) || t.rows.length === 0) {
        errs.push(`table ${ti + 1}: needs a title, columns and rows`);
        return;
      }
      if (t.chance !== undefined && !(isNum(t.chance) && t.chance > 0 && t.chance < 1)) errs.push(`table ${ti + 1}: chance is not between 0 and 1`);
      t.rows.forEach((r, ri) => checkRow(r, `table ${ti + 1} row ${ri + 1}`, errs));
    });
  }
  const paired = b.paired;
  if (paired !== undefined && !Array.isArray(paired)) errs.push("paired is not a list");
  else {
    (paired ?? []).forEach((p, pi) => {
      if (!isObj(p) || !isStr(p.pair) || !isInt(p.only_first_correct) || !isInt(p.only_second_correct) || !isNum(p.p) || p.p < 0 || p.p > 1) {
        errs.push(`paired ${pi + 1}: needs a pair, both discordant counts and a p value`);
        return;
      }
      if (p.label !== "no separation" && p.label !== "separated") errs.push(`paired ${pi + 1}: label is not "no separation" or "separated"`);
      // A direction is stated only when p < 0.05; p >= 0.05 is "no separation" (spec 1.1).
      else if ((p.p >= 0.05) !== (p.label === "no separation")) errs.push(`paired ${pi + 1}: the label contradicts p (p >= 0.05 is "no separation")`);
    });
  }
  const lb = b.leaderboard;
  if (lb !== null && lb !== undefined) {
    if (!isObj(lb) || !isStr(lb.name) || !isStr(lb.url) || !/^https:\/\//.test(String(lb.url)) || !isInt(lb.rank) || !isStr(lb.as_of) || !ISO_DATE.test(String(lb.as_of)) || !isStr(lb.submitted_by)) {
      errs.push("leaderboard needs name, https url, rank, as_of date and submitted_by (or null)");
    }
  }
  const banned = [...new Set(allStrings(b).flatMap(bannedIn))];
  if (banned.length) errs.push(`banned wording: ${banned.join(", ")}`);
  return errs.length ? errs.join("; ") : null;
}

function view(id: BlockId, status: BlockStatus, refusal: string | null, figures: ReviewedBlock | null): BlockView {
  // A refused or unreviewed block is shown as pending whatever it claimed.
  const shown: BlockStatus = figures ? "reviewed" : status === "inconclusive" || status === "dropped" ? status : "pending";
  return { id, title: BLOCK_TITLE[id], status: shown, statusLabel: STATUS_LABEL[shown], refusal, fixedLabel: FIXED_LABEL[id] ?? null, figures };
}

/**
 * Read the data file. The result ALWAYS has the four blocks, in the page order; a block missing from the file, not reviewed, or
 * failing any check is pending with no figure. The function never throws and never lets a figure through on a doubtful block.
 */
export function parseBenchmarkResults(raw: unknown): ParsedResults {
  const problems: string[] = [];
  const out: ParsedResults = { generatedAt: null, pageVersion: null, blocks: [], problems };
  const file = isObj(raw) ? raw : null;
  if (!file) problems.push("the results file is not an object");
  else {
    if (isStr(file.generated_at) && ISO_DATE.test(file.generated_at)) out.generatedAt = file.generated_at;
    else problems.push("generated_at is missing or not a date");
    if (isStr(file.page_version)) out.pageVersion = file.page_version;
    else problems.push("page_version is missing");
  }
  const list = file && Array.isArray(file.blocks) ? file.blocks : [];
  if (file && !Array.isArray(file.blocks)) problems.push("blocks is not a list");
  const seen = new Set<string>();
  const byId = new Map<BlockId, Record<string, unknown>>();
  for (const b of list) {
    if (!isObj(b) || !BLOCK_IDS.includes(b.id as BlockId)) {
      problems.push("a block with an unknown id was ignored");
      continue;
    }
    const id = b.id as BlockId;
    if (seen.has(id)) {
      problems.push(`block ${id} appears twice; only the first is read`);
      continue;
    }
    seen.add(id);
    byId.set(id, b);
  }
  for (const id of BLOCK_IDS) {
    const b = byId.get(id);
    if (!b) {
      out.blocks.push(view(id, "pending", null, null));
      continue;
    }
    const status = STATUSES.includes(b.status as BlockStatus) ? (b.status as BlockStatus) : "pending";
    if (!STATUSES.includes(b.status as BlockStatus)) problems.push(`block ${id}: unknown status, treated as pending`);
    if (status !== "reviewed") {
      const carries = (Array.isArray(b.tables) && b.tables.length > 0) || (Array.isArray(b.paired) && b.paired.length > 0);
      if (carries) problems.push(`block ${id}: not reviewed but carries figures; they are not shown`);
      out.blocks.push(view(id, status, carries ? "figures on a block that is not reviewed" : null, null));
      continue;
    }
    const refusal = refuseReviewed(id, b);
    if (refusal) {
      problems.push(`block ${id}: refused (${refusal})`);
      out.blocks.push(view(id, "pending", refusal, null));
      continue;
    }
    out.blocks.push(view(id, "reviewed", null, b as unknown as ReviewedBlock));
  }
  return out;
}

/** The title as shown: a block that is inconclusive or dropped says so in its title (spec 2.1, block B). */
export function titleFor(v: BlockView): string {
  return v.status === "inconclusive" || v.status === "dropped" ? `${v.title} (${v.statusLabel})` : v.title;
}

/** Text alternative for a table's chart: every row with its n and interval, in the order given (never sorted by value). */
export function chartAlt(t: ResultTable): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return `${t.title}. ${t.rows
    .map((r) => `${r.arm}, ${r.group}: ${pct(r.accuracy)}, 95% interval ${pct(r.ci95[0])} to ${pct(r.ci95[1])}, n ${r.n}`)
    .join("; ")}.${t.chance !== undefined ? ` Chance level ${pct(t.chance)}.` : ""}`;
}
