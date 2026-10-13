import { expect, test } from "./support/engineTest";

// The benchmarks page is short and static (R1's strings, 14 Oct): what we check, how we test, what the checks do and do not show. No figure.
test("the page shows R1's statements, NyayaSiddhi and How we test, and no figure", async ({ page }) => {
  await page.goto("/benchmarks");
  await expect(page.getByRole("heading", { name: "Benchmarks", level: 1 })).toBeVisible();
  await expect(page.getByText("What we check, and what the checks do and do not show.")).toBeVisible();
  const items = page.getByTestId("benchmark-statements").locator("li");
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText("Court material: fixed sets of real Indian court items");
  await expect(items.nth(1)).toContainText("Citation checker (labelled preview)");
  await expect(items.nth(2)).toContainText("Public test: a United States rule-application benchmark");
  await expect(items.nth(3)).toContainText("Legal-knowledge test: how our models do");
  await expect(page.getByTestId("block-how")).toContainText("Each result is checked by a second, independent model reviewer.");
  await expect(page.getByText("Research results, not legal advice.")).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/%|interval|upper bound|Result pending|Registered bar|Inconclusive/i);
  expect(text.replace(/NyayaSiddhi v0/, "")).not.toMatch(/\d/);
});

test("the page works at phone width: no horizontal scroll of the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/benchmarks");
  await expect(page.getByTestId("benchmark-statements")).toBeVisible();
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
});

test("the benchmarks page and the demo page link NyayaSiddhi with its blurb, and show no figure for it", async ({ page }) => {
  for (const path of ["/benchmarks", "/demo"]) {
    await page.goto(path);
    const link = page.getByTestId("nyayasiddhi-link");
    await expect(link).toHaveText("NyayaSiddhi v0: open Indian element-proof development benchmark (data + scorer)");
    await expect(link).toHaveAttribute("href", "https://huggingface.co/datasets/AxisMeru/nyayasiddhi");
    await expect(page.getByTestId("nyayasiddhi-blurb")).toHaveText("development benchmark; descriptive; no ranking");
    await expect(page.getByTestId("nyayasiddhi")).not.toContainText(/\d+(\.\d+)?%/);
  }
});
