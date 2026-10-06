// The demo example (Lead-2's decision, 2026-10-06): the ALLEGATIONS recited in a public Madras High Court order, loaded
// as the facts of a matter so a visitor can watch the analysis run. Words are the order's own (paras 1-3 of the order in
// Crl.O.P. No. 13624 of 2024); the court's reasoning and decision are NOT included. The text was guard-checked as exactly this
// string (sha256 below); changing a character changes the sha, fails the test, and requires a new guard check.
export const EXAMPLE_ID = "madras-crl-op-13624-2024";

// The label names the case by what the order's own header says (court, case number, date), which anyone can check against
// the order. The CNR in the team's source index is NOT shown: the index row's cnr field reads "unavailable" and the CNR is
// not in the order's text, so it cannot be verified from the judgment (Lead-2, 2026-10-06).
export const EXAMPLE_LABEL =
  "Public Madras High Court judgment (Crl.O.P. No. 13624 of 2024, order dated 12 June 2024), example only. The output of " +
  "this demo is illustrative, not evidence, and no measure is quoted from it.";

// The paragraphs, one per line when loaded. Allegations in a complaint, as recited by the Court: not findings.
export const EXAMPLE_FACTS: readonly string[] = [
  "The petitioner herein is the named accused in a complaint registered by the respondent police on 07.11.2023 in Cr.No.325 of 2023 for the alleged offence under Sections 406 and 420 of IPC.",
  "As per the complaint, the petitioner herein got acquaintance with the defacto complainant and borrowed money to the tune of Rs.42,00,000/- since 2016. Further, the accused also subscribed one unauthorized chit run by the defacto complainant and drawn Rs.1,25,000/- and failed to repay it. When the defacto complainant demanded back the money, the petitioner promised to repay it after disposing the property, but, breached the promise and later gave five cheques, promissory note and other documents.",
  "Later, when the defacto complainant demanded money the first and the second accused who were husband and wife threatened as if they got separated and not responsible for repayment. At the same time, the first petitioner has transferred the house property in the name of the second petitioner in order to dispose it of to third parties and cheat the complainant."
];

// sha256 of EXAMPLE_FACTS.join("\n") + "\n" (UTF-8), the exact text the guard checked.
export const EXAMPLE_FACTS_SHA256 = "97df7073f7e5a82310056464e1e1a6eea340054bc4b7418658f10de008d59335";

export const EXAMPLE_FACTS_TEXT = EXAMPLE_FACTS.join("\n");

// The contracts the example selects: the IPC provisions the complaint invokes (ss. 406 and 420 IPC: criminal breach of
// trust and cheating). The reader can add others; a contract the registry does not mark validated is marked as such.
export const EXAMPLE_CONTRACTS: readonly string[] = ["ipc405_misappropriation", "ipc415_property"];
