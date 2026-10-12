import { expect, test } from "./support/engineTest";

test("the guide opens from the Screening page, shows its steps, statuses and limits, and every screenshot loads", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.goto("/screening");
  await page.getByTestId("guide-link").getByRole("link", { name: "New here? Read the user guide." }).click();
  await expect(page).toHaveURL(/\/guide\/?$/);
  await expect(page.getByRole("heading", { name: "User guide", exact: true })).toBeVisible();
  await expect(page.getByTestId("guide-step")).toHaveCount(7);
  await expect(page.getByTestId("guide-statuses")).toContainText("Needs your review");
  await expect(page.getByTestId("guide-limits")).toContainText("This is a screening aid, not legal advice. A lawyer decides.");
  await expect(page.getByTestId("guide-cold-start")).toContainText("The first analysis after idle can take a few minutes while the judges start; a later one can be faster. We have not measured typical times.");
  const imgs = page.locator('[data-testid="guide"] img');
  await expect(imgs).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    await imgs.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(() => imgs.nth(i).evaluate((el) => (el as HTMLImageElement).naturalWidth), { message: `screenshot ${i + 1} loads` }).toBeGreaterThan(0);
  }
});

test("the guide is in the nav", async ({ page }) => {
  await page.goto("/guide");
  await expect(page.getByRole("link", { name: "User guide" }).first()).toBeVisible();
});
