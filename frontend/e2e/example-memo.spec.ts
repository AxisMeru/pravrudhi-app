import { readFileSync } from "node:fs";

import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// R2 (#216): the memo carries the example label and the order's citation ONLY while the facts are the loaded example, unchanged; edited, typed or added facts are the user's own.
const CID = "ipc415_property";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const answer = (facts: string[]) => ({
  run_id: "r-invented-exmemo", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: facts.map((f, i) => ({ id: `F${i + 1}`, sha256: sha(f) })),
  contracts: [{ contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "not_established", p_established: 0.2, p_established_second: 0.2, fact_id: null, quote_source: null }] }],
});

async function memoText(page: import("@playwright/test").Page, edit: boolean): Promise<string> {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => {
    const sent = (r.request().postDataJSON() as { facts: Array<string | { text?: string }> }).facts.map((f) => (typeof f === "string" ? f : (f.text ?? "")));
    return r.fulfill({ json: answer(sent) });
  });
  await page.goto("/screening?example=madras-public-order-2024");
  const f1 = page.getByRole("textbox", { name: "Fact F1", exact: true });
  await expect(f1).not.toHaveValue("");
  if (edit) await f1.fill("My own client's fact about a loan.");
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist").first()).toBeVisible();
  await page.getByTestId("memo-menu-button").click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Markdown (.md)", exact: true }).click()]);
  return readFileSync((await dl.path()) as string, "utf8");
}

test("an unedited example run: the memo carries the example label and the order's citation", async ({ page }) => {
  const md = await memoText(page, false);
  expect(md).toContain("A public court order, example only.");
  expect(md).toContain("Madras High Court, order of 12 June 2024");
});

test("an example whose first fact was replaced by the user's own: no example label, no court citation in the memo", async ({ page }) => {
  const md = await memoText(page, true);
  expect(md).toContain("My own client's fact about a loan.");
  expect(md).not.toContain("A public court order, example only.");
  expect(md).not.toContain("Madras High Court");
});
