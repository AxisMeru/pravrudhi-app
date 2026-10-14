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
      "Each ingredient is marked Supported by a fact, No fact cited, or Needs your review, with the reason. " +
      "A supported ingredient shows the fact of yours it cites, as you wrote it; nothing is filled in to look complete.",
  },
  {
    title: "Read the summary and the referral",
    // R1 (13 Oct, #115): the first sentence is his. The pieces after it are the earlier wording, kept as separate literals.
    body: [
      "The banner counts the rows in each state that applies, in the same words as the rows. ",
      "Anything uncertain is ",
      "referred to a lawyer instead of guessed. A contract the registry does not list as validated carries the mark ",
      "\"not validated, verify\".",
    ].join(""),
  },
  {
    title: "Download the memo and the run record",
    body: "The memo lists the checklist, the cited facts, the review items and the versions; the run record is the request and the response.",
  },
  {
    title: "Read the safety record",
    body: "How the screen behaved on real court material we had already seen, and what that does not cover.",
  },
];
