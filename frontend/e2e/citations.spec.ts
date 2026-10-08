import { expect, test } from "@playwright/test";

/**
 * The citation check (#539), against RECORDED engine answers (page.route), not an index: the preview label, the status shown verbatim
 * with the engine's note, the signed wording for each coded refusal, and that the page never says the word "fake".
 */
const NOTES: Record<string, string> = {
  VERIFIED: "The citation resolves to an indexed case and the quote appears in its text.",
  EXISTS_QUOTE_NOT_FOUND: "The citation resolves to an indexed case but the quote was not found in its text.",
  NOT_IN_INDEX: "The case was not found in our index. That does not show whether the citation is real: the index does not hold every judgment.",
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
  await expect(page.getByTestId("citation-preview-label")).toHaveText("preview: accuracy not yet measured");
  await expect(page.getByTestId("citation-limits")).toHaveText(
    "The check looks for the case in our index and for the quote in its text, word for word apart from line breaks, quote marks, dashes and spacing. It does not say whether the case supports a point. A result of NOT_IN_INDEX means the case was not found in our index; that does not show whether the citation is real, because the index does not hold every judgment.",
  );
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

test("an engine note carrying the word \"fake\" is withheld, the status still shown", async ({ page }) => {
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ json: { result: "NOT_IN_INDEX", note: "Not a finding that the citation is fake." } }));
  await run(page);
  await expect(page.getByTestId("citation-status")).toHaveText("NOT_IN_INDEX");
  await expect(page.getByTestId("citation-note")).toHaveCount(0);
});

test("the coded refusals show the signed wording", async ({ page }) => {
  const cases: Array<[string, number, Record<string, string>, string]> = [
    ["verify_timeout", 503, {}, "The citation check did not finish in time, so no result was returned. Try again later."],
    ["verify_at_capacity", 503, { "retry-after": "5" }, "The citation check is busy, so no result was returned. Try again in about 5 seconds."],
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

test("the citation check is not in the nav until the build turns it on, and the page still opens by URL", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD === "1", "the nav-on build is covered in citations-product-status.spec.ts");
  await page.goto("/matters");
  await expect(page.getByRole("link", { name: "Matters" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Citation check" })).toHaveCount(0);
  await page.goto("/citations");
  await expect(page.getByTestId("citation-preview-label")).toBeVisible();
});

test("the product status fields are wired but OFF: an engine that sends them changes nothing on the page in this build", async ({ page }) => {
  await page.route("**/api/v1/verify-citations", (r) =>
    r.fulfill({ json: { result: "NOT_IN_INDEX", note: NOTES.NOT_IN_INDEX, status: "not_in_index", label: "not in index", preview: true, verified: false } }),
  );
  await run(page);
  await expect(page.getByTestId("citation-status")).toHaveText("NOT_IN_INDEX");
  await expect(page.getByTestId("citation-note")).toHaveText(NOTES.NOT_IN_INDEX);
  await expect(page.getByTestId("citation-product-status")).toHaveCount(0);
});
