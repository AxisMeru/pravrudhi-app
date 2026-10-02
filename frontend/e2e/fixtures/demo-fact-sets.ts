import type { DemoFixture } from "../../src/lib/demoCheck";

// Invented for the demo; none is drawn from any evaluation set. contractId and expectedOutcome stay null until
// each fixture has been run live (3 runs per wording in one window) and the result recorded on the issue.
export const DEMO_FIXTURES: DemoFixture[] = [
  {
    id: "proof-plain",
    path: "PROOF",
    wording: "plain",
    contractId: null,
    expectedOutcome: null,
    facts: [
      "Meera sold Arjun a second-hand scooter and told him it had never been in an accident.",
      "She knew it had been in a serious accident and had been repaired.",
      "Arjun paid Meera 40,000 rupees because of what she told him.",
    ],
  },
  {
    id: "proof-formal",
    path: "PROOF",
    wording: "formal",
    contractId: null,
    expectedOutcome: null,
    facts: [
      "The accused represented to the complainant that the vehicle had not been involved in any accident.",
      "The accused had knowledge that the vehicle had been involved in a serious accident.",
      "The complainant, induced by that representation, delivered 40,000 rupees to the accused.",
    ],
  },
  {
    id: "abstain-plain",
    path: "ABSTAIN",
    wording: "plain",
    contractId: null,
    expectedOutcome: null,
    facts: ["Someone said something about money last week.", "Nobody remembers who was there."],
  },
  {
    id: "refer-plain",
    path: "REFER_TO_LAWYER",
    wording: "plain",
    contractId: null,
    expectedOutcome: null,
    facts: [
      "Dev may have taken the keys from the office, or he may have been given them; accounts differ.",
      "The keys were returned two days later.",
    ],
  },
];
