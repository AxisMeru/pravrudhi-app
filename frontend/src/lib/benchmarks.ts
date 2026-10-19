// The benchmarks page (R1's value statements, 13 Oct 2026; Lead-2 decision: a short "How we test" page with no figures). Every sentence is R1's, word for word.
// The earlier results machinery (reviewed blocks, tables, bounds, paired tests, outcome chips, the loader and its validator) is retired for the MVP; the page is static.
// What stays of the validator is a banned-word lint over these strings (benchmarks.spec.ts).

export const PAGE_TITLE = "Benchmarks";
export const PAGE_SUBTITLE = "What we check, and what the checks do and do not show.";

export const BENCHMARK_STATEMENTS: readonly string[] = [
  "Court material: fixed sets of real Indian court items the screen is checked against. A result shows what the screen did on that set, not a promise about your matter.",
  "Citation checker: in our study we planted wrong quotes in citations to see whether the checker would accept them. The citation check in the app checks that the case exists in our index; it does not check the quote and does not tell you whether the case supports your point.",
  "Public test: a United States rule-application benchmark, used only to see whether the element-by-element method helps on a public task. It is not an Indian-law claim.",
  "Legal-knowledge test: how our models do on an Indian legal-knowledge multiple-choice test. It is not a measure of what the product does.",
];

export const HOW_WE_TEST_HEADING = "How we test";
export const HOW_WE_TEST =
  "Items are court-derived. The sets were reused to compare candidates, so results are not fresh-test estimates. Each result is checked by a second model reviewer.";

/** NyayaSiddhi (the open development benchmark, #638): a link and a short blurb under it, no figure. Strings unchanged. */
export const NYAYASIDDHI_URL = "https://huggingface.co/datasets/AxisMeru/nyayasiddhi";
export const NYAYASIDDHI_LINK_TEXT = "NyayaSiddhi v0.2: open Indian element-by-element development benchmark (data + scorer)";
export const NYAYASIDDHI_BLURB = "development benchmark; descriptive; no ranking";

export const FOOTER_TEXT = "Research results, not legal advice.";

/** The strings the lint reads: everything the page words itself (the NyayaSiddhi link and blurb are pinned exactly and linted by their own rule). */
export const BENCHMARK_COPY: readonly string[] = [PAGE_SUBTITLE, ...BENCHMARK_STATEMENTS, HOW_WE_TEST, FOOTER_TEXT];
