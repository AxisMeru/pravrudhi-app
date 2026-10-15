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
    await expect(link).toHaveText("NyayaSiddhi v0.2: open Indian element-by-element development benchmark (data + scorer)");
    await expect(link).toHaveAttribute("href", "https://huggingface.co/datasets/AxisMeru/nyayasiddhi");
    await expect(page.getByTestId("nyayasiddhi-blurb")).toHaveText("development benchmark; descriptive; no ranking");
    await expect(page.getByTestId("nyayasiddhi")).not.toContainText(/\d+(\.\d+)?%/);
  }
});

// Interim lead's exception (15 Oct): the NyayaSiddhi results from the signed rows (src/data/nyayasiddhi/rows.json), R1's words, each figure with its n and exact 95% interval; no ranking, no "proof".
test("the NyayaSiddhi results: R1's heading and intro, the signed cards with their labels, and each figure with n and its exact interval", async ({ page }) => {
  await page.goto("/benchmarks");
  const box = page.getByTestId("nyayasiddhi-results");
  await expect(box.getByRole("heading", { name: "NyayaSiddhi results", level: 2 })).toBeVisible();
  await expect(box).toContainText("Only signed runs appear here, and every figure is a development figure on material we have already seen, not a measure of how the product does on your matter.");
  await expect(box.getByTestId("ns-supply-line")).toHaveText("For now the board holds only our own rows. A larger hidden set depends on the supply of suitable court items, and we promise no date.");
  // "Counted per": whole item shows six cards (file order: the product rows, then the API reference arm, then the open-model reference arm)
  const rows = box.getByTestId("ns-row");
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText("Reported by the entrant");
  await expect(rows.first()).toContainText("Second development set, cruelty items left out; exposed to Anthropic in an earlier study");
  await expect(rows.nth(1)).toContainText("Development items; used to design fixes, so seen by us");
  // the per-row stack label and the per-row organiser line: the product rows, the API rows and the open-model rows each read their own
  for (const i of [0, 1, 4, 5]) await expect(rows.nth(i).getByTestId("ns-stack")).toHaveText("dev stack (local)");
  for (const i of [2, 3]) await expect(rows.nth(i).getByTestId("ns-stack")).toHaveText("Anthropic API; not our dev stack or production stack");
  for (const i of [0, 1]) await expect(rows.nth(i).getByTestId("ns-organiser")).toHaveText("Entered by the NyayaSiddhi organisers, who also built this system");
  for (const i of [2, 3, 4, 5]) await expect(rows.nth(i).getByTestId("ns-organiser")).toHaveText("Run by the NyayaSiddhi organisers with prompts they wrote; not an outside entry");
  const text = await box.innerText();
  expect(text).toContain("0 of 64 (exact 95% interval 0.0% to 5.6%)");
  expect(text).toContain("0 of 128 (exact 95% interval 0.0% to 2.8%)");
  expect(text).toContain("0 of 107 (exact 95% interval 0.0% to 3.4%)");
  expect(text).toContain("9 of 107 (exact 95% interval 3.9% to 15.4%)");
  expect(text).toContain("1 of 64 (exact 95% interval 0.0% to 8.4%)");
  expect(text).toContain("23 of 107 (exact 95% interval 14.1% to 30.5%)");
  expect(text).toContain("3 of 64 (exact 95% interval 1.0% to 13.1%)");
  expect(text).toContain("The system marked no item as supported here, so a count of 0 wrongly supported is not read on its own.");
  expect(text).not.toMatch(/proof|verified|\bbest\b|better|\bbeat\b|rank/i);
  await expect(box.getByTestId("ns-chart")).toHaveCount(12);
  // the errors line: only rows that had errors and whose figure changes the other way (R1's sentence, numbers from the error-sensitivity files)
  await expect(rows.first().getByTestId("ns-error-line")).toHaveCount(0);
  await expect(rows.nth(1).getByTestId("ns-error-line")).toHaveText("1 gave an error. Errors are counted as not supported here; counted as supported, wrongly supported would be 1 of 64.");
  await expect(rows.nth(4).getByTestId("ns-error-line")).toHaveText("2 gave an error. Errors are counted as not supported here; counted as supported, wrongly supported would be 4 of 64 and coverage would be 24 of 107.");
  await expect(rows.nth(5).getByTestId("ns-error-line")).toHaveCount(0);
  // "Each ingredient": the API harness arm's two rows
  await box.getByTestId("ns-units").getByText("Each ingredient", { exact: true }).click();
  await expect(rows).toHaveCount(2);
  for (const i of [0, 1]) await expect(rows.nth(i)).toContainText("Anthropic API; not our dev stack or production stack");
  expect(await box.innerText()).toContain("8 of 64 (exact 95% interval 5.6% to 23.2%)");
});

