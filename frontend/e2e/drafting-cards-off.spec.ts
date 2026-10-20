import { expect, test } from "@playwright/test";

// Flag OFF (the default build): the bail-draft and synopsis cards, and the declaration question on them, are not on /preview. The other cards are.
test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

test("without the drafting-cards flag /preview has no bail or synopsis card and no declaration question", async ({ page }) => {
  test.skip(process.env.DRAFTING_BUILD === "1", "this is the flag-OFF check");
  await page.goto("/preview");
  await expect(page.getByTestId("pv-s3")).toBeVisible();
  await expect(page.getByTestId("pv-bail")).toHaveCount(0);
  await expect(page.getByTestId("pv-synopsis")).toHaveCount(0);
  await expect(page.getByTestId("bail-declaration")).toHaveCount(0);
  await expect(page.getByTestId("synopsis-declaration")).toHaveCount(0);
});
