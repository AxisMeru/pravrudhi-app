import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// Operator 13 Oct (via Lead-2): a reference-only contract (BNS 69) shows none of the engine's wording, including the Lean check's claim strings. Another contract still shows them.
const FACT = "The invented user fact: Ravi and Meena exchanged letters in the invented town of Quillpoort.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const claims = (tag: string) => ({ verdict: "PROOF", denied_claims: [`${tag}-DENIED-CLAIM`], unlicensed_claims: [`${tag}-UNLICENSED-CLAIM`], omitted_claims: [`${tag}-OMITTED-CLAIM`] });
const contract = (id: string, tag: string) => ({
  contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: claims(tag), lean_outcome: "PROOF", uncertain: [], statute_text_mismatch: null, citations: [],
  elements: [{ ...base, element: "a promise", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }],
});
const answer = (id: string, tag: string) => ({ run_id: "r-invented-lean", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice", facts: [{ id: "F1", sha256: sha(FACT) }], contracts: [contract(id, tag)] });

async function analyse(page: import("@playwright/test").Page, id: string, tag: string) {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [id], entries: [{ id, validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer(id, tag) }));
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByText(id).click();
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("memo-actions")).toBeVisible();
}

test("Matters: BNS 69 shows none of the Lean claim strings (denied, unlicensed, omitted)", async ({ page }) => {
  await analyse(page, "bns69", "REF");
  await expect(page.getByText("Lean structural check")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/REF-(DENIED|UNLICENSED|OMITTED)-CLAIM/);
});

test("Matters: another contract still shows its Lean claim strings", async ({ page }) => {
  await analyse(page, "bns85", "OTHER");
  await expect(page.locator("body")).toContainText("OTHER-DENIED-CLAIM");
  await expect(page.locator("body")).toContainText("OTHER-UNLICENSED-CLAIM");
  await expect(page.locator("body")).toContainText("OTHER-OMITTED-CLAIM");
});
