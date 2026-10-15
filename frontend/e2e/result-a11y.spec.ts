import { expect, test } from "./support/engineTest";
import contractElements from "../src/lib/fixtures/contractElements.json";
import { sha } from "./support/sha";

// Explorer result review, 15 Oct (R5, R6, R7): the print button sits beside the memo group, a result announces itself once, and each offence checkbox has a readable name.
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const IDS = ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers", "ipc415_property", "ipc415_damaging_act"];
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const els = contractElements.contracts as unknown as Record<string, { elements?: string[] }>;
const ANSWER = {
  run_id: "r-invented-a11y", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: IDS.map((id) => ({
    contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: (els[id]?.elements ?? []).map((element) => ({ ...base, element, status: "not_established", p_established: 0.2, p_established_second: 0.2, fact_id: null, quote_source: null })),
  })),
};

async function result(page: import("@playwright/test").Page) {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: IDS, entries: IDS.map((id) => ({ id, validated: true })) } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: ANSWER }));
  await page.goto("/screening?example=madras-public-order-2024");
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toHaveCount(5);
}

test("R5: 'Print / save as PDF' is beside the 'Download the memo' group, not inside it", async ({ page }) => {
  await result(page);
  const group = page.getByTestId("memo-group");
  await expect(group.getByRole("button", { name: "Print / save as PDF" })).toHaveCount(0);
  await expect(group.getByRole("button")).toHaveText(["Markdown (.md)", "Word (.docx)"]);
  await expect(page.getByTestId("memo-actions").getByRole("button", { name: "Print / save as PDF", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF", exact: true })).toHaveCount(0);
});

test("R6: one live region for the whole result, not one per block", async ({ page }) => {
  await result(page);
  // the Citations panel under the result (arm ON) has its own live region for the answers a user asks for there (#223 D6): it is a separate feature, not a block of the result
  const statuses = page.getByTestId("screening-result").locator('[role="status"]:not([data-testid^="citations-panel"])');
  await expect(statuses).toHaveCount(1);
  // R1 (15 Oct): and the standing line is on the page once per result (above the first block), not once per block
  await expect(page.getByText("This is a screening aid, not legal advice. A lawyer decides.", { exact: true })).toHaveCount(1);
});

test("R7 (R1, #310 F2): each offence checkbox is named 'title \u00b7 sections' (the one separator every offence label uses), never run together", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: IDS, entries: IDS.map((id) => ({ id, validated: true })) } }));
  await page.goto("/screening");
  await expect(page.getByRole("checkbox", { name: "Criminal breach of trust · BNS 316 · IPC 405" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Cheating · BNS 318 · IPC 415" })).toBeVisible();
  for (const box of await page.getByRole("checkbox").all()) {
    const name = (await box.getAttribute("aria-label")) ?? "";
    expect(name, name).not.toMatch(/[a-z]BNS/);
  }
});
