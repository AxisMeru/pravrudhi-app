import { expect, test } from "@playwright/test";

import { REGISTRY } from "../src/lib/workflowRegistry";

// The workflows front door (Advisor Q6; NEXT_PUBLIC_WORKFLOWS_V2=1, WORKFLOWS_BUILD=1). ON: eight registry cards, the whole card is the link, 1 column on a phone and 2 at md, Papers for a matter first and marked Start here, Workflows leads the work nav. OFF: nothing of it.
const ON = process.env.WORKFLOWS_BUILD === "1";
test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

test("flag OFF: /workflows has no registry cards and Workflows stays in the reference group", async ({ page }) => {
  test.skip(ON, "this is the flag-OFF check");
  await page.goto("/workflows");
  await expect(page.getByTestId("workflow-cards")).toHaveCount(0);
  await expect(page.getByTestId("workflows")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/screening");
  const hrefs = await page.locator("nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs.indexOf("/citations"), "Citation check is in the nav").toBeGreaterThanOrEqual(0);
  expect(hrefs.indexOf("/workflows"), "Workflows stays after the work group (Citation check)").toBeGreaterThan(hrefs.indexOf("/citations"));
});

test("flag ON: eight cards in the registry order, each a whole-card link to its tool, Available, with Uses your papers and Start here as R1 worded", async ({ page }) => {
  test.skip(!ON, "needs the build with the workflows flag");
  await page.goto("/workflows");
  const cards = page.getByTestId("workflow-cards").locator("li");
  await expect(cards).toHaveCount(8);
  for (let i = 0; i < REGISTRY.length; i++) {
    const e = REGISTRY[i];
    const card = cards.nth(i);
    await expect(card).toHaveAttribute("data-testid", `workflow-card-${e.key}`);
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(e.title);
    await expect(card).toContainText(e.line);
    await expect(card.getByTestId("workflow-card-chip")).toHaveText("Available");
    await expect(card.locator("a")).toHaveAttribute("href", `/preview#${e.anchor}`);
    if (e.usesPapers) await expect(card.getByTestId("workflow-card-papers")).toHaveText("Uses your papers"); else await expect(card.getByTestId("workflow-card-papers")).toHaveCount(0);
    if (e.startHere) await expect(card.getByTestId("workflow-card-start")).toHaveText("Start here"); else await expect(card.getByTestId("workflow-card-start")).toHaveCount(0);
  }
  await expect(cards.nth(0)).toContainText("Papers for a matter");
  expect(await page.locator("body").innerText()).not.toMatch(/preview/i);
});

test("flag ON: clicking a card lands on that tool's card on the matter-tools page", async ({ page }) => {
  test.skip(!ON, "needs the build with the workflows flag");
  await page.goto("/workflows");
  await page.getByTestId("workflow-card-wf_a3_chronology").locator("a").click();
  await expect(page).toHaveURL(/\/preview\/?#pv-a3$/);
  await expect(page.locator("#pv-a3")).toBeVisible();
});

test("flag ON at 390 px: one column, no horizontal scroll, every card at least 44 px tall", async ({ page }) => {
  test.skip(!ON, "needs the build with the workflows flag");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workflows");
  const boxes = await page.getByTestId("workflow-cards").locator("li a").evaluateAll((as) => as.map((a) => { const r = a.getBoundingClientRect(); return { x: Math.round(r.x), h: Math.round(r.height) }; }));
  expect(new Set(boxes.map((b) => b.x)).size, "one column").toBe(1);
  for (const b of boxes) expect(b.h).toBeGreaterThanOrEqual(44);
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
});

test("flag ON at 1280 px: two columns", async ({ page }) => {
  test.skip(!ON, "needs the build with the workflows flag");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/workflows");
  const xs = await page.getByTestId("workflow-cards").locator("li a").evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().x)));
  expect(new Set(xs).size).toBe(2);
});

test("flag ON: Workflows leads the work group of the nav", async ({ page }) => {
  test.skip(!ON, "needs the build with the workflows flag");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/screening");
  const hrefs = await page.locator("nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs.indexOf("/workflows"), "Workflows is in the nav").toBeGreaterThanOrEqual(0);
  expect(hrefs.indexOf("/workflows")).toBeLessThan(hrefs.indexOf("/citations"));
  expect(hrefs.indexOf("/workflows")).toBeLessThan(hrefs.indexOf("/safety"));
});
