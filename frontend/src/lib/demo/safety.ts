// The safety page's words and figures (Lead-2's decision on #525, 2026-10-06; every figure and its scope come from Track A's
// message of the same day, with the record each rests on). R1 reviews this file. Nothing here is a claim about production
// traffic, another court population, or another product. The safety page takes every figure from this file; the checks in safety.spec.ts keep these
// strings exactly as R1 ruled them (12 Oct 2026).

export const SAFETY_LABEL =
  "Real court material (Obj-1b), two judges that both have to agree, one run. Post-hoc, on a set we have seen; mixed stack (4B judge on our development stack, 32B judge on the production serverless endpoint). " +
  "Descriptive of this set, not production traffic, not a validation.";

export const ASSIST_LINE = "This assists a lawyer; it is not a verdict.";

export interface SafetyFigure {
  id: string;
  heading: string;
  text: string;
}

export const SAFETY_FIGURES: readonly SafetyFigure[] = [
  {
    id: "false-proofs",
    heading: "False proofs on real court-rejected items",
    text:
      "0 of 290 real court-rejected items, one-sided 95% upper bound 1.03% (worst case, if the 2 items where the second judge was unavailable were false proofs: 2 of 290, one-sided upper bound 2.15%). " +
      "A bound on the rate, not an observed rate. Post-hoc, on an exposed set; mixed stack.",
  },
  {
    id: "coverage",
    heading: "Real court-established items proved",
    text:
      "0 of 31 real court-established items proved (one-sided upper bound 9.2%). Read beside the line above: zero false proofs beside zero proofs is not evidence that the system avoids false proofs in general. " +
      "It is a statement about what it did on this set, not that such items are unsafe.",
  },
];

export const SAFETY_MATERIAL =
  "A set of 372 real court items (Obj-1b) that we have seen. A general-purpose AI model read it in an earlier study, so it is no longer unseen by every model. " +
  "51 were set aside because the design sends them straight to a lawyer without a judgment (46 court-rejected, 5 court-established), leaving 321 judged: 290 court-rejected and 31 court-established. " +
  "The court-rejected items are drawn predominantly from orders on petitions to quash criminal proceedings (cruelty, cheating and breach-of-trust families). " +
  "This is not a statement about trial or appellate conviction judgments.";

export const SAFETY_STACK =
  "A 4B element judge (threshold 0.74) and a 32B judge (threshold 0.97) that both have to agree. " +
  "In this run the 4B ran on our development stack and the 32B on the production serverless endpoint, so this is not the production configuration; 4B dev-to-production parity is not established. " +
  "One run, post-hoc, on an exposed set; not a claim about a different court population.";

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
  "0", "290", "95", "1.03", "2", "2.15", "31", "9.2", "372", "51", "46", "5", "321", "4", "32", "0.74", "0.97", "1",
]);
