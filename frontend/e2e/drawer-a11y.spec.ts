import { expect, test } from "./support/engineTest";

// D1 + D2 (explorer review of the live alias): on a phone the closed drawer must not leave controls in the tab order; the open drawer is a modal dialog that Escape closes, and the page behind is inert.
test.describe("phone drawer", () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test("closed: no off-screen control can take focus (Tab through the page)", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    const stops: Array<{ tag: string; x: number; w: number }> = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const b = el.getBoundingClientRect();
        return { tag: `${el.tagName} ${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}`, x: b.x, w: b.width };
      });
      if (r) stops.push(r);
    }
    expect(stops.length).toBeGreaterThan(5);
    for (const s of stops) expect(s.x + s.w, `${s.tag} is off-screen to the left but takes focus`).toBeGreaterThan(0);
    // and the drawer itself is not in the accessibility tree while closed
    await expect(page.locator("#primary-navigation")).toBeHidden();
  });

  test("open: a dialog; Escape closes it and returns focus to the button; the page behind is inert while open", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("#main")).toHaveAttribute("inert", "");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Navigation" })).toHaveCount(0);
    await expect(page.locator("#primary-navigation")).toBeHidden();
    await expect(page.locator("#main")).not.toHaveAttribute("inert", "");
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  });

  test("open at a phone width, then the window grows to desktop: the drawer closes, the page is not left inert, the sidebar has no dialog role (R2, #211)", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.locator("#main")).toHaveAttribute("inert", "");
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator("#main")).not.toHaveAttribute("inert", "");
    await expect(page.locator("#primary-navigation")).not.toHaveAttribute("role", "dialog");
    await expect(page.locator("#primary-navigation")).toBeVisible();
    await page.getByRole("heading", { level: 1 }).first().click(); // the page behind answers clicks again
  });

  test("opening moves focus into the dialog", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.locator("#primary-navigation")).toBeFocused();
  });
});

test("desktop: the sidebar is a normal column: visible, its links focusable, no dialog role", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.goto("/screening");
  await expect(page.locator("#primary-navigation")).toBeVisible();
  await expect(page.locator("#primary-navigation")).not.toHaveAttribute("role", "dialog");
  await page.getByRole("link", { name: "Matter", exact: true }).first().focus();
  await expect(page.getByRole("link", { name: "Matter", exact: true }).first()).toBeFocused();
});
