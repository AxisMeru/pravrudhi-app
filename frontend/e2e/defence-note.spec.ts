import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// R1 (#283, 13 Oct): the unmeasured-defence line appears wherever a defence is shown, once per page, and nowhere else.
const NOTE = "No test set with a defence label has been scored, so how reliably the screening finds a fact that may defeat the claim has not been measured.";
const CID = "ipc415_property";
const FACT = "Ravi lent the toy lorry to Meena on a Monday in the invented town of Quillpoort.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const result = (outcome: string, withDefence: boolean) => ({
  run_id: "r-invented-def", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(FACT) }],
  contracts: [{
    contract_id: CID, outcome, reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [
      { ...base, element: "an invented ingredient", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" },
      ...(withDefence ? [{ ...base, is_denial: true, element: "an invented defence", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }] : []),
    ],
  }],
});
const registry = (page: import("@playwright/test").Page) => page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));

async function screen(page: import("@playwright/test").Page, answer: unknown) {
  await registry(page);
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(FACT);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
}

async function matters(page: import("@playwright/test").Page, answer: unknown) {
  await registry(page);
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer }));
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByText(CID).click();
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("memo-actions")).toBeVisible();
}

test("Screening: a defence row carries the line, once, under the defence heading", async ({ page }) => {
  await screen(page, result("DENIAL", true));
  await expect(page.getByTestId("defence-unmeasured-note")).toHaveCount(1);
  await expect(page.getByTestId("defence-unmeasured-note")).toHaveText(NOTE);
});

test("Screening: no defence row, no line", async ({ page }) => {
  await screen(page, result("ABSTAIN", false));
  await expect(page.getByTestId("defence-unmeasured-note")).toHaveCount(0);
});

test("Matters: a DENIAL outcome carries the line once on the page; any other outcome does not", async ({ page }) => {
  await matters(page, result("DENIAL", true));
  await expect(page.getByTestId("defence-unmeasured-note")).toHaveCount(1);
  await expect(page.getByTestId("defence-unmeasured-note")).toHaveText(NOTE);
});

test("Matters: an ABSTAIN outcome has no line", async ({ page }) => {
  await matters(page, result("ABSTAIN", false));
  await expect(page.getByTestId("defence-unmeasured-note")).toHaveCount(0);
});

test("the guide carries it twice (glossary and Reading the checklist); the pages that never show a defence do not", async ({ page }) => {
  await page.goto("/guide");
  await expect(page.getByText(NOTE)).toHaveCount(2);
  for (const path of ["/data-handling", "/workflows", "/safety"]) {
    await page.goto(path);
    await expect(page.locator("body")).toContainText(/\S/);
    await expect(page.locator("body")).not.toContainText(NOTE);
  }
});
