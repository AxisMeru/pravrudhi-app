import { expect, test } from "@playwright/test";

// The page renders the signed #914 text: the story, six numbered cards, and none of the internal layer.
test("How it was built shows the story and six stage cards, with no figures", async ({ page }) => {
  await page.goto("/how-it-was-built");
  await expect(page.getByRole("heading", { name: "How it was built" }).first()).toBeVisible();
  await expect(page.getByTestId("how-built-story")).toContainText("We trained the Prabhāsa-Nyāya models behind Pravrudhi-Nyaya on real court text");
  for (let i = 1; i <= 6; i++) await expect(page.getByTestId(`how-built-card-${i}`)).toBeVisible();
  await expect(page.getByTestId("how-built-card-3")).toContainText("model-extracted, with no human review");
  await expect(page.getByTestId("how-built")).not.toContainText(/sha256|BULK_RECORD|source map/i);
});

// app#431: the data section after step 1 (R1's words, pinned in src/lib/howItWasBuiltData.spec.ts); the six signed cards keep their numbers.
test("the data section follows card 1 and reads as its extension; the hidden-set line is the one constant; the six cards are unchanged", async ({ page }) => {
  await page.goto("/how-it-was-built");
  const section = page.getByTestId("how-built-data");
  await expect(section).toBeVisible();
  await expect(section.getByRole("heading", { level: 2 })).toHaveText("More on step 1: the data sets");
  await expect(section.getByTestId("how-built-data-intro")).toContainText("Step 1 says we gathered public judgments.");
  const order = await page.getByTestId("how-built").locator("section[data-testid]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(order.slice(0, 3)).toEqual(["how-built-card-1", "how-built-data", "how-built-card-2"]);
  for (let i = 1; i <= 6; i++) await expect(page.getByTestId(`how-built-card-${i}`)).toBeVisible();
  await expect(section.getByTestId("how-built-data-np")).toContainText("There is no hidden set yet. The mechanism for one is being built.");
  await expect(section.getByTestId("how-built-data-r6").getByRole("link")).toHaveAttribute("href", "https://huggingface.co/datasets/AxisMeru/nyayasiddhi");
  await expect(section).not.toContainText(/sha256/i);
});
