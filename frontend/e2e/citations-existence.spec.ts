import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

/**
 * The citation check while the index answers EXISTENCE only (R1 14 Oct; pravrudhi#398/#717): runs only against a build with NEXT_PUBLIC_CITATION_NAV=1 and
 * NEXT_PUBLIC_CITATION_EXISTENCE_ONLY=1 (CITATION_NAV_BUILD=1 and CITATION_EXISTENCE_BUILD=1 in the test environment). Recorded engine answers, no index.
 */
test.skip(process.env.CITATION_EXISTENCE_BUILD !== "1" || process.env.CITATION_NAV_BUILD !== "1", "needs a build with the citation nav and existence-only flags");

const CITATION = "(2020) 3 SCC 456";
const NOT_IN = { result: "NOT_IN_INDEX", note: "The case was not found in our index. That does not show whether the citation is real: the index does not hold every judgment.", status: "not_in_index", label: "not in index", verified: false, preview: true };
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const SCREENED = {
  run_id: "r-invented-cite", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: [{ contract_id: "ipc415_property", outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }] }],
};
const IN = { result: "IN_INDEX", note: "A fixed note.", status: "in_index", label: "Found in the index (existence only): no quote was checked, so this is not a verification.", verified: false, preview: true };

test("/citations: R1's subtitle and paragraph, no quote field, no word-for-word sentence, the form sends the citation alone", async ({ page }) => {
  let body: Record<string, unknown> | null = null;
  await page.route("**/api/v1/verify-citations", (r) => {
    body = r.request().postDataJSON();
    return r.fulfill({ json: NOT_IN });
  });
  await page.goto("/citations");
  await expect(page.getByText("Look up one citation and see whether the case is in our index.")).toBeVisible();
  await expect(page.getByTestId("citation-limits")).toHaveText("The check looks for the case in our index from the citation you enter. It does not look at quotes and does not say whether the case supports a point. If we cannot match the citation to exactly one case in our index, the result is “Not found in our index”; that does not show whether the citation is real, because the index does not hold every judgment. This check is not yet served in the hosted deployment.");
  await expect(page.getByLabel("Quote to look for")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/word for word/i);
  await expect(page.getByTestId("citation-preview-label")).toBeVisible();
  await page.getByLabel("Citation (one)").fill(CITATION);
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByTestId("citation-status")).toHaveText("Not found in our index");
  await expect(page.getByTestId("citation-note")).toHaveText("We could not match this citation to exactly one case in our index. That does not show whether the citation is real: the index does not hold every judgment.");
  expect(body).toEqual({ citation: CITATION });
  await expect(page.locator("body")).not.toContainText(/NOT_IN_INDEX|\bfake\b/);
});

test("/citations: a conflict reads as R1's sentence; the coded refusals read in plain words and never print a code", async ({ page }) => {
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ json: { result: "CONFLICT", note: "n", status: "conflict", label: "conflict: the citation matches more than one indexed case", verified: false, preview: true } }));
  await page.goto("/citations");
  await page.getByLabel("Citation (one)").fill(CITATION);
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByTestId("citation-status")).toHaveText("The citation matches more than one case in our index, so we cannot tell which you mean.");
  const cases: Array<[number, Record<string, unknown>, Record<string, string>, string]> = [
    [422, { error: "quote_not_served" }, {}, "This check cannot look at quotes. It can only tell you whether we can match the citation to a case in our index."],
    [422, { detail: [{ msg: "x" }] }, {}, "Enter one citation, and leave the quote empty."],
    [503, { error: "citation_index_unavailable" }, {}, "The citation index is not available, so this citation was not checked."],
    [503, { error: "verify_timeout" }, {}, "The citation check did not finish in time, so no result was returned. Try again later."],
    [503, { error: "verify_at_capacity" }, { "retry-after": "5" }, "The citation check is busy, so no result was returned. Try again in about 5 seconds."],
  ];
  for (const [status, json, headers, text] of cases) {
    await page.unroute("**/api/v1/verify-citations");
    await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ status, json, headers }));
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByTestId("citation-error")).toHaveText(text);
    await expect(page.locator("body")).not.toContainText(/quote_not_served|citation_index_unavailable|verify_timeout|verify_at_capacity/);
  }
});

test("the Screening Citations panel: R1's line, no quote is sent even after a |, and the row says the quote was not checked", async ({ page }) => {
  const bodies: Array<Record<string, unknown>> = [];
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/v1/verify-citations", (r) => {
    bodies.push(r.request().postDataJSON());
    return r.fulfill({ json: IN });
  });
  await page.route("**/api/v1/analyse-facts", (r) => r.fulfill({ json: SCREENED }));
  await page.goto("/screening"); // the panel sits below a screening result
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  const panel = page.getByTestId("citations-panel");
  await expect(panel).toContainText("The citation is looked up in our index; quotes are not checked.");
  await expect(panel).not.toContainText(/add them after a \|/);
  await panel.getByRole("textbox").fill(`${CITATION} | some words\n(2019) 1 SCC 2`);
  await panel.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citations-panel-row")).toHaveCount(2);
  await expect.poll(() => bodies.length).toBe(2); // the checks run one after the other
  expect(bodies).toEqual([{ citation: CITATION }, { citation: "(2019) 1 SCC 2" }]);
  await expect(page.getByTestId("citations-panel-quote-note")).toHaveCount(1);
  await expect(page.getByTestId("citations-panel-quote-note")).toHaveText("Only the citation was looked up; the quote was not checked.");
});

// Lead-2 (14 Oct): both arms through the Worker. Anonymous: the Worker answers 401 and the page shows the signed sign-in sentence (never a raw 401, never a redirect away from the page).
// Signed in: the answer is the existence-only wording (covered above). This build has NEXT_PUBLIC_SUPABASE_URL set, so a redirect would be visible as a change of path.
test("/citations anonymous (the Worker answers 401): the signed sign-in sentence, no raw 401, no redirect to /signin", async ({ page }) => {
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ status: 401, json: { error: "unauthorized" } }));
  await page.route("**/api/me", (r) => r.fulfill({ status: 401, json: { error: "unauthorized" } }));
  await page.goto("/citations");
  await page.getByLabel("Citation (one)").fill(CITATION);
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByTestId("citation-error")).toHaveText("You are not signed in, or your session has ended. Nothing was scored. Sign in and try again.");
  await expect(page.locator("body")).not.toContainText(/\b401\b|unauthorized/i);
  expect(new URL(page.url()).pathname).toMatch(/^\/citations\/?$/);
});
