import { readFileSync } from "node:fs";

import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";
import contractElements from "../src/lib/fixtures/contractElements.json";

// Operator 13 Oct (via Lead-2, R1's strings): BNS 69 is shown by its reference only. The engine's element wording, rule text and statute line are not displayed on the page or in the memo.
const REF = contractElements.contracts.bns69;
const FACT = "The invented user fact: Ravi and Meena exchanged letters in the invented town of Quillpoort.";
const EXPLICIT = /sexual|intercourse|rape|deceitful|marry|marriage|woman|employment|promotion|RULE-TEXT-MARKER|JUDGE-RULE-MARKER/i;
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const answer = {
  run_id: "r-invented-ref", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(FACT) }],
  contracts: [{
    contract_id: "bns69", outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, citations: [],
    rule_text: "RULE-TEXT-MARKER", rule_text_source: "invented", judge_rule_text: "JUDGE-RULE-MARKER",
    elements: [
      { ...base, element: REF.elements[0], status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" },
      { ...base, element: REF.elements[1], status: "not_established", p_established: 0.1, p_established_second: null, fact_id: null, quote_source: null },
    ],
  }],
};

test("BNS 69: the picker row, the checklist rows and the memo carry the reference and the user's own fact, never the engine's wording", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer }));
  await page.goto("/screening");
  const row = page.getByTestId("offence-list").locator("label").filter({ has: page.getByText("BNS 69", { exact: true }) });
  await expect(row).toHaveCount(1);
  await expect(page.getByTestId("offence-list")).not.toContainText(EXPLICIT);
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(FACT);
  await page.getByTestId("split-facts").click();
  await row.click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const checklist = page.getByTestId("checklist");
  await expect(checklist).toBeVisible();
  await expect(checklist.getByRole("heading", { name: "BNS 69" })).toBeVisible();
  const rows = checklist.getByTestId("ingredient-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("BNS 69 · ingredient 1");
  await expect(rows.nth(1)).toContainText("BNS 69 · ingredient 2");
  await expect(rows.nth(0).getByTestId("what-to-check")).toContainText("Check the cited fact against the section.");
  await expect(rows.nth(0).getByTestId("cited-fact-text")).toContainText(FACT);
  expect(await page.getByTestId("screening-result").innerText()).not.toMatch(EXPLICIT);
  const [memoDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Markdown (.md)", exact: true }).click()]);
  const memo = readFileSync(await memoDl.path(), "utf8");
  expect(memo).not.toMatch(EXPLICIT);
  expect(memo).toContain("BNS 69 · ingredient 1");
  // the run record keeps the engine's text exactly as received
  const [recDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download run record (.json)" }).click()]);
  const rec = JSON.parse(readFileSync(await recDl.path(), "utf8")) as { response: { contracts: Array<{ elements: Array<{ element: string }> }> } };
  expect(rec.response.contracts[0].elements.map((e) => e.element)).toEqual([REF.elements[0], REF.elements[1]]);
});
