import { expect, test } from "@playwright/test";

/**
 * "Hidden" means CLOSED (Lead-2 decision on #525, 2026-10-06): every route in this interface, visited as a member and as an
 * admin (Studio). The caller's edition is fixed by answering /api/me, so the walk does not depend on an account. A member
 * gets Matters, Settings and sign-in and nothing of the improvement loop (not even by a typed URL); Studio gets all of it.
 * NOT YET RUN in CI: needs the built interface served by an engine (see README "Testing"); the unit specs in
 * src/lib/demoPath.spec.ts and src/lib/palette.spec.ts cover the same decision table.
 */
const OPEN = ["/matters", "/settings", "/signin"];
// Every page.tsx in src/app that is not open: the improvement loop's.
const LOOP = ["/", "/start", "/objectives", "/objectives/detail", "/progress", "/memory", "/catalogue", "/chat", "/nyaya", "/runs", "/runs/view", "/models", "/install"];
const ROUTES = [...OPEN, "/partner-keys", ...LOOP];

async function asEdition(page: import("@playwright/test").Page, edition: string, access: string): Promise<void> {
  await page.route("**/api/me", (route) => route.fulfill({ json: { edition, tagline: "t", access } }));
}

for (const path of LOOP) {
  test(`a member who types ${path} does not get the page`, async ({ page }) => {
    await asEdition(page, "Pravrudhi", "member");
    await page.goto(path);
    if (path === "/") {
      await page.waitForURL(/\/matters/);
      return;
    }
    await expect(page.getByTestId("not-on-this-surface")).toBeVisible();
    await expect(page.locator("main").getByRole("heading", { name: /Objectives|Runs|Models|Chat|Nyaya|Progress|Memory|Catalogue|Start|Get it running/ })).toHaveCount(0);
  });

  test(`an admin who types ${path} gets the page`, async ({ page }) => {
    await asEdition(page, "Pravrudhi Studio", "admin");
    await page.goto(path);
    await expect(page.getByTestId("not-on-this-surface")).toHaveCount(0);
  });
}

for (const path of OPEN) {
  test(`${path} is open to a member and to an admin`, async ({ page }) => {
    for (const [edition, access] of [["Pravrudhi", "member"], ["Pravrudhi Studio", "admin"]]) {
      await asEdition(page, edition, access);
      await page.goto(path);
      await expect(page.getByTestId("not-on-this-surface")).toHaveCount(0);
    }
  });
}

test("a member's navigation offers only the kept pages", async ({ page }) => {
  await asEdition(page, "Pravrudhi", "member");
  await page.goto("/matters");
  const offered = await page.locator("nav a[href]").evaluateAll((ls) => ls.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
  for (const hidden of LOOP.filter((p) => p !== "/")) expect(offered).not.toContain(hidden);
  expect(offered).toContain("/matters");
});

test("the walk covers every route", () => {
  expect(new Set(ROUTES).size).toBe(ROUTES.length);
});
