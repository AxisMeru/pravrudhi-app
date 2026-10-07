import { expect, test } from "@playwright/test";

/**
 * The citation check (#539), against RECORDED engine answers (page.route), not an index: the preview label, the status shown verbatim
 * with the engine's note, the signed wording for each coded refusal, and that the page never says the word "fake".
 */
const NOTES: Record<string, string> = {
  VERIFIED: "The citation resolves to an indexed case and the quote appears in its text.",
  EXISTS_QUOTE_NOT_FOUND: "The citation resolves to an indexed case but the quote was not found in its text.",
  NOT_IN_INDEX: "The index holds no evidence either way: this is not a finding that the citation is fake.",
  MALFORMED: "Exactly one parseable citation is required.",
  CONFLICT: "The citation maps to conflicting indexed cases; verify by hand.",
};

async function run(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/citations");
  await page.getByLabel("Citation (one)").fill("(2020) 3 SCC 456");
  await page.getByLabel("Quote to look for").fill("a quoted passage");
  await page.getByRole("button", { name: "Check" }).click();
}

test("the page carries the preview label and says what the check is not", async ({ page }) => {
  await page.goto("/citations");
  await expect(page.getByTestId("citation-preview-label")).toHaveText("preview: accuracy study pending (#529)");
  await expect(page.getByTestId("citation-limits")).toContainText("It does not say whether the case supports a point.");
  await expect(page.getByText(/\bfake\b/i)).toHaveCount(0);
});

for (const [status, note] of Object.entries(NOTES)) {
  test(`${status} is shown verbatim${note.includes("fake") ? "; the engine note with the word \"fake\" is withheld" : " with the engine's note"}`, async ({ page }) => {
    let body: unknown = null;
    await page.route("**/api/v1/verify-citations", (r) => {
      body = r.request().postDataJSON();
      return r.fulfill({ json: { result: status, note } });
    });
    await run(page);
    await expect(page.getByTestId("citation-status")).toHaveText(status);
    if (note.includes("fake")) await expect(page.getByTestId("citation-note")).toHaveCount(0);
    else await expect(page.getByTestId("citation-note")).toHaveText(note);
    await expect(page.getByText(/\bfake\b/i)).toHaveCount(0);
    expect(body).toEqual({ citation: "(2020) 3 SCC 456", quote: "a quoted passage" });
  });
}

test("the coded refusals show the signed wording", async ({ page }) => {
  const cases: Array<[string, number, Record<string, string>, string]> = [
    ["verify_timeout", 503, {}, "The citation check did not finish in time, so no result was returned. Try again later."],
    ["verify_at_capacity", 503, { "retry-after": "5" }, "The citation check is busy, so no result was returned. Try again in a few seconds (Retry-After 5)."],
    ["citation_index_unavailable", 503, {}, "The citation index is not available, so this citation was not checked."],
  ];
  for (const [code, status, headers, text] of cases) {
    await page.unroute("**/api/v1/verify-citations").catch(() => {});
    await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ status, headers, json: { error: code } }));
    await run(page);
    await expect(page.getByTestId("citation-error")).toHaveText(text);
    await expect(page.getByTestId("citation-result")).toHaveCount(0);
  }
});

test("empty inputs send no request", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/v1/verify-citations", (r) => {
    calls += 1;
    return r.fulfill({ json: { result: "VERIFIED", note: "" } });
  });
  await page.goto("/citations");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByTestId("citation-error")).toHaveText("Enter one citation.");
  expect(calls).toBe(0);
});

test("the citation check is in the nav and open on the law-firm surface", async ({ page }) => {
  await page.goto("/matters");
  await expect(page.getByRole("link", { name: "Citation check" })).toBeVisible();
});
