import { expect, test } from "./support/engineTest";
import contractElements from "../src/lib/fixtures/contractElements.json";
import { sha } from "./support/sha";
import { expectResultViewNav, isLayoutB } from "./support/layout";

// Hearing preparation (#197) as step 4 of the Matter workspace: rendered from the module's output (lib/screening/hearingPrep.ts); the page adds no word of its own.
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const IDS = ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc415_property"];
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const els = contractElements.contracts as unknown as Record<string, { elements?: string[] }>;

function answer() {
  return {
    run_id: "r-invented-hearing", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
    facts: [{ id: "F1", sha256: sha(F1) }],
    contracts: IDS.map((id, i) => ({
      contract_id: id,
      // block 1: judged, nothing supported (open); block 2: referred to a lawyer (unsettled); block 3: judged, nothing supported (open, an alternate way)
      outcome: i === 1 ? "REFER_TO_LAWYER" : "ABSTAIN", reason: i === 1 ? "contract_not_validated" : "missing_element",
      assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
      elements: (els[id]?.elements ?? []).map((element) => ({ ...base, element, status: "not_established", p_established: 0.2, p_established_second: 0.2, fact_id: null, quote_source: null })),
    })),
  };
}

async function result(page: import("@playwright/test").Page) {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: IDS, entries: IDS.map((id) => ({ id, validated: true })) } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer() }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Criminal breach of trust", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist").first()).toBeVisible();
}

test("hearing preparation: absent before a result, then step 4 with a block per way, open ingredients with their What to check, and the unsettled sentence for a referred block", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: IDS, entries: IDS.map((id) => ({ id, validated: true })) } }));
  await page.goto("/screening");
  await expect(page.getByTestId("hearing-prep")).toHaveCount(0);
  // layout B: before a result the "This screening" group has no Hearing preparation item (available only after a result)
  if (await isLayoutB(page)) await expect(page.getByTestId("mb-screening-group").getByRole("link", { name: "Hearing preparation", exact: true })).toHaveCount(0);
  await result(page);
  const prep = page.getByTestId("hearing-prep");
  await expect(prep.getByRole("heading", { name: "Hearing preparation", level: 2 })).toBeVisible();
  const blocks = prep.getByTestId("hearing-block");
  await expect(blocks).toHaveCount(IDS.length);
  await expect(blocks.nth(0)).toHaveAttribute("data-state", "open");
  await expect(blocks.nth(1)).toHaveAttribute("data-state", "unsettled");
  await expect(blocks.nth(0).getByTestId("hearing-open-ingredient").first()).toContainText("What to check:");
  await expect(blocks.nth(1).getByTestId("hearing-unsettled")).toHaveText("The screening did not settle this part, so no checklist is given here. A lawyer should read the result for it.");
  await expect(blocks.nth(1).getByTestId("hearing-open-ingredient")).toHaveCount(0); // an unsettled block gets the sentence INSTEAD of a checklist
  await expect(blocks.nth(0).getByTestId("hearing-alternate-way")).toHaveCount(0);
  // the second way of breach of trust carries the signed alternate-way note (here it is also the unsettled block); the first way of cheating (block 3) does not
  await expect(blocks.nth(1).getByTestId("hearing-alternate-way")).toHaveText("This is another way the same offence can be made out. Each way is screened separately.");
  await expect(blocks.nth(2).getByTestId("hearing-alternate-way")).toHaveCount(0);
  await expect(prep.getByTestId("hearing-all-supported")).toHaveCount(0); // never when something is open
  await expect(prep.getByTestId("hearing-citations").getByRole("heading", { name: "Citations to check" })).toBeVisible();
  // no contract id, status code or reason code anywhere in it
  const text = await prep.innerText();
  expect(text).not.toMatch(/ipc\d+_|REFER_TO_LAWYER|ABSTAIN|missing_element|contract_not_validated/);
});

test("the step bar links to it and /workflows shows Hearing preparation as Built with a link to it", async ({ page }) => {
  await result(page);
  if (await isLayoutB(page)) {
    // layout B: the result-first view has no step bar (by design); the "This screening" group's Hearing preparation anchor replaces its link
    await expectResultViewNav(page, { hearing: true, citations: process.env.CITATION_NAV_BUILD === "1" && process.env.CITATION_EXISTENCE_BUILD === "1" });
  } else {
    await expect(page.getByTestId("step-state-hearing")).toHaveText("Available");
    await expect(page.getByTestId("step-link-hearing")).toHaveAttribute("href", "#step-hearing");
  }
  await expect(page.locator("#step-hearing")).toBeVisible();
  await page.goto("/workflows");
  const row = page.getByTestId("workflow-row").filter({ hasText: "Hearing preparation" });
  await expect(row).toHaveAttribute("data-status", "Built");
  await expect(row.getByTestId("workflow-open")).toHaveAttribute("href", /\/screening\/?#step-hearing$/);
});
