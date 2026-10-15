import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

/**
 * The citation check while the index answers EXISTENCE only (R1 14 Oct; pravrudhi#398/#717): runs only against a build with NEXT_PUBLIC_CITATION_NAV=1 and
 * NEXT_PUBLIC_CITATION_EXISTENCE_ONLY=1 (CITATION_NAV_BUILD=1 and CITATION_EXISTENCE_BUILD=1 in the test environment). Recorded engine answers, no index.
 */
test.skip(process.env.CITATION_EXISTENCE_BUILD !== "1" || process.env.CITATION_NAV_BUILD !== "1", "needs a build with the citation nav and existence-only flags");

const CITATION = "(2099) 1 SCC 1";
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
  await expect(page.getByText("Look up citations, up to 5 at a time, and see whether each case is in our index.")).toBeVisible();
  await expect(page.getByTestId("citation-limits")).toHaveText("The check looks for the case in our index from the citation you enter. It does not look at quotes and does not say whether the case supports a point. If we cannot match the citation to exactly one case in our index, the result is “Not found in our index”; that does not show whether the citation is real, because the index does not hold every judgment.");
  await expect(page.getByLabel("Quote to look for")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/word for word/i);
  await expect(page.getByTestId("citation-preview-label")).toBeVisible();
  await page.getByRole("textbox").fill(CITATION);
  await page.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citation-check-status")).toHaveText("Not found in our index");
  await expect(page.getByTestId("citation-check-note")).toHaveText("We could not match this citation to exactly one case in our index. That does not show whether the citation is real: the index does not hold every judgment.");
  expect(body).toEqual({ citation: CITATION });
  await expect(page.locator("body")).not.toContainText(/NOT_IN_INDEX|\bfake\b/);
});

test("/citations: a conflict reads as R1's heading; the coded refusals read in plain words and never print a code", async ({ page }) => {
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ json: { result: "CONFLICT", note: "n", status: "conflict", label: "conflict: the citation matches more than one indexed case", verified: false, preview: true } }));
  await page.goto("/citations");
  await page.getByRole("textbox").fill(CITATION);
  await page.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citation-check-status")).toHaveText("Could not match one case"); // #223 D2a (R1's 15 Oct heading; the sentence under it is pinned in the next test)
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
    await page.getByRole("button", { name: "Check citations" }).click();
    await expect(page.getByTestId("citation-check-error")).toHaveText(text);
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
  await expect(page.getByTestId("citation-signed-out")).toHaveText("Citation checks need you to be signed in."); // #223 D4: said before typing, signed out only
  await page.getByRole("textbox").fill(CITATION);
  await page.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citation-check-error")).toHaveText("Sign in to check citations. Nothing was looked up.");
  await expect(page.locator("body")).not.toContainText(/Nothing was scored|session has ended/);
  await expect(page.locator("body")).not.toContainText(/\b401\b|unauthorized/i);
  expect(new URL(page.url()).pathname).toMatch(/^\/citations\/?$/);
});

// R1, 14 Oct (#181): the arm ON: the limits text no longer says the check is not served; CONFLICT shows only the signed sentence (the engine's note is suppressed); IN_INDEX reads "Found in our index"
// with the engine's existence-only note under it.
test("/citations (existence arm ON): no 'not yet served' sentence; CONFLICT shows R1's heading and sentence; IN_INDEX reads 'Found in our index' with its note", async ({ page }) => {
  const CONFLICT = { result: "CONFLICT", note: "The citation maps to conflicting indexed cases; verify by hand.", status: "conflict", label: "conflict: the citation matches more than one indexed case", verified: false, preview: true };
  const IN_REAL = { ...IN, note: "Found in the index (existence only): no quote was checked, so this is not a verification." };
  await page.goto("/citations");
  await expect(page.getByTestId("citation-limits")).not.toContainText(/not yet served|hosted deployment/);
  await expect(page.getByTestId("citation-preview-label")).toHaveText("preview: existence check only");
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ json: CONFLICT }));
  await page.getByRole("textbox").fill(CITATION);
  await page.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citation-check-status")).toHaveText("Could not match one case"); // #223 D2a
  await expect(page.getByTestId("citation-check-note")).toHaveText("We could not match this citation to exactly one case in our index. That does not show whether the citation is real. Adding the case name before the citation may help; if it does not, check the citation by hand."); // D1
  await expect(page.locator("body")).not.toContainText(/conflicting indexed cases|verify by hand|CONFLICT/);
  await page.unroute("**/api/v1/verify-citations");
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ json: IN_REAL }));
  await page.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citation-check-status")).toHaveText("Found in our index");
  await expect(page.getByTestId("citation-check-note")).toHaveText("Found in the index (existence only): no quote was checked, so this is not a verification.");
  await expect(page.locator("body")).not.toContainText(/\bIN_INDEX\b/);
});

