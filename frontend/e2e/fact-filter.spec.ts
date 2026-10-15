import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// P5 M2a (#144), R1's words: the result's facts as buttons that narrow the ingredient rows to the rows citing the selected fact.
const FACTS = ["Invented: Ravi told Meena the toy lorry was his own.", "Invented: Meena paid Ravi 500 rupees in cash.", "Invented: Ravi stopped answering her calls."];
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const SCREENED = {
  run_id: "r-invented-filter", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: FACTS.map((t, i) => ({ id: `F${i + 1}`, sha256: sha(t) })),
  contracts: [{ contract_id: "ipc415_property", outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [
      { ...base, element: "deceives another person by affirmative misrepresentation", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" },
      { ...base, element: "the deception induces delivery of property", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F2", quote_source: "whole_fact" },
      { ...base, element: "the deception is fraudulent or dishonest", status: "not_established", p_established: 0.1, p_established_second: 0.1, fact_id: null, quote_source: null },
    ] }],
};

async function screened(page: import("@playwright/test").Page) {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } }));
  await page.route("**/api/v1/analyse-facts", (r) => r.fulfill({ json: SCREENED }));
  await page.goto("/screening");
  await page.getByLabel("Fact F1", { exact: true }).fill(FACTS[0]);
  for (const t of FACTS.slice(1)) { await page.getByRole("button", { name: "Add a fact" }).click(); await page.getByLabel(`Fact F${FACTS.indexOf(t) + 1}`, { exact: true }).fill(t); }
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("fact-filter")).toBeVisible();
}

test("the filter shows R1's hint and 'Showing all rows.'; selecting a fact narrows the rows, the counts stay whole; selecting it again restores all", async ({ page }) => {
  await screened(page);
  const rows = page.getByTestId("ingredient-row");
  await expect(page.getByTestId("fact-filter-hint")).toHaveText("Select a fact to see the rows that cite it.");
  await expect(page.getByTestId("fact-filter-status")).toHaveText("Showing all rows.");
  await expect(rows).toHaveCount(3);
  const banner = await page.getByTestId("checklist").first().innerText();
  await page.getByTestId("fact-filter-F1").click();
  await expect(page.getByTestId("fact-filter-F1")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("fact-filter-status")).toHaveText("Showing the rows that cite F1.");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("deceives another person");
  await expect(page.getByTestId("no-fact-group")).toHaveCount(0);
  expect((await page.getByTestId("checklist").first().innerText()).includes("deceives another person")).toBe(true);
  expect(banner.length).toBeGreaterThan(0);
  await page.getByTestId("fact-filter-F1").click();
  await expect(rows).toHaveCount(3);
  await expect(page.getByTestId("fact-filter-status")).toHaveText("Showing all rows.");
});

test("Show all rows clears; a fact no row cites shows the empty line; the keyboard works", async ({ page }) => {
  await screened(page);
  const rows = page.getByTestId("ingredient-row");
  await page.getByTestId("fact-filter-F3").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("fact-filter-status")).toHaveText("Showing the rows that cite F3.");
  await expect(page.getByTestId("fact-filter-empty")).toHaveText("No ingredient row cites this fact.");
  await expect(rows).toHaveCount(0);
  await page.getByTestId("fact-filter-F2").focus();
  await page.keyboard.press("Space");
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId("fact-filter-empty")).toHaveCount(0);
  await page.getByRole("button", { name: "Show all rows" }).click();
  await expect(rows).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Show all rows" })).toHaveCount(0);
});
