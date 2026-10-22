import { expect, test } from "./support/engineTest";

// #325: at 390 px the page heading starts at the content edge, not 64 px in. The menu button (fixed, 12-56 px) sits in the band the layout reserves above every page, so it clears the title vertically on every page that renders PageHeader.
const PAGES = ["/screening", "/matters", "/workflows", "/guide", "/data-handling", "/settings", "/safety", "/benchmarks", "/how-it-was-built", "/citations", "/technical-film", "/workflows", "/"];
test.use({ viewport: { width: 390, height: 844 } });

test("390 px: on every page the menu button clears the heading vertically and the heading starts at 16 px", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  const bad: string[] = [];
  for (const path of new Set(PAGES)) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const menu = await page.getByRole("button", { name: "Open navigation" }).boundingBox();
    const h1 = await page.getByRole("heading", { level: 1 }).first().boundingBox();
    if (!menu || !h1) { bad.push(`${path}: no menu or heading box`); continue; }
    if (menu.y + menu.height > h1.y) bad.push(`${path}: the menu button (bottom ${menu.y + menu.height}) overlaps the heading (top ${h1.y})`);
    if (h1.x > 17) bad.push(`${path}: the heading starts at ${h1.x}`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("390 px: on Screening the heading and the first card share a left edge", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.goto("/screening");
  const h1 = (await page.getByRole("heading", { level: 1 }).first().boundingBox())!;
  const steps = (await page.getByTestId("workspace-steps").boundingBox())!;
  expect(Math.round(h1.x)).toBe(Math.round(steps.x));
});
