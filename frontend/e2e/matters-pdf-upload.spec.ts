import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Matters page's PDF/DOCX upload (pravrudhi-app#5): extraction is entirely client-side (pdfjs-dist /
 * mammoth, no engine call at all -- see lib/extractFacts.ts), so this only needs a running product engine
 * to serve the page, never a Lean judge or any network round trip. Both fixtures under e2e/fixtures/ are
 * CONSTRUCTED test documents (a hand-written FIR-style toy narrative, never a real case) -- see
 * fixtures/fir_text.txt in this branch's own scratch history for the source text and how the PDF/DOCX were
 * built.
 */

const FIR_PDF = path.join(__dirname, "fixtures", "test_fir.pdf");
const FIR_DOCX = path.join(__dirname, "fixtures", "test_fir.docx");

test("uploading a PDF fills the facts textarea with real extracted text, editable before submit", async ({ page }) => {
  await page.goto("/matters");
  await page.locator("main").getByRole("heading", { name: "Matters", exact: true }).waitFor();

  await page.getByLabel("Upload a PDF or DOCX").setInputFiles(FIR_PDF);

  const facts = page.getByLabel("Facts (one per line)");
  await expect(facts, "extraction must actually populate the textarea, not just clear it").not.toHaveValue("", { timeout: 15_000 });
  const value = await facts.inputValue();
  expect(value).toContain("wooden stick");
  expect(value).toContain("promised to marry");
  // Never auto-submitted: nothing is sent to the engine just because a file was uploaded.
  await expect(page.getByText(/^Analysing…$/)).toHaveCount(0);
});

test("uploading a DOCX fills the facts textarea the same way", async ({ page }) => {
  await page.goto("/matters");
  await page.locator("main").getByRole("heading", { name: "Matters", exact: true }).waitFor();

  await page.getByLabel("Upload a PDF or DOCX").setInputFiles(FIR_DOCX);

  const facts = page.getByLabel("Facts (one per line)");
  await expect(facts).not.toHaveValue("", { timeout: 15_000 });
  const value = await facts.inputValue();
  expect(value).toContain("wooden stick");
});

test("the retention notice is visible before anything is typed or uploaded", async ({ page }) => {
  await page.goto("/matters");
  await page.locator("main").getByRole("heading", { name: "Matters", exact: true }).waitFor();
  await expect(page.getByText(/kept up to 7 days for audit/)).toBeVisible();
});
