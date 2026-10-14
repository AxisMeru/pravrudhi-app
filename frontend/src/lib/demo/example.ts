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
    // TODO(Track B): the full citation as printed (court + case type + number + date). Until it is supplied the citation is the court and date only, as before.
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
];

/** The example for an id, or null for an id this app does not have. */
export const exampleById = (id: string | null): DemoExample | null => (id === null ? null : (EXAMPLES.find((e) => e.id === id) ?? null));

/** The first example: the one the How it works page and the "Try it" entry open. */
export const DEFAULT_EXAMPLE: DemoExample = EXAMPLES[0];
export const exampleFactsText = (e: DemoExample): string => e.facts.join("\n");
