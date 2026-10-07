import { expect, test } from "@playwright/test";

/**
 * The product status wording (#533), switched ON. It runs only against a build made with NEXT_PUBLIC_CITATION_PRODUCT_STATUS=1 and
 * CITATION_PRODUCT_STATUS_BUILD=1 in the test environment; the normal CI build leaves it off and this file is skipped there. Recorded
 * engine answers (page.route), not an index.
 */
test.skip(process.env.CITATION_PRODUCT_STATUS_BUILD !== "1", "needs a build with NEXT_PUBLIC_CITATION_PRODUCT_STATUS=1");

const ANSWERS: Record<string, { status: string; label: string }> = {
  VERIFIED: { status: "verified", label: "Verified: the citation resolves to an indexed case and the exact quote appears in its text." },
  EXISTS_QUOTE_NOT_FOUND: { status: "quote_not_found", label: "quote not found in the record" },
  NOT_IN_INDEX: { status: "not_in_index", label: "not in index" },
  CONFLICT: { status: "conflict", label: "conflict" },
  MALFORMED: { status: "malformed", label: "Exactly one parseable citation is required." },
};

for (const [result, a] of Object.entries(ANSWERS)) {
  test(`${result}: the engine's label is shown verbatim with the preview badge, beside the status`, async ({ page }) => {
    await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ json: { result, note: "A fixed note.", ...a, preview: true, verified: result === "VERIFIED" } }));
    await page.goto("/citations");
    await page.getByLabel("Citation (one)").fill("(2020) 3 SCC 456");
    await page.getByLabel("Quote to look for").fill("a quoted passage");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByTestId("citation-status")).toHaveText(result);
    await expect(page.getByTestId("citation-product-label")).toHaveText(a.label);
    await expect(page.getByTestId("citation-product-preview")).toHaveText("preview");
    await expect(page.getByText(/\bfake\b/i)).toHaveCount(0);
  });
}

test("a contradictory or unknown product status falls back to the engine's status and note, never a positive wording", async ({ page }) => {
  await page.route("**/api/v1/verify-citations", (r) =>
    r.fulfill({ json: { result: "NOT_IN_INDEX", note: "A fixed note.", status: "verified", label: "Verified: all good", preview: true, verified: true } }),
  );
  await page.goto("/citations");
  await page.getByLabel("Citation (one)").fill("c");
  await page.getByLabel("Quote to look for").fill("q");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByTestId("citation-status")).toHaveText("NOT_IN_INDEX");
  await expect(page.getByTestId("citation-product-status")).toHaveCount(0);
  await expect(page.getByText("Verified: all good")).toHaveCount(0);
});
