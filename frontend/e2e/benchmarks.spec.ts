import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * The benchmarks page (#638). The shipped data file has every block pending, so the default page shows "Result pending" and no
 * figure. A reviewed block is exercised with the INVENTED fixture src/lib/fixtures/benchmarkExample.json (which the real validator
 * accepts; see benchmarks.spec.ts) served by page.route: test data, not results. A block that fails the runtime contract stays pending.
 */
const FIXTURE = JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "fixtures", "benchmarkExample.json"), "utf8")) as { blocks: Record<string, any>[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
const serve = async (page: import("@playwright/test").Page, mutate?: (blocks: Record<string, any>[]) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const doc = structuredClone(FIXTURE);
  mutate?.(doc.blocks);
  await page.route("**/benchmark_results.json", (r) => r.fulfill({ json: doc }));
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
  await expect(page.getByTestId("chip-kind-citation")).toHaveText("Own study, design not yet registered");
});

test("a reviewed block shows its chips and outcome, label before number, an interval chart with a text alternative, the table, the pairing and the generated sentences", async ({ page }) => {
  await serve(page);
  await page.goto("/benchmarks");
  const block = page.getByTestId("block-bbl");
  await expect(page.getByTestId("status-bbl")).toHaveText("Reviewed");
  await expect(page.getByTestId("outcome-bbl")).toHaveText("Descriptive");
  await expect(page.getByTestId("chip-kind-bbl")).toHaveText("Model legal knowledge (MCQ), not the harness");
  await expect(page.getByTestId("chip-data-bbl")).toHaveText("Public benchmark");
  await expect(page.getByTestId("what-it-is-not-bbl")).toContainText("Not a result about any real model.");
  const labelY = (await page.getByTestId("fixed-label-bbl").boundingBox())!.y;
  const chartY = (await block.getByTestId("interval-chart").boundingBox())!.y;
  expect(labelY).toBeLessThan(chartY);
  await expect(block.getByTestId("interval-chart")).toHaveAttribute("aria-label", /arm A, English: 60\.0%, 95% interval 49\.7% to 69\.7%, n 100/);
  await expect(block.getByTestId("chance-line")).toHaveCount(1);
  const rows = block.getByTestId("result-table-values").locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("60.0% (49.7% to 69.7%)");
  await expect(block.getByTestId("paired-label")).toHaveText("no separation");
  await expect(block.getByTestId("paired")).toContainText("only arm A right");
  await expect(page.getByTestId("sentences-bbl")).toContainText("No separation: only arm A right 12, only arm B right 7");
  await expect(page.getByTestId("benchmarks-footer")).toContainText("scorer sha256 " + "a".repeat(64));
});

test("a block that says reviewed but carries a number without its interval stays pending with no figure", async ({ page }) => {
  await serve(page, (blocks) => {
    delete blocks[0].tables[0].rows[0].ci95;
  });
  await page.goto("/benchmarks");
  await expect(page.getByTestId("status-bbl")).toHaveText("Result pending");
  await expect(page.getByTestId("block-bbl").getByTestId("result-table")).toHaveCount(0);
  await expect(page.getByText(/60\.0%/)).toHaveCount(0);
});

test("a block with only one reviewer stays pending", async ({ page }) => {
  await serve(page, (blocks) => {
    blocks[0].reviews = blocks[0].reviews.slice(0, 1);
  });
  await page.goto("/benchmarks");
  await expect(page.getByTestId("status-bbl")).toHaveText("Result pending");
  await expect(page.getByTestId("block-bbl").getByTestId("sentences-bbl")).toHaveCount(0);
});

test("an inconclusive citation result says so in its title and shows its bound, categories and sentence", async ({ page }) => {
  await serve(page);
  await page.goto("/benchmarks");
  await expect(page.getByRole("heading", { name: "Does our citation checker catch wrong citations? (Inconclusive)" })).toBeVisible();
  await expect(page.getByTestId("outcome-citation")).toHaveText("Inconclusive");
  await expect(page.getByTestId("bound-bar").getByRole("img")).toHaveAttribute("aria-label", /Toy upper bound: 8\.8%, n 80, one sided upper/);
  await expect(page.getByTestId("categories-citation")).toContainText("Toy category: 4");
  await expect(page.getByTestId("sentences-citation")).toContainText("Toy upper bound: 0.088 (one sided upper, exact 95%, n = 80; toy answers).");
});

test("the page works at phone width: no horizontal scroll of the page", async ({ page }) => {
  await serve(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/benchmarks");
  await expect(page.getByTestId("block-bbl").getByTestId("interval-chart")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
