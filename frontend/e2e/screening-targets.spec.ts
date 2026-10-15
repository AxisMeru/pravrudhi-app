import { expect, test } from "./support/engineTest";

// P5 slice 1 (#144): the controls of the facts section meet the target sizes the canvas asks for: at least 24 px each way on a desktop (WCAG 2.2 target size minimum), at least 44 px on a phone.
const CONTROLS: ReadonlyArray<[string, (p: import("@playwright/test").Page) => import("@playwright/test").Locator]> = [
  ["Remove fact F1", (p) => p.getByRole("button", { name: "Remove fact F1" })],
  ["Add a fact", (p) => p.getByRole("button", { name: "Add a fact" })],
  ["Split into numbered facts", (p) => p.getByTestId("split-facts")],
  ["Screen these facts", (p) => p.getByRole("button", { name: "Screen these facts" })],
];

for (const [label, width, min] of [["desktop", 1280, 24], ["phone", 390, 44]] as const) {
  test(`/screening at ${width} px (${label}): the facts-section buttons are at least ${min} px high and wide enough`, async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/screening");
    for (const [name, get] of CONTROLS) {
      const el = get(page);
      await el.scrollIntoViewIfNeeded();
      const box = await el.boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.height, `${name} height at ${width}px`).toBeGreaterThanOrEqual(min - 0.5);
      expect(box!.width, `${name} width at ${width}px`).toBeGreaterThanOrEqual(min - 0.5);
    }
  });
}
