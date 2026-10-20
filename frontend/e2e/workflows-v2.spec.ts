import { expect, test } from "@playwright/test";

import { REGISTRY } from "../src/lib/workflowRegistry";

// The workflows front door (Advisor Q6; NEXT_PUBLIC_WORKFLOWS_V2=1, WORKFLOWS_BUILD=1). ON: eight registry cards, the whole card is the link, 1 column on a phone and 2 at md, Papers for a matter first and marked Start here, Workflows leads the work nav. OFF: nothing of it.
const ON = process.env.WORKFLOWS_BUILD === "1";
test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

test("flag OFF: /workflows has no registry cards and Workflows does not lead the nav", async ({ page }) => {
  test.skip(ON, "this is the flag-OFF check");
  await page.goto("/workflows");
  await expect(page.getByTestId("workflow-cards")).toHaveCount(0);
  await expect(page.getByTestId("workflows")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/screening");
  const hrefs = await page.locator("nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const w = hrefs.indexOf("/workflows");
  expect(w, "Workflows is in the nav").toBeGreaterThanOrEqual(0);
  // only against links this build has: Workflows comes after Citation check where that is offered (it is not in every build's nav)
  for (const earlier of ["/citations"]) if (hrefs.includes(earlier)) expect(w, `Workflows stays after ${earlier}`).toBeGreaterThan(hrefs.indexOf(earlier));
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
    await expect(card.locator("a")).toHaveAttribute("href", `/matter-tools#${e.anchor}`);
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
  await expect(page).toHaveURL(/\/matter-tools\/?#pv-a3$/);
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
  const w = hrefs.indexOf("/workflows");
  expect(w, "Workflows is in the nav").toBeGreaterThanOrEqual(0);
  // against the links this build has (Citation check and Settings are not in every build's nav)
  for (const later of ["/citations", "/settings", "/safety"]) if (hrefs.includes(later)) expect(w, `Workflows before ${later}`).toBeLessThan(hrefs.indexOf(later));
});

// #470: the cards read the engine's own list (GET /api/v1/status `workflows`, engine 0.6.24); no field = the 0.6.23 fallback; a key that is off is a Coming card that is not a link.
const statusWith = (workflows?: Record<string, boolean>) => ({ engine_version: "0.6.24", service_window: null, judge: { state: "unknown", checked_at: null }, ...(workflows ? { workflows } : {}) });
const ALL_ON = Object.fromEntries(REGISTRY.map((e) => [e.key, true]));

test("flag ON: a workflow the engine reports off is a Coming card with no link; the others stay Available links", async ({ page }) => {
  test.skip(!ON, "needs the build with the workflows flag");
  await page.route("**/api/v1/status", (r) => r.fulfill({ json: statusWith({ ...ALL_ON, wf_a3_chronology: false }) }));
  await page.goto("/workflows");
  const card = page.getByTestId("workflow-card-wf_a3_chronology");
  await expect(card.getByTestId("workflow-card-chip")).toHaveText("Coming");
  await expect(card.locator("a")).toHaveCount(0);
  await expect(page.getByTestId("workflow-card-wf_a5_ingredient_agenda").getByTestId("workflow-card-chip")).toHaveText("Available");
  await expect(page.getByTestId("workflow-card-wf_a5_ingredient_agenda").locator("a")).toHaveCount(1);
});

test("flag ON: an engine status without the workflows field (older engine) leaves all eight Available (the 0.6.23 fallback)", async ({ page }) => {
  test.skip(!ON, "needs the build with the workflows flag");
  await page.route("**/api/v1/status", (r) => r.fulfill({ json: statusWith() }));
  await page.goto("/workflows");
  await expect(page.getByTestId("workflow-card-chip")).toHaveCount(8);
  for (const c of await page.getByTestId("workflow-card-chip").all()) await expect(c).toHaveText("Available");
});

// R1's rule (#475): the line shows only when a tool the page shows is reported off; hidden when the status cannot be read; no map = the pinned fallback (A4/A8 off).
const DRAFT = process.env.DRAFTING_BUILD === "1"; // built with the A4/A8 cards on
const ALL_TEN = { ...ALL_ON, wf_a4_bail_drafting: true, wf_a8_synopsis_list_of_dates: true };
async function line(page: import("@playwright/test").Page, status: { status?: number; json?: unknown }) {
  await page.route("**/api/v1/status", (r) => r.fulfill({ status: status.status ?? 200, json: status.json ?? {} }));
  await page.goto("/matter-tools");
  await expect(page.getByTestId("pv-matter")).toBeVisible();
  await page.waitForTimeout(600); // the status read is asynchronous: give it time to land before asserting absence
  return page.getByTestId("pv-tools-off-line");
}

test("matter-tools line: all tools the page shows are on -> hidden", async ({ page }) => {
  await expect(await line(page, { json: statusWith(DRAFT ? ALL_TEN : ALL_ON) })).toHaveCount(0);
});

test("matter-tools line: a registry tool reported off -> shown", async ({ page }) => {
  await expect(await line(page, { json: statusWith({ ...(DRAFT ? ALL_TEN : ALL_ON), wf_a6_cheque_case_check: false }) })).toBeVisible();
});

test("matter-tools line: with the A4/A8 cards on, a4 off or a8 off or a8 missing from the map -> shown", async ({ page }) => {
  test.skip(!DRAFT, "needs the build with the A4/A8 cards (DRAFTING_BUILD=1)");
  await expect(await line(page, { json: statusWith({ ...ALL_TEN, wf_a4_bail_drafting: false }) })).toBeVisible();
});

test("matter-tools line: a status that cannot be read -> hidden (never claim a tool is off on a guess)", async ({ page }) => {
  await expect(await line(page, { status: 503, json: { detail: "down" } })).toHaveCount(0);
});

test("matter-tools line: a readable status with no workflows map -> the pinned fallback: hidden with the A4/A8 cards off, shown with them on", async ({ page }) => {
  const l = await line(page, { json: statusWith() });
  if (DRAFT) await expect(l).toBeVisible(); else await expect(l).toHaveCount(0);
});
