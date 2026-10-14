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