// #223 (explorer's pre-flip review, R1's strings): D2a MALFORMED, D3 limits before typing, D4 signed-in vs signed-out, D5 batch stop, D6 live region, D7 privacy line.
test("/citations (arm ON): a line the engine cannot read as one citation is 'Not looked up' with R1's sentence, never the raw token or 'Exactly one parseable citation is required.'", async ({ page }) => {
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ json: { result: "MALFORMED", note: "Exactly one parseable citation is required.", status: "malformed", label: "malformed", verified: false, preview: true } }));
  await page.goto("/citations");
  await page.getByRole("textbox").fill("1992 Supp (1) SCC 335");
  await page.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citation-check-status")).toHaveText("Not looked up");
  await expect(page.getByTestId("citation-check-note")).toHaveText("We could not read this line as one citation, so we did not look it up. Enter one citation per line, for example (2014) 8 SCC 273. That does not show whether a citation is real.");
  await expect(page.locator("body")).not.toContainText(/MALFORMED|Exactly one parseable/);
});

test("/citations (arm ON): what the index covers is said BEFORE typing, under the limits; the privacy line names the citation only; the result area is a live region", async ({ page }) => {
  await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } }));
  await page.goto("/citations");
  await expect(page.getByTestId("citation-coverage-limits")).toHaveText("Our index covers Supreme Court citations in the form (year) volume SCC page. A neutral citation, an AIR citation or a High Court reporter citation is not covered and will come back as \u201CNot found in our index\u201D.");
  await expect(page.getByTestId("citation-retention")).toHaveText("The citation check does not save the citation you enter."); // D7
  await expect(page.getByTestId("citation-signed-out")).toHaveCount(0); // D4: signed in, no note
  await expect(page.getByTestId("citations-panel-live")).toHaveAttribute("role", "status"); // D6: present before any result
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ json: NOT_IN }));
  await page.getByRole("textbox").fill(CITATION);
  await page.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Not found in our index" })).toBeVisible();
});

test("the Screening Citations panel (arm ON): the coverage limit before typing, the cap in the box, signed-out note, one stop at the first 429, a live region", async ({ page }) => {
  let calls = 0;
  let screened = false; // signed in while the screening runs; the panel's own identity read, made when it appears, finds nobody signed in
  await page.route("**/api/me", (r) => (screened ? r.fulfill({ status: 401, json: { error: "unauthorized" } }) : r.fulfill({ json: { email: "invented@example.invalid" } })));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts", (r) => {
    screened = true;
    return r.fulfill({ json: SCREENED });
  });
  await page.route("**/api/v1/verify-citations", (r) => {
    calls += 1;
    return calls === 3 ? r.fulfill({ status: 429, json: { error: "rate_limited" }, headers: { "retry-after": "42" } }) : r.fulfill({ json: NOT_IN });
  });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  const panel = page.getByTestId("citations-panel");
  await expect(panel.getByTestId("citations-panel-limits")).toHaveText("Our index covers Supreme Court citations in the form (year) volume SCC page. A neutral citation, an AIR citation or a High Court reporter citation is not covered and will come back as \u201CNot found in our index\u201D.");
  await expect(panel.getByTestId("citations-panel-signed-out")).toHaveText("Citation checks need you to be signed in.");
  await expect(panel).toContainText("One citation per line, at most 5 at a time.");
  await expect(panel.getByTestId("citations-panel-live")).toHaveAttribute("role", "status");
  await panel.getByRole("textbox").fill(Array.from({ length: 7 }, (_, i) => `(2099) ${i + 1} SCC 1`).join("\n"));
  await panel.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citations-panel-rate-stop")).toHaveText("Checked 2 of 5 lines. The check allows only a few lookups a minute; try the rest in 42 seconds.");
  await expect(page.getByTestId("citations-panel-row")).toHaveCount(2); // no repeated refusal rows
  await expect(page.getByTestId("citations-panel-skipped")).toHaveCount(0); // the run stopped at the rate limit: the stop sentence is the one message
  expect(calls).toBe(3); // nothing sent after the first 429
  // more lines than one try takes, no rate limit: R1's over-cap sentence, once
  calls = -100; // no 429 from here on
  await panel.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citations-panel-skipped")).toHaveText("Only the first 5 lines were checked. Check the rest in a second try.");
  await expect(page.getByTestId("citations-panel-row")).toHaveCount(5);
  await expect(page.locator("body")).not.toContainText(/Nothing was scored|Too many requests/);
  await expect(page.getByTestId("citations-panel-results")).toHaveAttribute("role", "status");
});
