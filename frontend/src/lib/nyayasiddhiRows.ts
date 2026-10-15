// NyayaSiddhi result rows (HF AxisMeru/nyayasiddhi, results/append): the page reads ONE static, build-time JSON made from SIGNED rows (src/data/nyayasiddhi/rows.json); no call to any third party at run time.
// The shape follows the benchmark's result_row schema (schema674/result_row.schema.json): every figure is a count with its n and its exact 95% Clopper-Pearson interval, and a row carries BOTH measures (false proof on not-established items, coverage on established items).
// This module holds no words: every visible string is R1's, in lib/nyayasiddhi.ts.

export const STATUSES = ["self-reported", "re-scored", "reproduced", "third-party verified"] as const;
export const SPLITS = ["obj1_dev", "obj1b_minus_cruelty"] as const;
export const UNITS = ["whole_item", "element"] as const;
export const ENTRY_KINDS = ["product", "reference_arm"] as const;
export const MEASURES = ["false_proof", "coverage"] as const;
export const ALL_GROUP = "ALL";

export type Status = (typeof STATUSES)[number];
export type Split = (typeof SPLITS)[number];
export type Unit = (typeof UNITS)[number];
export type EntryKind = (typeof ENTRY_KINDS)[number];
export type Measure = (typeof MEASURES)[number];

export interface Metric {
  name: Measure;
  /** ALL or a family (CHEAT, TRUST, NI138, CRUELTY); absent means ALL. */
  group: string;
  k: number;
  n: number;
  ciLow: number | null;
  ciHigh: number | null;
}

