import { expect, test } from "./support/engineTest";
import { isLayoutB, openReference } from "./support/layout";

// A build with both citation flags (the panel) describes the panel (R1's flip text) and shows the retaken frame 05 with its caption; any other build says the check is not offered and has
// no frame 05 (five screenshots).
const PANEL = process.env.CITATION_NAV_BUILD === "1" && process.env.CITATION_EXISTENCE_BUILD === "1";
const IMAGES = PANEL ? 6 : 5;

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
  await expect(page.getByTestId("guide-caption")).toHaveText([...((await isLayoutB(page)) ? [] : ["This row has no cited fact: the screening found no fact in your papers that supports this ingredient, so it asks you to look for one. When an ingredient is supported, its row names the fact it cites and shows that fact from your text."]), ...(PANEL ? ["Existence check only."] : [])]); // layout B's frame 03 shows a Supported by a fact row, so it carries no such caption
  const step6 = page.getByTestId("guide-step").nth(5);
  if (PANEL) {
    await expect(step6).toContainText("The citations panel below the checklist looks up the case citations that you enter, one per line, in our index. For each one it tells you whether we can match the citation to exactly one case in the index. It does not look at quotes, and it does not tell you whether a citation is real, because the index does not hold every judgment.");
    await expect(page.getByTestId("guide-limits")).toContainText("The citation check looks the case up in our index from the citation alone and does not look at quotes.");
  } else {
    await expect(step6).toContainText("A citation check is not offered in this version of the app. When it is offered, it will tell you whether we can match a citation to exactly one case in our index; it will not look at quotes, and it will not tell you whether a citation is real.");
    await expect(page.getByTestId("guide-limits")).toContainText("The citation check is not offered in this version of the app.");
  }
  await expect(page.getByTestId("guide")).not.toContainText(/dev stack only|not (yet )?served/i);
  // #416: layout B shows the retaken frames (public/guide/lb) with R1's wording; the live layout keeps the old frames, the development-stack note and "Open Matter"
  const lb = await isLayoutB(page);
  const note = page.getByTestId("guide-screenshot-note");
  const step1 = page.getByTestId("guide-step").first();
  if (lb) {
    await expect(note).toHaveText("These screenshots show an invented example, not a real screening. They show no result beyond what the example screen displays.");
    await expect(step1).toContainText("Open This screening in the menu.");
    await expect(step1.locator("img")).toHaveAttribute("src", "/guide/lb/01-screening-input.png");
    await expect(page.getByTestId("guide-step").nth(2).locator("img")).toHaveAttribute("alt", /^The result of a screening of an invented plot-sale example, not a real screening: /);
    await expect(page.getByTestId("guide-step").nth(6)).toContainText("so keep them with the other papers of the screening.");
  } else {
    await expect(note).toContainText("These screenshots were captured on a development stack, not on the live service.");
    await expect(step1).toContainText("Open Matter in the menu.");
    await expect(page.getByTestId("guide-step").nth(6)).toContainText("so keep them as you would the matter file.");
    await expect(step1.locator("img")).toHaveAttribute("src", "/guide/01-screening-input.png");
  }
  const imgs = page.locator('[data-testid="guide"] img:not([data-testid^="film-poster"])'); // the film's posters (print-only app#414, and the narrated guide film's poster) are not guide screenshots
  await expect(imgs).toHaveCount(IMAGES);
  for (let i = 0; i < IMAGES; i++) {
    await imgs.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(() => imgs.nth(i).evaluate((el) => (el as HTMLImageElement).naturalWidth), { message: `screenshot ${i + 1} loads` }).toBeGreaterThan(0);
  }
});

test("the guide is in the nav", async ({ page }) => {
  await page.goto("/guide");
  if (await isLayoutB(page)) {
    // layout B: with Reference open (opened only if it is closed) the guide link is visible, points at /guide and is the current page
    await openReference(page);
    const link = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "User guide", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /\/guide\/?$/);
    await expect(link).toHaveAttribute("aria-current", "page");
  }
  await expect(page.getByRole("link", { name: "User guide" }).first()).toBeVisible();
});
