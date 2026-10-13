import { readFileSync } from "node:fs";

// This spec deliberately uses the plain Playwright test, not ./support/engineTest: its mock answer carries fields the engine schema does not have (that is the point),
// and the schema-checked drop-in would reject them.
import { expect, test } from "@playwright/test";

import { sha } from "./support/sha";

// AxisMeru/pravrudhi-app#113 (Lead-2, 13 Oct): the result renders only from the decide tool result. Free text an agent wrote around it never reaches a page, the memo or the run record.
const MARKER = "AGENT-FREE-TEXT-MARKER";
const CID = "ipc415_property";
const FACT = "Ravi lent the toy lorry to Meena on a Monday in the invented town of Quillpoort.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const answer = {
  run_id: "r-invented-decide", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(FACT) }],
  contracts: [{
    contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "an invented ingredient", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }],
  }],
  // what an orchestrating agent might add around the decide result: none of it may be shown
  display_text: MARKER, message: MARKER, reply: MARKER, summary: MARKER, text: MARKER, answer: MARKER, agent_message: MARKER, narrative: MARKER, content: MARKER,
};
const route = (page: import("@playwright/test").Page) => Promise.all([
  page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } })),
  page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer })),
]);

test("Screening renders the decide result and none of the agent's free text, in the page, the memo or the run record", async ({ page }) => {
  await route(page);
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(FACT);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(MARKER);
  for (const name of ["Download memo (.md)", "Download run record (.json)"]) {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name }).click()]);
    expect(readFileSync((await dl.path())!, "utf8"), name).not.toContain(MARKER);
  }
});

test("Matters renders the decide result and none of the agent's free text", async ({ page }) => {
  await route(page);
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByText(CID).click();
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("memo-actions")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(MARKER);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download memo (.md)" }).click()]);
  expect(readFileSync((await dl.path())!, "utf8")).not.toContain(MARKER);
});