test("the NyayaSiddhi results: the group chooser shows a family's figures; the unit chooser offers the units the rows carry", async ({ page }) => {
  await page.goto("/benchmarks");
  const box = page.getByTestId("nyayasiddhi-results");
  await expect(box.getByTestId("ns-units").locator("label")).toHaveText(["Whole item", "Each ingredient"]);
  await expect(box.getByTestId("ns-groups").locator("label")).toHaveText(["All groups", "Cheating", "Criminal breach of trust", "Dishonoured cheque"]);
  await box.getByTestId("ns-groups").getByText("Cheating", { exact: true }).click();
  const text = await box.innerText();
  expect(text).toContain("0 of 27 (exact 95% interval 0.0% to 12.8%)");
  expect(text).toContain("0 of 47 (exact 95% interval 0.0% to 7.5%)");
  // for the Cheating group the two error mappings also disagree on the product obj1_dev row (1 of 27), so its errors line names that figure
  await expect(box.getByTestId("ns-row").nth(1).getByTestId("ns-error-line")).toHaveText("1 gave an error. Errors are counted as not supported here; counted as supported, wrongly supported would be 1 of 27.");
  // Dishonoured cheque: for wrongly supported the mappings agree, but the open-model row's coverage would change (23 of 93), so that row alone carries a one-part line and the product rows none
  await box.getByTestId("ns-groups").getByText("Dishonoured cheque", { exact: true }).click();
  await expect(box.getByTestId("ns-error-line")).toHaveCount(1);
  await expect(box.getByTestId("ns-row").nth(4).getByTestId("ns-error-line")).toHaveText("2 gave an error. Errors are counted as not supported here; counted as supported, coverage would be 23 of 93.");
});

test("the NyayaSiddhi results work at phone width: no horizontal scroll and the choosers are phone-size targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/benchmarks");
  await expect(page.getByTestId("nyayasiddhi-results")).toBeVisible();
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
  for (const l of await page.getByTestId("ns-groups").locator("label").all()) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

// WCAG 2.4.7: the unit and group choosers are radios hidden from view (sr-only inputs in labels): keyboard focus must show on the label.
test("the NyayaSiddhi choosers show keyboard focus: tabbing to a radio draws an outline on its label", async ({ page }) => {
  await page.goto("/benchmarks");
  const box = page.getByTestId("nyayasiddhi-results");
  await expect(box).toBeVisible();
  await box.getByTestId("ns-units").locator("input").first().focus();
  let o = await box.getByTestId("ns-units").locator("label").first().evaluate((l) => ({ style: getComputedStyle(l).outlineStyle, width: getComputedStyle(l).outlineWidth }));
  expect(o).toEqual({ style: "solid", width: "2px" });
  // by keyboard: tab from the unit radio to the group radio group, and the focused label is outlined
  await page.keyboard.press("Tab");
  const focusedLabel = page.locator("label:focus-within");
  await expect(focusedLabel).toHaveCount(1);
  o = await focusedLabel.evaluate((l) => ({ style: getComputedStyle(l).outlineStyle, width: getComputedStyle(l).outlineWidth }));
  expect(o).toEqual({ style: "solid", width: "2px" });
  expect(await focusedLabel.evaluate((l) => !!l.closest('[data-testid="ns-groups"]'))).toBe(true);
  // an unfocused label has no outline
  await expect(box.getByTestId("ns-units").locator("label").first()).toHaveCSS("outline-style", "none");
});
