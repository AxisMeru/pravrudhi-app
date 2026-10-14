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

// P1 and P13 (R1's words, 14 Oct): the intro is a fold named "About this screening" with the standing line outside it; the example entry names each choice by its citation.
test("the intro folds behind 'About this screening' with the standing line outside, and the example entry lists the public orders by citation", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property", "ipc405_misappropriation"], entries: [] } }));
  await page.goto("/screening");
  await expect(page.getByTestId("standing-line")).toHaveText("This is a screening aid, not legal advice. A lawyer decides.");
  const fold = page.getByTestId("about-screening");
  await expect(fold.locator("summary")).toHaveText("About this screening");
  await expect(page.getByTestId("product-line")).toBeHidden();
  await fold.locator("summary").click();
  await expect(page.getByTestId("product-line")).toBeVisible();
  await expect(page.getByTestId("caveat-strip")).toBeVisible();
  const entry = page.getByTestId("example-entry");
  await expect(entry).toContainText("Try an example from a public court order");
  await expect(entry.getByRole("link")).toHaveText(["Madras High Court, order of 12 June 2024", "High Court of Karnataka at Bengaluru, order of 25 March 2025, 2025:KHC:12773"]);
  await entry.getByRole("link", { name: /Karnataka/ }).click();
  await expect(page.getByTestId("example-citation")).toHaveText("High Court of Karnataka at Bengaluru, order of 25 March 2025, 2025:KHC:12773");
  await expect(page.getByTestId("example-entry")).toHaveCount(0);
});
