import { expect, test } from "@playwright/test";

/**
 * #32: the matter view shows the standard line applied next to the verdict. This runs against RECORDED responses (page.route),
 * not a judge: a real run on the dev stack (label "dev stack (local)") is the follow-up and is not claimed here.
 */
const FACTS = ["TOY: a promise was made.", "TOY: it was relied on."];
const RESULT = (standard: unknown) => ({
  run_id: "run-TOY-1",
  judge: "recorded",
  score_sha256: "a".repeat(64),
  facts: FACTS.map((text, i) => ({ id: `F${i + 1}`, text, sha256: "b".repeat(64) })),
  provenance: "recorded",
  retention_notice: "recorded retention notice",
  ...(standard === undefined ? {} : { standard }),
  contracts: [
    { contract_id: "bns69", outcome: "ABSTAIN", reason: "missing_element", elements: [], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, citations: [] },
  ],
});

async function runWith(page: import("@playwright/test").Page, standard: unknown): Promise<void> {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts", (r) => r.fulfill({ json: RESULT(standard) }));
  await page.goto("/matters");
  // The checkbox itself is visually hidden (sr-only); its label wraps it, so the click goes to the label.
  const group = page.getByRole("group", { name: "Contracts to check against" });
  await group.locator("label").filter({ hasText: "bns69" }).first().click({ force: true });
  await expect(group.getByRole("checkbox").first()).toBeChecked();
  await page.getByLabel("Facts (one per line)").fill(FACTS.join("\n"));
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("standard-line")).toBeVisible({ timeout: 15_000 });
}

test("a response without a standard says the engine reported none", async ({ page }) => {
  await runWith(page, undefined);
  await expect(page.getByTestId("standard-line")).toHaveText("standard: not reported by this engine (judged at the default standard of proof)");
  await expect(page.getByTestId("standard-notice")).toHaveCount(0);
});

test("a posture-derived standard shows its value and source", async ({ page }) => {
  await runWith(page, { requested: "prima_facie_disclosed", applied: "prima_facie_disclosed", source: "proceeding_posture", proceeding_posture: "quash", in_judge_prompt: true });
  await expect(page.getByTestId("standard-line")).toContainText("standard: prima_facie_disclosed (from the proceeding posture: quash)");
  await expect(page.getByTestId("standard-notice")).toHaveCount(0);
});

test("a standard the judge was not told says so", async ({ page }) => {
  await runWith(page, { requested: "prima_facie_disclosed", applied: null, source: "proceeding_posture", proceeding_posture: "quash", in_judge_prompt: false });
  await expect(page.getByTestId("standard-notice")).toContainText("did not shape this result");
  await expect(page.getByTestId("standard-line")).toContainText("standard requested: prima_facie_disclosed");
});
