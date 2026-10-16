import { expect, test } from "./support/engineTest";

// Pravrudhi-Nyaya theme: light / dark / system by CSS variables, a stored choice applied by the head script before the page is interactive.
const bg = (page: import("@playwright/test").Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("system: with no stored choice the page follows the operating system, in both directions", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/guide");
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBeNull();
  expect(await bg(page)).toBe("rgb(246, 244, 239)");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await bg(page)).toBe("rgb(14, 22, 34)");
});

const BTN = (page: import("@playwright/test").Page) => page.getByTestId("theme-button");
const stored = (page: import("@playwright/test").Page) => page.evaluate(() => window.localStorage.getItem("pravrudhi-theme"));
const attr = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.getAttribute("data-theme"));

test("one theme button, top right, system by default; each press cycles system -> light -> dark -> system and the name says what is next", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/guide");
  await expect(page.getByTestId("theme-button")).toHaveCount(1);
  await expect(page.locator('[data-testid^="theme-"]:not([data-testid="theme-button"])')).toHaveCount(0);
  await expect(BTN(page)).toHaveAttribute("aria-label", "Colour theme: follows your device setting. Press to use light.");
  await expect(BTN(page)).toHaveAttribute("title", "Colour theme: device setting");
  const box = (await BTN(page).boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x + box.width).toBeGreaterThan(vp.width - 80);
  expect(box.y).toBeLessThan(60);
  await BTN(page).click();
  expect(await attr(page)).toBe("light");
  expect(await stored(page)).toBe("light");
  expect(await bg(page)).toBe("rgb(246, 244, 239)");
  await expect(BTN(page)).toHaveAttribute("aria-label", "Colour theme: light. Press to use dark.");
  await BTN(page).click();
  expect(await attr(page)).toBe("dark");
  expect(await stored(page)).toBe("dark");
  expect(await bg(page)).toBe("rgb(14, 22, 34)");
  await expect(BTN(page)).toHaveAttribute("aria-label", "Colour theme: dark. Press to follow your device setting.");
  await BTN(page).click();
  expect(await attr(page)).toBeNull();
  expect(await stored(page)).toBeNull();
  await expect(BTN(page)).toHaveAttribute("title", "Colour theme: device setting");
});

test("the choice persists per browser and is applied before hydration on the next load", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/guide");
  await BTN(page).click();
  expect(await attr(page)).toBe("light");
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => { (window as unknown as { __themeAtDcl?: string | null }).__themeAtDcl = document.documentElement.getAttribute("data-theme"); });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __themeAtDcl?: string | null }).__themeAtDcl)).toBe("light");
  await expect(BTN(page)).toHaveAttribute("data-theme-choice", "light");
});

test("the button is a 44 px target at phone width, reachable by keyboard, and has no visible text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/guide");
  const b = (await BTN(page).boundingBox())!;
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect((await BTN(page).innerText()).trim()).toBe("");
  await BTN(page).focus();
  await page.keyboard.press("Enter");
  expect(await attr(page)).toBe("light");
  await page.keyboard.press("Space");
  expect(await attr(page)).toBe("dark");
});

test("the filled accent button is readable in both themes (text colour is on-accent, not white on mint)", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.emulateMedia({ colorScheme: "light" });
  for (const choice of ["light", "dark"]) {
    await page.goto("/screening");
    await page.evaluate((c) => { window.localStorage.setItem("pravrudhi-theme", c); }, choice);
    await page.reload();
    const colours = await page.getByRole("button", { name: "Screen these facts" }).evaluate((el) => {
      const s = getComputedStyle(el);
      return { fg: s.color, bgc: s.backgroundColor };
    });
    expect(colours.fg).not.toBe(colours.bgc);
    // the canvas pair (CONTRAST_CHECK): light = white on #1f4e79, dark = #0e1622 on #7fb1e8
    expect(colours).toEqual(choice === "light" ? { fg: "rgb(255, 255, 255)", bgc: "rgb(31, 78, 121)" } : { fg: "rgb(14, 22, 34)", bgc: "rgb(127, 177, 232)" });
  }
});
