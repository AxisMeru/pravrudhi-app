// The five steps shown on the How it works page (Lead-2's decision on #525); R1 reviews the words.
export const STEPS: { title: string; body: string }[] = [
  {
    title: "Paste the facts and name the offence",
    body:
      "The example loads the allegations recited in a public High Court order as numbered facts, with the offences it invokes " +
      "selected. You can edit, add or remove facts before you screen them.",
  },
  {
    title: "Read the ingredients as a checklist",
    body: "Each offence lists the ingredients the provision requires, with a short prompt on what to check for each.",
  },
  {
    title: "See which ingredients your facts support",
    body:
      "Each ingredient is marked Supported by a fact, Not supported by these facts, or Needs your review, with the reason. " +
      "A supported ingredient shows the fact of yours it cites, as you wrote it; nothing is filled in to look complete.",
  },
  {
    title: "Read the summary and the referral",
    body:
      "The banner says how many ingredients have a supporting fact and how many need your review. Anything uncertain is " +
      "referred to a lawyer instead of guessed. A contract the registry does not list as validated carries the mark " +
      "\"not validated, verify\".",
  },
  {
    title: "Download the memo and the audit trail",
    body: "The memo lists the checklist, the cited facts, the review items and the versions; the audit trail is the request and the response.",
  },
  {
    title: "Read the safety record",
    body: "What was measured, on what material and with which models, set beside what it did not cover.",
  },
];
