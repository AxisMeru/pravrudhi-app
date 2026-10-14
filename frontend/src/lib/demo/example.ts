// The demo examples (Lead-2, 2026-10-06; extended 14 Oct 2026 after the operator's ruling: no invented cases in the product unless it genuinely makes sense). Each is the
// ALLEGATIONS recited in a public court order, loaded as the facts of a matter so a visitor can watch the screening run; the court's reasoning and decision are NOT included.
// Each example carries its CITATION exactly as the court publishes it (the neutral citation, or court + case type + number + date as printed) and a pinned sha256 of its facts.
// Changing a character changes the sha, fails the test, and requires a new check by Track B (source against the exclusion lists) and the guard.
// A demo with real names is never the default on the public site: the examples are reached only through ?example=<id> and the How it works page.

export interface DemoExample {
  id: string;
  /** The citation as printed by the court; shown under the label. Pinned by example.spec.ts. */
  citation: string;
  /** The allegations, one paragraph per line when loaded. As recited by the court: not findings. */
  facts: readonly string[];
  /** sha256 of facts.join("\n") + "\n" (UTF-8). */
  factsSha256: string;
  /** The label shown over this example (R1, 14 Oct): each says what the excerpt is, as the court recited it. */
  label: string;
  /** One line naming what the demo screens for, shown under the citation when set. */
  screeningLine?: string;
  /** The contracts the example selects (the provisions its allegations invoke). The reader can add others; a contract the registry does not mark validated is marked as such. */
  contracts: readonly string[];
}

/** R1's label for every real example (14 Oct): true for real material, never "invented". */
export const EXAMPLE_LABEL =
  "A public court order, example only. These are the allegations as the court recited them, not findings, and not a view on the case. The output of this demo is illustrative, not evidence, and no measure is quoted from it.";

// Shown when ?example=<id> names an example this app does not have.
export const EXAMPLE_NOT_FOUND_TEXT = "That example is not available.";
export const EXAMPLE_NOT_FOUND_LINK = "Try the example instead";

export const EXAMPLES: readonly DemoExample[] = [
  {
    id: "madras-public-order-2024",
    label: EXAMPLE_LABEL,
    // Court + date only (Goal, 14 Oct): nobody holds the original order's printed header; a case type and number may arrive later as its own change. Pinned by example.spec.ts.
    citation: "Madras High Court, order of 12 June 2024",
    facts: [
  "The petitioner herein is the named accused in a complaint registered by the respondent police on [date] in Cr.No.[redacted] of 2023 for the alleged offence under Sections 406 and 420 of IPC.",
  "As per the complaint, the petitioner herein got acquaintance with the defacto complainant and borrowed money to the tune of Rs.42,00,000/- since 2016. Further, the accused also subscribed one unauthorized chit run by the defacto complainant and drawn Rs.1,25,000/- and failed to repay it. When the defacto complainant demanded back the money, the petitioner promised to repay it after disposing the property, but, breached the promise and later gave five cheques, promissory note and other documents.",
  "Later, when the defacto complainant demanded money the first and the second accused who were husband and wife threatened as if they got separated and not responsible for repayment. At the same time, the first petitioner has transferred the house property in the name of the second petitioner in order to dispose it of to third parties and cheat the complainant."
],
    // The excerpt is no longer verbatim (Lead-2 and R2, 12 Oct 2026): exactly TWO substitutions were made, both in the first paragraph: the police crime number became "Cr.No.[redacted] of 2023"
    // and the registration date became "[date]". The sha256 of the ORIGINAL guard-checked text, before those substitutions, was 97df7073f7e5a82310056464e1e1a6eea340054bc4b7418658f10de008d59335.
    factsSha256: "15bbc22e072d69954ae65bde222a216417eb16477ce2e460c4b31081df51d33f",
    // the IPC provisions the complaint invokes (ss. 406 and 420 IPC: criminal breach of trust and cheating)
    contracts: ["ipc405_misappropriation", "ipc415_property"],
  },
  {
    // High Court of Karnataka, 25 March 2025: four whole sentences of the prosecution's allegations as recited, nothing edited (explorer's DISPLAYED_STRINGS_SAMPLES_v2, file sha dc4c070e8de8246e; R1 read; R2 sealed-list PASS).
    id: "karnataka-cheating-2025",
    label:
      "A public court order, example only. These are the prosecution's allegations as the court recited them, not findings by us and not a view on the case. The court's decision is not shown here. The output of this demo is illustrative, not evidence, and no measure is quoted from it.",
    citation: "High Court of Karnataka at Bengaluru, order of 25 March 2025, 2025:KHC:12773",
    screeningLine: "Screened here for the cheating (IPC 415) ingredients.",
    facts: [
      "The prosecution alleges that petitioner Nos. 1 and 2—accused Nos. 1 and 2—approached the de facto complainants and induced them to subscribe to the membership of accused No. 4 company, promising that upon investing money, they would receive gold coins. Believing these representations, the de facto complainants invested money in accused No. 4 company. Similarly, C.Ws. 11 to 15 also invested money and subscribed to the membership. Subsequently, when they approached the company requesting the issuance of gold coins or the return of their money, accused No. 4 failed to comply and instead closed the company.",
    ],
    factsSha256: "45ecf08958f567be567e7ca7855bfe0733330281b680138ca6fda9805658d408",
    contracts: ["ipc415_property"],
  },
];

/** The example for an id, or null for an id this app does not have. */
export const exampleById = (id: string | null): DemoExample | null => (id === null ? null : (EXAMPLES.find((e) => e.id === id) ?? null));

/** The first example: the one the How it works page and the "Try it" entry open. */
export const DEFAULT_EXAMPLE: DemoExample = EXAMPLES[0];
export const exampleFactsText = (e: DemoExample): string => e.facts.join("\n");
