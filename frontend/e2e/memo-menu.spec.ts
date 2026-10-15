import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// P5 M2b (#144): "Download the memo" is a menu button: Word first (by position only, no default tag), Markdown; Escape and a click elsewhere close it and return focus; choosing closes it.
const F = "Invented: Ravi told Meena the toy lorry was his own.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const SCREENED = {
  run_id: "r-invented-menu", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice", facts: [{ id: "F1", sha256: sha(F) }],
  contracts: [{ contract_id: "ipc415_property", outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person by affirmative misrepresentation", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }] }],
};
async function screened(page: import("@playwright/test").Page) {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } }));
  await page.route("**/api/v1/analyse-facts", (r) => r.fulfill({ json: SCREENED }));
  await page.goto("/screening");
  await page.getByLabel("Fact F1", { exact: true }).fill(F);
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("memo-menu-button")).toBeVisible();
}

test("the menu button is named Download the memo, starts closed, opens Word then Markdown, and says nothing about a default", async ({ page }) => {
  await screened(page);
  const button = page.getByTestId("memo-menu-button");
  await expect(button).toHaveText("Download the memo");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("memo-menu-list")).toHaveCount(0);
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("memo-menu-list").getByRole("button")).toHaveText(["Word (.docx)", "Markdown (.md)"]);
  await expect(page.getByTestId("memo-menu-list")).not.toContainText(/default|recommended/i);
  await expect(page.getByTestId("memo-actions").getByRole("button", { name: "Print / save as PDF" })).toBeVisible();
  await expect(page.getByTestId("memo-actions").getByRole("button", { name: "Download run record (.json)" })).toBeVisible();
});

test("Escape and a click elsewhere close the menu and Escape returns focus to the button; choosing Markdown downloads it and closes", async ({ page }) => {
  await screened(page);
  const button = page.getByTestId("memo-menu-button");
  await button.click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("memo-menu-list")).toHaveCount(0);
  await expect(button).toBeFocused();
  await button.click();
  await page.getByTestId("standing-line").click();
  await expect(page.getByTestId("memo-menu-list")).toHaveCount(0);
  await button.click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("memo-md").click()]);
  expect(dl.suggestedFilename()).toBe("screening-memo-r-invented-menu.md");
  await expect(page.getByTestId("memo-menu-list")).toHaveCount(0);
  await expect(button).toBeFocused();
});
