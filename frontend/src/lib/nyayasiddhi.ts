import type { Measure, Split, Status, Unit } from "./nyayasiddhiRows";

// The words of the NyayaSiddhi results view on /benchmarks (app#344). EVERY visible string is R1's: each is null until R1 words it, and the view shows nothing at all until every one is set (resolveStrings),
// so the page ships blank-safe. The numbers come from signed rows only (lib/nyayasiddhiRows.ts); the page never words a comparison, a ranking or a verdict.
export interface NyayaSiddhiStrings {
  heading: string;
  /** One or two sentences: what the rows are and that only signed rows appear. */
  intro: string;
  tableCaption: string;
  colSystem: string;
  colStatus: string;
  colSplit: string;
  colRunDate: string;
  /** The stack label printed on every row ("dev stack (local)": the benchmark's organiser rows were measured on the local development stack). */
  stackLabel: string;
  /** Printed on a row entered by the organisers (organiser_entry). */
  organiserEntry: string;
  /** Printed under a row's figures when it has 0 false proofs AND 0 coverage for the chosen group: that pair is never read alone. */
  zeroWithZero: string;
  unitHeading: string;
  groupHeading: string;
  /** "all" in the group chooser (the ALL group). */
  groupAll: string;
  unit: Record<Unit, string>;
  split: Record<Split, string>;
  status: Record<Status, string>;
  measure: Record<Measure, string>;
  /** One line under each measure heading saying what it counts. */
  measureNote: Record<Measure, string>;
  /** Between k and n: "3 of 40". */
  of: string;
  intervalLabel: string;
  /** Between the interval ends: "1.2% to 8.4%". */
  to: string;
  /** Printed when a measure has n = 0. */
  noItems: string;
  chartLabel: string;
  /** Printed when a row has no figure for the chosen group. */
  noFigure: string;
}

type Nullable<T> = { [K in keyof T]: T[K] extends Record<string, string> ? Record<keyof T[K], string | null> : T[K] | null };

export const NYAYASIDDHI_STRINGS: Nullable<NyayaSiddhiStrings> = {
  heading: null, intro: null, tableCaption: null, colSystem: null, colStatus: null, colSplit: null, colRunDate: null, stackLabel: null, organiserEntry: null, zeroWithZero: null,
  unitHeading: null, groupHeading: null, groupAll: null,
  unit: { whole_item: null, element: null },
  split: { obj1_dev: null, obj1b_minus_cruelty: null },
  status: { "self-reported": null, "re-scored": null, reproduced: null, "third-party verified": null },
  measure: { false_proof: null, coverage: null },
  measureNote: { false_proof: null, coverage: null },
  of: null, intervalLabel: null, to: null, noItems: null, chartLabel: null, noFigure: null,
};

/** Every string set, or null: the results view shows nothing until R1 has worded all of them. */
export function resolveStrings(s: Nullable<NyayaSiddhiStrings> = NYAYASIDDHI_STRINGS): NyayaSiddhiStrings | null {
  const bad = (v: unknown): boolean => (v === null ? true : typeof v === "object" ? Object.values(v as Record<string, unknown>).some(bad) : typeof v === "string" ? v.trim() === "" : true);
  return bad(s) ? null : (s as unknown as NyayaSiddhiStrings);
}
