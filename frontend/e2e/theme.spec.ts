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

test("an explicit choice wins over the system, is stored, and is applied before hydration on the next load", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/guide");
  await page.getByTestId("theme-light").click();
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("light");
  expect(await page.evaluate(() => window.localStorage.getItem("pravrudhi-theme"))).toBe("light");
  expect(await bg(page)).toBe("rgb(246, 244, 239)");
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => { (window as unknown as { __themeAtDcl?: string | null }).__themeAtDcl = document.documentElement.getAttribute("data-theme"); });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __themeAtDcl?: string | null }).__themeAtDcl)).toBe("light");
  await expect(page.getByTestId("theme-light")).toHaveAttribute("aria-pressed", "true");
});

test("System clears the stored choice and the attribute; Dark sets it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/guide");
  await page.getByTestId("theme-dark").click();
  expect(await bg(page)).toBe("rgb(14, 22, 34)");
  expect(await page.evaluate(() => window.localStorage.getItem("pravrudhi-theme"))).toBe("dark");
  await page.getByTestId("theme-system").click();
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBeNull();
  expect(await page.evaluate(() => window.localStorage.getItem("pravrudhi-theme"))).toBeNull();
  expect(await bg(page)).toBe("rgb(246, 244, 239)");
});

test("the filled accent button is readable in both themes (text colour is on-accent, not white on mint)", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  for (const choice of ["theme-light", "theme-dark"]) {
    await page.goto("/screening");
    await page.getByTestId(choice).click();
    const colours = await page.getByRole("button", { name: "Screen these facts" }).evaluate((el) => {
      const s = getComputedStyle(el);
      return { fg: s.color, bgc: s.backgroundColor };
    });
    expect(colours.fg).not.toBe(colours.bgc);
    expect(colours.fg).not.toBe("rgb(255, 255, 255)" === colours.fg && colours.bgc === "rgb(110, 231, 183)" ? colours.fg : "never");
  }
});
