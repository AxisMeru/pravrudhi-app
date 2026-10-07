import { expect, test } from "@playwright/test";

/**
 * The referral layout and the status explanations, against RECORDED responses (page.route), not a judge: the heading "Referred to a
 * lawyer", then the signed sentence on its own (no lead-in), the two-judges label beside it, and the signed explanation under a
 * status that is not a verdict. The wording itself is held to the signed table by src/lib/reasonStringsDrift.spec.ts.
 */
const FACTS = ["TOY: a promise was made.", "TOY: it was relied on."];
const el = (status: string) => ({ element: "promise", is_denial: false, status, claimed: false, p_established: null, fact_id: null, quote: null, start: null, end: null, quote_check: null, attempts: 1, occurrences: 0, offsets_source: null, quote_source: null, error: null });
const RESULT = (reason: string) => ({
  run_id: "run-TOY-1",
  judge: "recorded",
  score_sha256: "a".repeat(64),
  facts: FACTS.map((text, i) => ({ id: `F${i + 1}`, text, sha256: "b".repeat(64) })),
  provenance: "recorded",
  retention_notice: "recorded retention notice",
  contracts: [
    { contract_id: "bns69", outcome: "REFER_TO_LAWYER", reason, elements: [el("not_confirmed"), el("not_evaluated_second_unavailable")], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, citations: [] },
  ],
});

async function runWith(page: import("@playwright/test").Page, reason: string): Promise<void> {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts", (r) => r.fulfill({ json: RESULT(reason) }));
  await page.goto("/matters");
  const group = page.getByRole("group", { name: "Contracts to check against" });
  await group.locator("label").filter({ hasText: "bns69" }).first().click({ force: true });
  await expect(group.getByRole("checkbox").first()).toBeChecked();
  await page.getByLabel("Facts (one per line)").fill(FACTS.join("\n"));
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("referred-heading")).toBeVisible({ timeout: 15_000 });
}

test("a referral shows the heading, then the signed sentence on its own", async ({ page }) => {
  await runWith(page, "gate1_unavailable");
  await expect(page.getByTestId("referred-heading")).toHaveText("Referred to a lawyer");
  await expect(page.getByTestId("referred-sentence")).toHaveText(
    "The entailment check (a separate check of the quoted words against the claim) was unavailable, so we give a referral, not an answer.",
  );
  await expect(page.getByTestId("referred-two-judges")).toHaveCount(0);
  await expect(page.getByText(/must decide this matter|should be reviewed by a lawyer/)).toHaveCount(0);
});

test("a two-judges reason carries the label beside the sentence, not inside it", async ({ page }) => {
  await runWith(page, "second_judge_unavailable");
  await expect(page.getByTestId("referred-sentence")).toHaveText("The second judge was unavailable, so we give a referral, not an answer.");
  await expect(page.getByTestId("referred-two-judges")).toHaveText("(deployments that use two judges only)");
});

test("a status that is not a verdict carries its signed explanation", async ({ page }) => {
  await runWith(page, "uncertain");
  const notes = page.getByTestId("status-explanation");
  await expect(notes).toHaveCount(2);
  await expect(notes.first()).toContainText("did not reach the level we require");
  await expect(notes.nth(1)).toHaveText("The second judge did not answer, so this condition was not confirmed.");
});
