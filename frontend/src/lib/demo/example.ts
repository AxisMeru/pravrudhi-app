// The demo example: an INVENTED sample (Lead-2, 14 Oct 2026). It replaces the earlier example, which recited the allegations of a real public court order: this public
// repository and app carry no real-person or real-case material in any example, screenshot or test. Every person, place, amount and date below is made up. Loaded as
// the facts of a matter so a visitor can watch the screening run; the output is illustrative only. R1 words the label and the not-found notice.
export const EXAMPLE_ID = "toy-lorry-sample";

export const EXAMPLE_LABEL =
  "An invented sample, example only: the people, places, amounts and dates are made up. The output of this demo is illustrative, not evidence, and no measure is quoted from it.";

// Shown when /screening?example=<id> names an example this app does not have (for instance a link to a retired example), with a link to the sample.
export const EXAMPLE_NOT_FOUND_TEXT = "That example is not available.";
export const EXAMPLE_NOT_FOUND_LINK = "Try the sample instead";

// The facts, one per line when loaded.
export const EXAMPLE_FACTS: readonly string[] = [
  "Ravi agreed to sell Meena a toy lorry for 500 rupees.",
  "Meena paid Ravi 500 rupees in cash on 3 March.",
  "Ravi told Meena the lorry was ready in his shop.",
  "No lorry was ever handed to Meena.",
  "Ravi stopped answering her calls after 5 March.",
];

// sha256 of EXAMPLE_FACTS.join("\n") + "\n" (UTF-8): changing a character changes the sha, fails the test, and requires a new identifier check.
export const EXAMPLE_FACTS_SHA256 = "22c349330d63c965b67beb3281f2f1576d59b061cb59f20f5814129bc96724b7";

export const EXAMPLE_FACTS_TEXT = EXAMPLE_FACTS.join("\n");

// The contract the sample selects: cheating (the offence of the sample). The reader can add others; a contract the registry does not mark validated is marked as such.
export const EXAMPLE_CONTRACTS: readonly string[] = ["ipc415_property"];
