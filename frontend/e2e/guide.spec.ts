import { expect, test } from "./support/engineTest";

// A build with both citation flags (the panel) describes the panel (R1's flip text); any other build says the check is not offered. Neither shows frame 05 until it is retaken on a
// build with both flags on, so the guide has five screenshots on every build today.
const PANEL = process.env.CITATION_NAV_BUILD === "1" && process.env.CITATION_EXISTENCE_BUILD === "1";
const IMAGES = 5;

test("the guide opens from the Screening page, shows its steps, statuses and limits, and every screenshot loads", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.goto("/screening");
  await page.getByTestId("about-screening").locator("summary").click();
  await page.getByTestId("guide-link").getByRole("link", { name: "New here? Read the user guide." }).click();
  await expect(page).toHaveURL(/\/guide\/?$/);
  await expect(page.getByRole("heading", { name: "User guide", exact: true })).toBeVisible();
  await expect(page.getByTestId("guide-step")).toHaveCount(7);
  await expect(page.getByTestId("guide-covered").locator("li")).toHaveCount(8);
  await expect(page.getByTestId("guide-covered")).toContainText("Offences not on this list are referred back to you.");
  await expect(page.getByTestId("guide-glossary")).toContainText("A fact that may defeat the claim: a fact in your papers that, if it holds, answers the claim");
  await expect(page.getByTestId("guide-about")).toContainText("Nyāya is the Indian school of reasoning");
  await expect(page.getByTestId("guide-statuses")).toContainText("Needs your review");
  await expect(page.getByTestId("guide-limits")).toContainText("This is a screening aid, not legal advice. A lawyer decides.");
  await expect(page.getByTestId("guide-cold-start")).toContainText("The first screening after a quiet period can take a few minutes to start; a later one can be faster. The time varies; the page counts it, says so if it is slow, and you can cancel at any point.");
  await expect(page.getByTestId("guide-caption")).toHaveText(["This row has no cited fact: the screening found no fact in your papers that supports this ingredient, so it asks you to look for one. When an ingredient is supported, its row names the fact it cites and shows that fact from your text."]);
  const step6 = page.getByTestId("guide-step").nth(5);
  if (PANEL) {
    await expect(step6).toContainText("The citations panel below the checklist looks up one case citation that you enter in our index. It tells you whether we can match the citation to exactly one case in the index. It does not look at quotes, and it does not tell you whether the citation is real, because the index does not hold every judgment. The panel is labelled preview: existence check only.");
    await expect(page.getByTestId("guide-limits")).toContainText("The citation check looks the case up in our index from the citation alone and does not look at quotes.");
  } else {
    await expect(step6).toContainText("A citation check is not offered in this version of the app. When it is offered, it will tell you whether we can match a citation to exactly one case in our index; it will not look at quotes, and it will not tell you whether a citation is real.");
    await expect(page.getByTestId("guide-limits")).toContainText("The citation check is not offered in this version of the app.");
  }
  await expect(page.getByTestId("guide")).not.toContainText(/dev stack only|not (yet )?served/i);
  const imgs = page.locator('[data-testid="guide"] img');
  await expect(imgs).toHaveCount(IMAGES);
  for (let i = 0; i < IMAGES; i++) {
    await imgs.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(() => imgs.nth(i).evaluate((el) => (el as HTMLImageElement).naturalWidth), { message: `screenshot ${i + 1} loads` }).toBeGreaterThan(0);
  }
});

test("the guide is in the nav", async ({ page }) => {
  await page.goto("/guide");
  await expect(page.getByRole("link", { name: "User guide" }).first()).toBeVisible();
});
