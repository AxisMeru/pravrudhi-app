import { expect, test } from "@playwright/test";

// Runs only against a build made with NEXT_PUBLIC_DEMO_PATH=1 (the hosted partner demo).
test.skip(process.env.DEMO_PATH_BUILD !== "1", "needs a NEXT_PUBLIC_DEMO_PATH=1 build");

test("the default demo navigation offers the demo path and no US-case content", async ({ page }) => {
  await page.goto("/matters");
  const offered = await page.locator("nav a[href]").evaluateAll((ls) => ls.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
  expect(offered).toContain("/matters");
  expect(offered).not.toContain("/nyaya");
});

test("home routes to the demo", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/\/matters/);
});
