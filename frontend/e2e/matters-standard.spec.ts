import { expect, test } from "@playwright/test";

// #32: the matter view shows the standard line applied and its source. analyse-facts is mocked so the check
// is deterministic; the page itself is served by a real local engine ("dev stack (local)", $0).
const base = {
  run_id: "r-std", judge: "dev", score_sha256: "a".repeat(64),
  facts: [{ id: "F1", text: "The cheque was dishonoured on presentment.", sha256: "b".repeat(64) }],
  contracts: [{
    contract_id: "ni138", outcome: "PROOF", reason: "all elements established",
    elements: [{
      element: "dishonour", is_denial: false, status: "established", claimed: true, p_established: 0.93, fact_id: "F1",
      quote: "dishonoured", start: 15, end: 26, quote_check: "ok", attempts: 1, occurrences: 1, offsets_source: "system",
      quote_source: "model", error: null,
    }],
    assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
  }],
};

async function analyse(page: import("@playwright/test").Page, body: object) {
  await page.route("**/api/v1/analyse-facts", (r) => r.fulfill({ json: body }));
  await page.goto("/matters");
  await page.locator("main").getByRole("heading", { name: "Matters", exact: true }).waitFor();
  const first = page.getByRole("group", { name: "Contracts to check against" }).getByRole("checkbox").first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  await first.click({ force: true });
  await page.getByLabel("Facts (one per line)").fill("The cheque was dishonoured on presentment.");
  await page.getByLabel(/^Narrative/).fill("standard line check");
  await page.getByRole("button", { name: "Analyse" }).click();
}

test("engine omits the standard: the view says proved (default)", async ({ page }) => {
  await analyse(page, base);
  await expect(page.getByTestId("standard-line").first()).toHaveText("standard: proved (default)");
});

test("engine sends the standard and its source: the view names both", async ({ page }) => {
  await analyse(page, { ...base, standard: "prima_facie_disclosed", standard_source: "posture" });
  await expect(page.getByTestId("standard-line").first()).toHaveText("standard: prima facie disclosed (from proceeding posture)");
});
