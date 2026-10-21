import { expect, test } from "@playwright/test";

// UX polish #6 (Lead-2, 21 Oct; R1's label "Matter tools", 03c5481ef61b7703): the core workspace has its own sidebar entry directly after Workflows, in whichever layout the build has. Navigation only.
test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

test("the sidebar has a 'Matter tools' entry right after Workflows and it goes to /matter-tools", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/workflows");
  const side = page.locator("aside");
  await expect(side.getByRole("link", { name: "Matter tools", exact: true })).toHaveAttribute("href", "/matter-tools");
  const hrefs = await side.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const w = hrefs.indexOf("/workflows");
  expect(w).toBeGreaterThanOrEqual(0);
  expect(hrefs[w + 1], "directly after Workflows").toBe("/matter-tools");
  expect(hrefs.filter((h) => h === "/matter-tools"), "one entry only").toHaveLength(1);
  await side.getByRole("link", { name: "Matter tools", exact: true }).click();
  await expect(page).toHaveURL(/\/matter-tools\/?$/);
  await expect(side.getByRole("link", { name: "Matter tools", exact: true })).toHaveAttribute("aria-current", "page");
});
