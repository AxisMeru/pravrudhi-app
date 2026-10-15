import { readFileSync } from "node:fs";

// Plain Playwright test on purpose: the mock answers here are deliberately wrong-typed, which the schema-checked drop-in would reject.
import { expect, test } from "@playwright/test";

import { sha } from "./support/sha";

// #114 (Lead-2 option A, R1's string): an engine answer with a listed field of the wrong type, or an unknown assertions key, is unreadable as a whole: one error notice, none of the
// result, and a run record that carries only the marker and the run id.
const TEXT = "The engine's answer could not be read, so no result is shown. This says nothing about your facts. Try again, or ask a lawyer to review the matter.";
const MARKER = "AGENT-FREE-TEXT-MARKER";
const CID = "ipc415_property";
const FACT = "Ravi lent the toy lorry to Meena on a Monday in the invented town of Quillpoort.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const valid = () => ({
  run_id: "r-invented-bad", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(FACT) }],
  contracts: [{
    contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "an invented ingredient", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }],
  }],
});
type W = ReturnType<typeof valid> & Record<string, unknown>;
const c0 = (w: W) => w.contracts[0] as unknown as Record<string, unknown>;
const WRONG: Array<[string, (w: W) => void]> = [
  ["contracts is an object", (w) => { w.contracts = { a: MARKER } as never; }],
  ["elements is a string", (w) => { c0(w).elements = MARKER; }],
  ["citations is a string", (w) => { c0(w).citations = MARKER; }],
  ["uncertain is an object", (w) => { c0(w).uncertain = { a: MARKER }; }],
  ["assertions has a free-text key", (w) => { c0(w).assertions = { [MARKER]: true }; }],
  ["standard is a string", (w) => { w.standard = MARKER; }],
  ["facts is an object", (w) => { w.facts = { a: MARKER } as never; }],
];
const route = (page: import("@playwright/test").Page, answer: unknown) => Promise.all([
  page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } })),
  page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer })),
]);
async function screen(page: import("@playwright/test").Page) {
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(FACT);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
}
async function analyse(page: import("@playwright/test").Page) {
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.locator(`label[data-contract-id="${CID}"]`).click();
  await page.getByRole("button", { name: "Analyse" }).click();
}

for (const [name, mutate] of WRONG) {
  test(`Screening: ${name}: the notice, no result, a run record of only the marker and the run id`, async ({ page }) => {
    const w = valid() as W;
    mutate(w);
    await route(page, w);
    await screen(page);
    await expect(page.getByTestId("screening-error")).toHaveText(TEXT);
    for (const id of ["checklist", "screening-result", "memo-actions", "ingredient-row"]) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Markdown (.md)", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Print / save as PDF", exact: true })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(MARKER);
    await expect(page.locator("body")).not.toContainText(/Needs your review/);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("invalid-run-record").click()]);
    const body = readFileSync((await dl.path())!, "utf8");
    expect(JSON.parse(body)).toEqual({ invalid_engine_answer: true, run_id: "r-invented-bad" });
    expect(body).not.toContain(MARKER);
  });
}

test("Matters: an unreadable answer shows the same notice and none of the result", async ({ page }) => {
  const w = valid() as W;
  c0(w).elements = MARKER;
  await route(page, w);
  await analyse(page);
  await expect(page.getByRole("alert").filter({ hasText: TEXT })).toHaveCount(1);
  await expect(page.getByTestId("memo-actions")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(MARKER);
});

test("both arms: the same answer without the wrong type renders the checklist and the export buttons, and no unreadable notice", async ({ page }) => {
  await route(page, valid());
  await screen(page);
  await expect(page.getByTestId("checklist")).toBeVisible();
  await expect(page.getByTestId("memo-actions")).toBeVisible();
  await expect(page.getByTestId("invalid-run-record")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(TEXT);
});
