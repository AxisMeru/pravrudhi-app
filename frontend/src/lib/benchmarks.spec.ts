import { strict as assert } from "node:assert";
import test from "node:test";

import { BENCHMARK_COPY, BENCHMARK_STATEMENTS, FOOTER_TEXT, HOW_WE_TEST, HOW_WE_TEST_HEADING, NYAYASIDDHI_BLURB, NYAYASIDDHI_LINK_TEXT, NYAYASIDDHI_URL, PAGE_SUBTITLE, PAGE_TITLE } from "./benchmarks";

test("the benchmarks page says exactly R1's strings (13 Oct), in his order", () => {
  assert.equal(PAGE_TITLE, "Benchmarks");
  assert.equal(PAGE_SUBTITLE, "What we check, and what the checks do and do not show.");
  assert.deepEqual([...BENCHMARK_STATEMENTS], [
    "Court material: fixed sets of real Indian court items the screen is checked against. A result shows what the screen did on that set, not a promise about your matter.",
    "Citation checker (labelled preview): in our study we planted wrong quotes in citations to see whether the checker would accept them. The preview in the app checks that the case exists in our index; it does not check the quote and does not tell you whether the case supports your point.",
    "Public test: a United States rule-application benchmark, used only to see whether the element-by-element method helps on a public task. It is not an Indian-law claim.",
    "Legal-knowledge test: how our models do on an Indian legal-knowledge multiple-choice test. It is not a measure of what the product does.",
  ]);
  assert.equal(HOW_WE_TEST_HEADING, "How we test");
  assert.equal(
    HOW_WE_TEST,
    "Items are real court-derived or labelled constructed. The sets were reused to compare candidates, so results are not fresh-test estimates. Each result is checked by a second, independent model reviewer.",
  );
  assert.equal(NYAYASIDDHI_URL, "https://huggingface.co/datasets/AxisMeru/nyayasiddhi");
  assert.equal(NYAYASIDDHI_LINK_TEXT, "NyayaSiddhi v0.2: open Indian element-proof development benchmark (data + scorer)");
  assert.equal(NYAYASIDDHI_BLURB, "development benchmark; descriptive; no ranking");
  assert.equal(FOOTER_TEXT, "Research results, not legal advice.");
});

// What is left of the retired validator: a banned-word lint, and "no figure" over every string the page shows.
test("the lint: no banned word, no digit, no percentage, no interval, bound, n or p value in anything the page shows", () => {
  for (const s of BENCHMARK_COPY) {
    assert.doesNotMatch(s, /\b(proof|proofs|proved|proven|prove|proves|established|verbatim|word[- ]for[- ]word)\b/i, s); // "quote" is allowed here: R1's citation-checker line is about quotes
    assert.doesNotMatch(s.replace(/NyayaSiddhi v0\.2/, "NyayaSiddhi"), /\d/, s);
    assert.doesNotMatch(s, /%|interval|upper bound|\bbound\b|McNemar|\bn\s*=|p value|chance level|leaderboard|\brank/i, s);
  }
});
