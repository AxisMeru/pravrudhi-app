import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// The Case citations panel under a Screening result is rendered only on a build with BOTH NEXT_PUBLIC_CITATION_NAV=1 and
// NEXT_PUBLIC_CITATION_EXISTENCE_ONLY=1 (CITATION_NAV_BUILD=1 and CITATION_EXISTENCE_BUILD=1 in the test environment). Any other build: no panel, none of its text.
const BOTH = process.env.CITATION_NAV_BUILD === "1" && process.env.CITATION_EXISTENCE_BUILD === "1";
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const SCREENED = {
  run_id: "r-invented-gate", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: [{ contract_id: "ipc415_property", outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }] }],
};

test(BOTH ? "both citation flags ON: the Citations panel sits under a Screening result" : "a build without both citation flags: no Citations panel under a Screening result, and none of its text", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts", (r) => r.fulfill({ json: SCREENED }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  if (BOTH) {
    await expect(page.getByTestId("citations-panel")).toBeVisible();
  } else {
    await expect(page.getByTestId("citations-panel")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("preview: existence check only");
    await expect(page.locator("body")).not.toContainText("Check citations");
  }
});
