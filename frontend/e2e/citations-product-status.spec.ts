import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "./support/engineTest";

/**
 * The product status wording (#533), switched ON. It runs only against a build made with NEXT_PUBLIC_CITATION_PRODUCT_STATUS=1 and
 * CITATION_PRODUCT_STATUS_BUILD=1 in the test environment; the normal CI build leaves it off and this file is skipped there. Recorded
 * engine answers (page.route), not an index.
 */
test.skip(process.env.CITATION_PRODUCT_STATUS_BUILD !== "1", "needs a build with NEXT_PUBLIC_CITATION_PRODUCT_STATUS=1");

// The engine's own labels, verbatim (src/lib/fixtures/engineCitationLabels.json: source file and engine sha in its header).
const ANSWERS = JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "fixtures", "engineCitationLabels.json"), "utf8")).labels as Record<string, { status: string; label: string }>;

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
    // no result, IN_INDEX included, carries an icon, a tick or a verified colour (R1): one neutral style for every status
    await expect(page.getByTestId("citation-result").locator("svg, img")).toHaveCount(0);
    expect(await page.getByTestId("citation-result").innerHTML()).not.toMatch(/emerald|green|✓|✔/);
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

test("with the nav flag on, the citation check is in the nav", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD !== "1", "needs a build with NEXT_PUBLIC_CITATION_NAV=1");
  await page.goto("/matters");
  await expect(page.getByRole("link", { name: "Citation check" })).toBeVisible();
});
