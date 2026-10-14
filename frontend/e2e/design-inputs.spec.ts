import { expect, test } from "@playwright/test";

// P5 and #138: fact boxes grow with their text instead of clipping it, and the small controls meet the 24 px target size.
test("a long fact is shown whole (the box grows) and Remove is at least 24 px", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/screening");
  const box = page.getByRole("textbox", { name: "Fact F1", exact: true });
  const before = (await box.boundingBox())!.height;
  await box.fill("A long fact sentence that runs over several lines when the box is narrow. ".repeat(12));
  await expect.poll(async () => (await box.boundingBox())!.height).toBeGreaterThan(before + 40);
  expect(await box.evaluate((el) => el.scrollHeight <= el.clientHeight + 1 || getComputedStyle(el).overflowY === "auto")).toBe(true);
  const rm = (await page.getByRole("button", { name: "Remove fact F1" }).boundingBox())!;
  expect(rm.height).toBeGreaterThanOrEqual(24);
  expect(rm.width).toBeGreaterThanOrEqual(24);
});
