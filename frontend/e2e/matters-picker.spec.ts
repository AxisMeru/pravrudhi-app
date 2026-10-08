import { expect, test } from "@playwright/test";

/**
 * The contract picker's states and the results table's structure on /matters (design-partner audit, gaps 2 and 3). Recorded engine
 * answers (page.route) with invented values: no judge is needed.
 */
const REGISTRY = "**/api/nyaya/registry/contracts";
const FACT = "Ravi lent the toy lorry to Meena on a Monday in the invented town of Quillpoort.";

test("a registry that answers with no contracts says so, instead of a Loading… that never ends", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.goto("/matters");
  await expect(page.getByTestId("contracts-empty")).toContainText("returned no contracts");
  await expect(page.getByText("Loading…")).toHaveCount(0);
});

test("a registry that fails shows the error as an alert with a retry, and the retry recovers", async ({ page }) => {
  let calls = 0;
  await page.route(REGISTRY, (r) => {
    calls += 1;
    return calls <= 2 ? r.fulfill({ status: 500, json: { error: "x" } }) : r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } });
  });
  await page.goto("/matters");
  await expect(page.getByTestId("contracts-error")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "registry" })).toBeVisible();
  await page.getByTestId("contracts-retry").click();
  await expect(page.getByRole("group", { name: "Contracts to check against" }).getByText("bns69")).toBeVisible();
  await expect(page.getByTestId("contracts-error")).toHaveCount(0);
});

test("the results table has a caption, column headers with scope, and sits in a horizontally scrollable wrapper", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) =>
    r.fulfill({
      json: {
        run_id: "r-invented-1", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented",
        facts: [{ id: "f1", text: FACT, sha256: "b".repeat(64) }],
        contracts: [{
          contract_id: "bns69", outcome: "PROOF", reason: "all_elements_established", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
          elements: [{ element: "a promise", is_denial: false, status: "established", claimed: true, p_established: 0.9, fact_id: "f1", quote: FACT.slice(0, 40), start: 0, end: 40, quote_check: "ok", attempts: 1, occurrences: 1, offsets_source: "model", quote_source: "model", error: null }],
        }],
      },
    }),
  );
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByRole("group", { name: "Contracts to check against" }).getByText("bns69").click();
  await page.getByRole("button", { name: "Analyse" }).click();
  const table = page.locator("article table").first();
  await expect(table).toBeVisible();
  await expect(table.locator("caption")).toHaveText(/Elements of this contract/);
  await expect(table.locator("th[scope=col]")).toHaveCount(3);
  await expect(table.locator("xpath=..")).toHaveClass(/overflow-x-auto/);
});
