import { expect, test } from "./support/engineTest";

// The benchmarks page is short (R1's strings, 13 Oct): what we check, how we test, what the checks do and do not show. No figure outside the NyayaSiddhi results view: Interim lead's explicit exception (15 Oct) allows figures there only (the signed NyayaSiddhi rows, each with its n and exact 95% interval).
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
  // everything outside the NyayaSiddhi results view
  const text = await page.locator("main").evaluate((el) => { const c = el.cloneNode(true) as HTMLElement; c.querySelectorAll('[data-testid="nyayasiddhi-results"]').forEach((n) => n.remove()); return c.innerText; });
  expect(text).not.toMatch(/%|interval|upper bound|Result pending|Registered bar|Inconclusive/i);
  expect(text.replace(/NyayaSiddhi v0\.2/, "")).not.toMatch(/\d/);
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
    await expect(link).toHaveText("NyayaSiddhi v0.2: open Indian element-proof development benchmark (data + scorer)");
    await expect(link).toHaveAttribute("href", "https://huggingface.co/datasets/AxisMeru/nyayasiddhi");
    await expect(page.getByTestId("nyayasiddhi-blurb")).toHaveText("development benchmark; descriptive; no ranking");
    await expect(page.getByTestId("nyayasiddhi")).not.toContainText(/\d+(\.\d+)?%/);
  }
});

// Interim lead's exception (15 Oct): the NyayaSiddhi results from the signed rows (src/data/nyayasiddhi/rows.json), R1's words, each figure with its n and exact 95% interval; no ranking, no "proof".
test("the NyayaSiddhi results: R1's heading and intro, two signed cards with their labels, and each figure with n and its exact interval", async ({ page }) => {
  await page.goto("/benchmarks");
  const box = page.getByTestId("nyayasiddhi-results");
  await expect(box.getByRole("heading", { name: "NyayaSiddhi results", level: 2 })).toBeVisible();
  await expect(box).toContainText("Only signed runs appear here, and every figure is a development figure on material we have already seen, not a measure of how the product does on your matter.");
  const rows = box.getByTestId("ns-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Reported by the entrant");
  await expect(rows.first()).toContainText("dev stack (local)");
  await expect(rows.first()).toContainText("Entered by the NyayaSiddhi organisers, who also built this system");
  await expect(rows.first()).toContainText("Wrongly supported");
  const text = await box.innerText();
  expect(text).toContain("0 of 64 (exact 95% interval 0.0% to 5.6%)");
  expect(text).toContain("0 of 128 (exact 95% interval 0.0% to 2.8%)");
  expect(text).toContain("0 of 107 (exact 95% interval 0.0% to 3.4%)");
  expect(text).toContain("The system marked no item as supported here, so a count of 0 wrongly supported is not read on its own.");
  expect(text).not.toMatch(/proof|verified|\bbest\b|better|\bbeat\b|rank/i);
  await expect(box.getByTestId("ns-chart")).toHaveCount(4);
});

test("the NyayaSiddhi results: the group chooser shows a family's figures; the unit chooser offers only the units the rows carry", async ({ page }) => {
  await page.goto("/benchmarks");
  const box = page.getByTestId("nyayasiddhi-results");
  await expect(box.getByTestId("ns-units").locator("label")).toHaveText(["Whole item"]);
  await expect(box.getByTestId("ns-groups").locator("label")).toHaveText(["All groups", "Cheating", "Criminal breach of trust", "Dishonoured cheque"]);
  await box.getByTestId("ns-groups").getByText("Cheating", { exact: true }).click();
  const text = await box.innerText();
  expect(text).toContain("0 of 27 (exact 95% interval 0.0% to 12.8%)");
  expect(text).toContain("0 of 47 (exact 95% interval 0.0% to 7.5%)");
});

test("the NyayaSiddhi results work at phone width: no horizontal scroll and the choosers are phone-size targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/benchmarks");
  await expect(page.getByTestId("nyayasiddhi-results")).toBeVisible();
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
  for (const l of await page.getByTestId("ns-groups").locator("label").all()) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