export interface ResultRow {
  rowId: string;
  status: Status;
  benchmarkVersion: string;
  split: Split;
  unit: Unit;
  systemName: string;
  systemVersion: string;
  runDate: string;
  /** organiser_entry in the schema: a row entered by the organisers (not an outside entrant). */
  organiserEntry: boolean;
  /** For an organiser entry only, set in the data file by the data build step from the organisers' own list (never inferred from a system name): our product, or a reference arm (a frontier or open model run by the organisers). */
  entryKind: EntryKind | null;
  metrics: Metric[];
  /** Rows the engine failed to answer (a count; the figures count them as not supported). */
  nError: number;
  /** For a row with errors: for each "measure|group", how the counts change when errors are counted the other way (from the error-sensitivity file); keyed like "false_proof|ALL". */
  errorSensitivity: Record<string, { kAsProof: number; kAsNotProof: number; n: number; agree: boolean }>;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const oneOf = <T extends string>(list: readonly T[], x: unknown): x is T => typeof x === "string" && (list as readonly string[]).includes(x);

function parseMetric(x: unknown): Metric | null {
  if (!isObj(x) || !oneOf(MEASURES, x.name)) return null;
  const { k, n, ci_low: lo, ci_high: hi } = x;
  if (!Number.isInteger(k) || !Number.isInteger(n) || (k as number) < 0 || (n as number) < (k as number)) return null;
  if (x.interval_method !== "clopper-pearson-exact" || x.interval_level !== 0.95) return null;
  const num = (v: unknown): number | null | undefined => (v === null ? null : typeof v === "number" && v >= 0 && v <= 1 ? v : undefined);
  const ciLow = num(lo), ciHigh = num(hi);
  if (ciLow === undefined || ciHigh === undefined) return null;
  // an interval is present exactly when n > 0, and it contains the point estimate
  if ((n as number) === 0) { if (ciLow !== null || ciHigh !== null) return null; }
  else {
    if (ciLow === null || ciHigh === null || ciLow > ciHigh) return null;
    const p = (k as number) / (n as number);
    if (p < ciLow - 1e-9 || p > ciHigh + 1e-9) return null;
  }
  return { name: x.name, group: typeof x.group === "string" && x.group ? x.group : ALL_GROUP, k: k as number, n: n as number, ciLow, ciHigh };
}

/** One signed row, or null when it does not meet the contract (the page shows nothing for a row it cannot trust). */
export function parseRow(x: unknown): ResultRow | null {
  if (!isObj(x)) return null;
  if (typeof x.row_id !== "string" || !x.row_id) return null;
  if (!oneOf(STATUSES, x.status) || !oneOf(SPLITS, x.split) || !oneOf(UNITS, x.unit)) return null;
  for (const f of ["benchmark_version", "system_name", "system_version", "run_date"] as const) if (typeof x[f] !== "string" || !(x[f] as string)) return null;
  if (!Array.isArray(x.metrics)) return null;
  const metrics = x.metrics.map(parseMetric);
  if (metrics.some((m) => m === null)) return null;
  const ms = metrics as Metric[];
  // BOTH measures appear in every row (a row without both is invalid)
  for (const name of MEASURES) if (!ms.some((m) => m.name === name)) return null;
  // an organiser entry must say which kind it is (the page words the two kinds differently); an outside entrant row carries no kind
  const organiser = x.organiser_entry === true;
  const entryKind = oneOf(ENTRY_KINDS, x.entry_kind) ? x.entry_kind : null;
  if (organiser && entryKind === null) return null;
  if (!organiser && x.entry_kind !== undefined) return null;
  if (!Number.isInteger(x.n_error) || (x.n_error as number) < 0) return null;
  const errorSensitivity: ResultRow["errorSensitivity"] = {};
  if (x.error_sensitivity !== undefined) {
    if (!isObj(x.error_sensitivity)) return null;
    for (const [key, v] of Object.entries(x.error_sensitivity)) {
      if (!isObj(v) || !Number.isInteger(v.k_as_proof) || !Number.isInteger(v.k_as_not_proof) || !Number.isInteger(v.n) || typeof v.agree !== "boolean") return null;
      errorSensitivity[key] = { kAsProof: v.k_as_proof as number, kAsNotProof: v.k_as_not_proof as number, n: v.n as number, agree: v.agree };
    }
  }
  // a superseded row is never shown
  if (typeof x.superseded_by === "string" && x.superseded_by) return null;
  return {
    rowId: x.row_id, status: x.status, benchmarkVersion: x.benchmark_version as string, split: x.split, unit: x.unit,
    systemName: x.system_name as string, systemVersion: x.system_version as string, runDate: x.run_date as string,
    organiserEntry: organiser, entryKind, metrics: ms, nError: x.n_error as number, errorSensitivity,
  };
}

/** The rows of a data file {"rows": [...]}: only the rows that meet the contract, in the file's order (no ranking, no sorting by result). */
export function parseRows(file: unknown): ResultRow[] {
  if (!isObj(file) || !Array.isArray(file.rows)) return [];
  return file.rows.map(parseRow).filter((r): r is ResultRow => r !== null);
}

export const unitsOf = (rows: readonly ResultRow[]): Unit[] => UNITS.filter((u) => rows.some((r) => r.unit === u));

/** True when a row answered nothing for the group: no false proof AND no coverage (0 false proofs that comes with 0 coverage is never read alone: R1's line). */
export function zeroWithZero(row: ResultRow, group: string): boolean {
  const fp = metricOf(row, "false_proof", group), cov = metricOf(row, "coverage", group);
  return !!fp && !!cov && fp.k === 0 && cov.k === 0 && cov.n > 0;
}

/** The errors line applies to a group when the row had errors AND counting them the other way changes the wrongly-supported figure for that group (the two mappings disagree). Returns the numbers for R1's line. */
export function errorLineFor(row: ResultRow, group: string): { e: number; k: number; n: number } | null {
  if (row.nError <= 0) return null;
  const x = row.errorSensitivity[`false_proof|${group}`];
  if (!x || x.agree) return null;
  return { e: row.nError, k: x.kAsProof, n: x.n };
}

/** The groups that appear in the rows of one unit: ALL first, then the families in the order they first appear. */
export function groupsOf(rows: readonly ResultRow[], unit?: Unit): string[] {
  const seen: string[] = [ALL_GROUP];
  for (const r of rows) if (!unit || r.unit === unit) for (const m of r.metrics) if (!seen.includes(m.group)) seen.push(m.group);
  return seen;
}

export function metricOf(row: ResultRow, name: Measure, group: string): Metric | null {
  return row.metrics.find((m) => m.name === name && m.group === group) ?? null;
}

/** Where the interval sits on a 0 to 1 scale, as percentages of the chart width (for the drawing only; the numbers are always printed beside it). */
export function intervalGeometry(m: Metric): { low: number; high: number; point: number } | null {
  if (m.n === 0 || m.ciLow === null || m.ciHigh === null) return null;
  return { low: m.ciLow * 100, high: m.ciHigh * 100, point: (m.k / m.n) * 100 };
}

/** A proportion as a percentage with one decimal ("3.5%"); the same form the page tools' accuracy template uses. */
export const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
