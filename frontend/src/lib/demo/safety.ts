// The safety page's words and figures (Lead-2's decision on #525, 2026-10-06; every figure and its scope come from Track A's
// message of the same day, with the record each rests on). R1 reviews this file. Nothing here is a claim about production
// traffic, another court population, or another product, and no figure appears anywhere else in the interface.

export const SAFETY_LABEL =
  "Real High Court material, the Obj-1b set, which the models used in development have been exposed to; measured with two judges (4B judge on our own " +
  "machine, 32B judge on the serverless endpoint); one run, one seed. Descriptive of this set, not production traffic.";

export const ASSIST_LINE = "This assists a lawyer; it is not a verdict.";

export interface SafetyFigure {
  id: string;
  heading: string;
  text: string;
}

export const SAFETY_FIGURES: readonly SafetyFigure[] = [
  {
    id: "false-proofs",
    heading: "False proofs on court-rejected items",
    text:
      "0 of 290; 95% upper bound 1.03% (worst case if 2 ERROR items were false proofs: upper bound 2.15%). The bound is an " +
      "upper limit on the rate, not an observed count.",
  },
  {
    id: "coverage",
    heading: "Court-established items proved",
    text:
      "0 of 31. No court-established item was proved on this material: the product abstains rather than proves here. That is " +
      "a statement about what it did on this set, not a statement that such items are unsafe.",
  },
];

export const SAFETY_MATERIAL =
  "A fixed set of 372 real court items, exposed to the models used in development. 51 were set aside because the design sends them straight to a lawyer without a " +
  "judgment (46 court-rejected, 5 court-established), leaving 321 judged: 290 court-rejected and 31 court-established. The " +
  "court-rejected items are drawn predominantly from orders on petitions to quash criminal proceedings (cruelty, cheating and " +
  "breach-of-trust families). This is not a statement about trial or appellate conviction judgments.";

export const SAFETY_STACK =
  "The two-judge configuration pairs a 4B element judge (threshold 0.74) with a 32B judge (threshold 0.97); both have to agree. " +
  "In this run the 4B ran on our own machine and the 32B on the serverless endpoint, and the figure was measured on that arrangement only. " +
  "The result is for this configuration on a pre-registered held-out set, in a single run; it is not a claim about a different court population.";

export interface SafetyRecord {
  figure: string;
  repo: string;
  commit: string;
  path: string;
}

// Where each figure comes from: the team's internal records (a private repository). Shown as provenance, not as links: a visitor
// cannot open them, and the page says so.
export const SAFETY_RECORDS: readonly SafetyRecord[] = [
  {
    figure: "false proofs, upper bound, worst case",
    repo: "AxisMeru/prabhasa-nyaya",
    commit: "a3c7c0ab073afae9d072118cdb43608aa859922b",
    path: "research/gates/P2b/obj1b_run/ANALYSIS_NOTES_2026-10-05.md",
  },
  {
    figure: "court-established items proved",
    repo: "AxisMeru/prabhasa-nyaya",
    commit: "a3c7c0ab073afae9d072118cdb43608aa859922b",
    path: "research/gates/P2b/obj1b_run/ANALYSIS_NOTES_2026-10-05.md",
  },
  {
    figure: "material and denominators",
    repo: "AxisMeru/prabhasa-nyaya",
    commit: "a3c7c0ab073afae9d072118cdb43608aa859922b",
    path: "research/gates/P2b/obj1b_run/REFER_GRID_LOADER_SPEC.md and research/gates/P2b/obj1b/PREREG.md",
  },
];

export const SAFETY_COPY: readonly string[] = [
  SAFETY_LABEL,
  ASSIST_LINE,
  ...SAFETY_FIGURES.map((f) => `${f.heading}. ${f.text}`),
  SAFETY_MATERIAL,
  SAFETY_STACK,
];

// Every number the page may show. A number outside this list is a figure nobody sourced.
export const SAFETY_NUMBERS: ReadonlySet<string> = new Set([
  "0", "290", "95", "1.03", "2", "2.15", "31", "372", "51", "46", "5", "321", "4", "32", "0.74", "0.97", "1",
]);
