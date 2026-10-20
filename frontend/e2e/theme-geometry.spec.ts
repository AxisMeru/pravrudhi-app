import { expect, test } from "@playwright/test";

// The theme icon sits in the sidebar brand row's own flow (md and up), so it can never cover the notification bell or the brand text, at any width or text size and for the long Studio edition name.
// (Not a single line: at the 15rem sidebar the 44 px icon + the bell + "Pravrudhi Studio" cannot share one line, so the name wraps; the check is that nothing overlaps and nothing leaves the sidebar.)
test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

type Box = [number, number, number, number];
const overlap = (a: Box, b: Box): boolean => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

for (const width of [800, 1280]) {
  for (const root of [16, 20, 24]) {
    for (const name of ["product", "Pravrudhi Studio"]) {
      test(`${width} px wide, root text ${root} px, brand ${name}: the theme icon overlaps neither the bell nor the brand text, and all stay inside the sidebar`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await page.goto("/guide");
        await page.addStyleTag({ content: `html{font-size:${root}px}` });
        const r = await page.evaluate((brandName) => {
          const brand = document.querySelector('[data-testid="drawer-brand"]') as HTMLElement;
          if (brandName !== "product") brand.textContent = brandName;
          const box = (e: Element | null): [number, number, number, number] | null => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
          const range = document.createRange();
          range.selectNodeContents(brand);
          const rs = [...range.getClientRects()];
          const text: [number, number, number, number] = [Math.min(...rs.map((q) => q.left)), Math.min(...rs.map((q) => q.top)), Math.max(...rs.map((q) => q.right)), Math.max(...rs.map((q) => q.bottom))];
          return { theme: box(document.querySelector('[data-testid="theme-button"]')), bell: box(document.querySelector('button[aria-label="Notifications"]')), text, aside: box(document.querySelector("aside")) };
        }, name);
        expect(r.theme, "one theme button, in the page").not.toBeNull();
        const theme = r.theme as Box, text = r.text as Box, aside = r.aside as Box;
        expect(overlap(theme, text), "icon over the brand text").toBe(false);
        if (r.bell) expect(overlap(theme, r.bell as Box), "icon over the bell").toBe(false);
        for (const [what, b] of [["icon", theme], ["brand text", text], ...(r.bell ? [["bell", r.bell as Box] as const] : [])] as const) {
          expect(b[0], `${what} inside the sidebar (left)`).toBeGreaterThanOrEqual(aside[0] - 0.5);
          expect(b[2], `${what} inside the sidebar (right)`).toBeLessThanOrEqual(aside[2] + 0.5);
        }
        await expect(page.getByTestId("theme-button")).toHaveCount(1);
      });
    }
  }
}

test("on a phone the one theme button is in the top strip, not in the (closed) drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/guide");
  await expect(page.getByTestId("theme-button")).toBeVisible();
  await expect(page.getByTestId("theme-button")).toHaveCount(1);
  const b = (await page.getByTestId("theme-button").boundingBox())!;
  expect(b.x + b.width).toBeGreaterThan(390 - 20);
  expect(b.y).toBeLessThan(56);
  expect(b.width).toBeGreaterThanOrEqual(44);
});
