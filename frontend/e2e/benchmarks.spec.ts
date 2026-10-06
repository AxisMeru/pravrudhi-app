import { expect, test } from "@playwright/test";

/**
 * The benchmarks page (#638). The shipped data file has every block pending, so the default page shows "Result pending" and no
 * figure. A reviewed block is exercised with an INVENTED fixture served by page.route (test data, not results); a block that
 * fails the contract (a number without its interval) must stay pending even when the file says reviewed.
 */
const reviewed = (over: Record<string, unknown> = {}) => ({
  id: "bbl",
  status: "reviewed",
  reviewer_clear: { reviewer: "R1", head_sha: "abc1234", date: "2026-10-07" },
  kind_chip: "Model legal knowledge (MCQ), not the harness",
  data_chip: "Public benchmark",
  what_it_is: "A test item set.",
  what_it_is_not: "Not a claim about real matters.",
  limits: "Test data only.",
  run: { model_ids: ["model-x"], revisions: ["rev-1"], dataset_revision: "data-1", scorer_sha256: "a".repeat(64), date: "2026-10-06" },
  tables: [
    {
      title: "Accuracy by language",
      columns: ["arm", "group"],
      chance: 0.25,
      rows: [
        { arm: "first", group: "English", n: 100, correct: 60, accuracy: 0.6, ci95: [0.5, 0.69], invalid: 1 },
        { arm: "second", group: "English", n: 100, correct: 55, accuracy: 0.55, ci95: [0.45, 0.65], invalid: 0 },
      ],
    },
  ],
  paired: [{ pair: "first vs second", only_first_correct: 12, only_second_correct: 7, p: 0.36, label: "no separation" }],
  leaderboard: null,
  ...over,
});
const serve = async (page: import("@playwright/test").Page, blocks: unknown[]) => {
  await page.route("**/benchmark_results.json", (r) => r.fulfill({ json: { generated_at: "2026-10-06", page_version: "t", blocks } }));
};

test("by default every block is pending and the page shows no figure", async ({ page }) => {
  await page.goto("/benchmarks");
  await expect(page.getByRole("heading", { name: "Our models on an Indian legal-knowledge test" })).toBeVisible();
  for (const id of ["bbl", "citation", "legalbench", "sealed_court"]) {
    await expect(page.getByTestId(`status-${id}`)).toHaveText("Result pending");
    await expect(page.getByTestId(`pending-${id}`)).toContainText("No figure is shown until a second reviewer has checked it.");
  }
  await expect(page.getByTestId("result-table")).toHaveCount(0);
  await expect(page.getByTestId("block-bbl").getByText(/%/)).toHaveCount(0);
  await expect(page.getByText("Research results, not legal advice.")).toBeVisible();
  await expect(page.getByTestId("fixed-label-bbl")).toHaveText(/Not the proof harness\. Our models were not trained for this test\./);
});

test("a reviewed block shows its chips, label before number, interval chart with a text alternative, the table, and the pairing", async ({ page }) => {
  await serve(page, [reviewed()]);
  await page.goto("/benchmarks");
  const block = page.getByTestId("block-bbl");
  await expect(page.getByTestId("status-bbl")).toHaveText("Reviewed");
  await expect(page.getByTestId("chip-kind-bbl")).toHaveText("Model legal knowledge (MCQ), not the harness");
  await expect(page.getByTestId("chip-data-bbl")).toHaveText("Public benchmark");
  await expect(page.getByTestId("what-it-is-not-bbl")).toContainText("Not a claim about real matters.");
  // the label comes before the figures
  const labelY = (await page.getByTestId("fixed-label-bbl").boundingBox())!.y;
  const chartY = (await block.getByTestId("interval-chart").boundingBox())!.y;
  expect(labelY).toBeLessThan(chartY);
  const chart = block.getByTestId("interval-chart");
  await expect(chart).toHaveAttribute("aria-label", /first, English: 60\.0%, 95% interval 50\.0% to 69\.0%, n 100/);
  await expect(block.getByTestId("chance-line")).toHaveCount(1);
  const rows = block.getByTestId("result-table-values").locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("60.0% (50.0% to 69.0%)");
  await expect(rows.first()).toContainText("100");
  await expect(block.getByTestId("paired-label")).toHaveText("no separation");
  await expect(block.getByTestId("paired")).toContainText("12");
  await expect(page.getByTestId("benchmarks-footer")).toContainText("scorer sha256 " + "a".repeat(64));
});

test("a block that says reviewed but carries a number without its interval stays pending with no figure", async ({ page }) => {
  const bad = reviewed({ tables: [{ title: "T", columns: [], rows: [{ arm: "first", group: "English", n: 100, correct: 60, accuracy: 0.6, invalid: 0 }] }] });
  await serve(page, [bad]);
  await page.goto("/benchmarks");
  await expect(page.getByTestId("status-bbl")).toHaveText("Result pending");
  await expect(page.getByTestId("result-table")).toHaveCount(0);
  await expect(page.getByText(/60\.0%/)).toHaveCount(0);
});

test("a block with banned wording stays pending", async ({ page }) => {
  await serve(page, [reviewed({ what_it_is: "A test where our model beats the rest." })]);
  await page.goto("/benchmarks");
  await expect(page.getByTestId("status-bbl")).toHaveText("Result pending");
  await expect(page.getByText("beats")).toHaveCount(0);
});

test("an inconclusive citation block says so in its title and shows no figure", async ({ page }) => {
  await serve(page, [{ id: "citation", status: "inconclusive" }]);
  await page.goto("/benchmarks");
  await expect(page.getByRole("heading", { name: "Does our citation checker catch wrong citations? (Inconclusive)" })).toBeVisible();
  await expect(page.getByTestId("result-table")).toHaveCount(0);
});

test("the citation block draws its proportion bar capped at the bound", async ({ page }) => {
  const c = reviewed({
    id: "citation",
    kind_chip: "Harness, our own pre-registered study",
    data_chip: "Model-generated questions",
    tables: [{ title: "Wrong citations shown as verified", columns: [], rows: [{ arm: "model-x", group: "P1", n: 80, correct: 2, accuracy: 0.025, ci95: [0.0, 0.088], invalid: 0 }] }],
    paired: [],
  });
  await serve(page, [c]);
  await page.goto("/benchmarks");
  await expect(page.getByTestId("proportion-bar").getByRole("img")).toHaveAttribute("aria-label", /upper end of the 95% interval 8\.8%/);
});

test("the page works at phone width: no horizontal scroll of the page", async ({ page }) => {
  await serve(page, [reviewed()]);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/benchmarks");
  await expect(page.getByTestId("block-bbl").getByTestId("interval-chart")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
