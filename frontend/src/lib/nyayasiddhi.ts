import type { Measure, Split, Status, Unit } from "./nyayasiddhiRows";

// The words of the NyayaSiddhi results view on /benchmarks (app#344). EVERY visible string is R1's: each is null until R1 words it, and the view shows nothing at all until every one is set (resolveStrings),
// so the page ships blank-safe. The numbers come from signed rows only (lib/nyayasiddhiRows.ts); the page never words a comparison, a ranking or a verdict.
export interface NyayaSiddhiStrings {
  heading: string;
  /** One or two sentences: what the rows are and that only signed rows appear. */
  intro: string;
  /** Shown once, under the intro paragraph (R1, 15 Oct): the board holds only our own rows; a larger hidden set depends on court-item supply; no date promised. */
  benchmarksSupplyLine: string;
  tableCaption: string;
  colSystem: string;
  colStatus: string;
  colSplit: string;
  colRunDate: string;
  /** The stack label printed on every row ("dev stack (local)": the benchmark's organiser rows were measured on the local development stack). */
  stackLabel: string;
  /** Printed on a row entered by the organisers, by the row's own entry kind (never by a name): our product, or a reference arm run by the organisers. */
  organiserEntry: Record<"product" | "reference_arm", string>;
  /** Under a row's figures when it had errors and counting them the other way changes the wrongly-supported figure for the shown group; {e}, {k}, {n} are filled from the data. */
  errorLine: string;
  /** Printed under a row's figures when it has 0 false proofs AND 0 coverage for the chosen group: that pair is never read alone. */
  zeroWithZero: string;
  unitHeading: string;
  groupHeading: string;
  /** "all" in the group chooser (the ALL group). */
  groupAll: string;
  /** The families (CHEAT, TRUST, NI138, CRUELTY) as words; a group with no word here is not offered. */
  family: Record<string, string>;
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

// R1's words, byte-exact (15 Oct 2026, with Interim lead's ruling: an explicit exception confined to /benchmarks; figures only here, each with n and its exact 95% interval; signed rows only; no ranking; no "proof").
export const NYAYASIDDHI_STRINGS: Nullable<NyayaSiddhiStrings> = {
  heading: "NyayaSiddhi results",
  intro: "NyayaSiddhi is our benchmark for screening under Indian criminal law. Only signed runs appear here, and every figure is a development figure on material we have already seen, not a measure of how the product does on your matter.",
  benchmarksSupplyLine: "For now the board holds only our own rows. A larger hidden set depends on the supply of suitable court items, and we promise no date.",
  tableCaption: "NyayaSiddhi runs, one card for each run",
  colSystem: "System", colStatus: "Status", colSplit: "Material", colRunDate: "Run date",
  stackLabel: "dev stack (local)",
  organiserEntry: { product: "Entered by the NyayaSiddhi organisers, who also built this system", reference_arm: "Run by the NyayaSiddhi organisers with prompts they wrote; not an outside entry" },
  errorLine: "{e} gave an error. Errors are counted as not supported here; counted as supported, wrongly supported would be {k} of {n}.",
  zeroWithZero: "The system marked no item as supported here, so a count of 0 wrongly supported is not read on its own.",
  unitHeading: "Counted per", groupHeading: "Offence group", groupAll: "All groups",
  family: { CHEAT: "Cheating", TRUST: "Criminal breach of trust", NI138: "Dishonoured cheque", CRUELTY: "Cruelty by the husband or his relatives" },
  unit: { whole_item: "Whole item", element: "Each ingredient" },
  split: { obj1_dev: "Development items; used to design fixes, so seen by us", obj1b_minus_cruelty: "Second development set, cruelty items left out; exposed to Anthropic in an earlier study" },
  status: { "self-reported": "Reported by the entrant", "re-scored": "Re-scored by the organisers", reproduced: "Reproduced by the organisers", "third-party verified": "Checked by an outside party" },
  measure: { false_proof: "Wrongly supported", coverage: "Coverage" },
  measureNote: {
    false_proof: "Counted over items the court did not establish: how many the system still marked as supported.",
    coverage: "Counted over items the court established: how many the system marked as supported.",
  },
  of: "of", intervalLabel: "exact 95% interval", to: "to", noItems: "No items in this group.", chartLabel: "Interval for", noFigure: "No figure for this group.",
};

/** Every string set, or null: the results view shows nothing until R1 has worded all of them. */
export function resolveStrings(s: Nullable<NyayaSiddhiStrings> = NYAYASIDDHI_STRINGS): NyayaSiddhiStrings | null {
  const bad = (v: unknown): boolean => (v === null ? true : typeof v === "object" ? Object.values(v as Record<string, unknown>).some(bad) : typeof v === "string" ? v.trim() === "" : true);
  return bad(s) ? null : (s as unknown as NyayaSiddhiStrings);
}
