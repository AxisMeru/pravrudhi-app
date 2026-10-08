import { expect, test } from "@playwright/test";

/**
 * The contract picker's states and the results table's structure on /matters (design-partner audit, gaps 2 and 3). Recorded engine
 * answers (page.route) with invented values: no judge is needed.
 */
const REGISTRY = "**/api/nyaya/registry/contracts";
const FACT = "Ravi lent the toy lorry to Meena on a Monday in the invented town of Quillpoort.";

test("a registry that answers with no contracts says so, instead of a Loading… that never ends", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.goto("/matters");
  await expect(page.getByTestId("contracts-empty")).toContainText("returned no contracts");
  await expect(page.getByText("Loading…")).toHaveCount(0);
});

test("a registry that fails shows the error as an alert with a retry, and the retry recovers", async ({ page }) => {
  let calls = 0;
  await page.route(REGISTRY, (r) => {
    calls += 1;
    return calls <= 2 ? r.fulfill({ status: 500, json: { error: "x" } }) : r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } });
  });
  await page.goto("/matters");
  await expect(page.getByTestId("contracts-error")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "registry" })).toBeVisible();
  await page.getByTestId("contracts-retry").click();
  await expect(page.getByRole("group", { name: "Contracts to check against" }).getByText("bns69")).toBeVisible();
  await expect(page.getByTestId("contracts-error")).toHaveCount(0);
});

test("the results table has a caption, column headers with scope, and sits in a horizontally scrollable wrapper", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) =>
    r.fulfill({
      json: {
        run_id: "r-invented-1", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented",
        facts: [{ id: "f1", text: FACT, sha256: "b".repeat(64) }],
        contracts: [{
          contract_id: "bns69", outcome: "PROOF", reason: "all_elements_established", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
          elements: [{ element: "a promise", is_denial: false, status: "established", claimed: true, p_established: 0.9, fact_id: "f1", quote: FACT.slice(0, 40), start: 0, end: 40, quote_check: "ok", attempts: 1, occurrences: 1, offsets_source: "model", quote_source: "model", error: null }],
        }],
      },
    }),
  );
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByRole("group", { name: "Contracts to check against" }).getByText("bns69").click();
  await page.getByRole("button", { name: "Analyse" }).click();
  const table = page.locator("article table").first();
  await expect(table).toBeVisible();
  await expect(table.locator("caption")).toHaveText(/Elements of bns69: status and the cited fact/);
  await expect(table.locator("th[scope=col]")).toHaveCount(3);
  await expect(table.locator("xpath=..")).toHaveClass(/overflow-x-auto/);
});

test("a referral is listed before the other results, whatever order the engine answered in", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["bns69", "bns85"], entries: [{ id: "bns69", validated: true }, { id: "bns85", validated: true }] } }));
  const base = { assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, elements: [] };
  await page.route("**/api/v1/analyse-facts**", (r) =>
    r.fulfill({
      json: {
        run_id: "r-invented-3", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", facts: [{ id: "f1", text: FACT, sha256: "b".repeat(64) }],
        contracts: [{ ...base, contract_id: "bns69", outcome: "ABSTAIN", reason: "missing_element" }, { ...base, contract_id: "bns85", outcome: "REFER_TO_LAWYER", reason: "uncertain" }],
      },
    }),
  );
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByText("bns69").click();
  await page.getByText("bns85").click();
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.locator("article").first()).toContainText("bns85");
  await expect(page.locator("article").nth(1)).toContainText("bns69");
});

test("the cited-fact cell branches on quote_source: a whole fact says so and shows no quote, the engine's citation_note is shown when sent", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  const el = { is_denial: false, status: "established", claimed: true, p_established: 0.9, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null };
  await page.route("**/api/v1/analyse-facts**", (r) =>
    r.fulfill({
      json: {
        run_id: "r-invented-4", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", facts: [{ id: "f1", text: FACT, sha256: "b".repeat(64) }, { id: "f2", text: "Meena kept it.", sha256: "c".repeat(64) }],
        contracts: [{
          contract_id: "bns69", outcome: "PROOF", reason: "all_elements_established", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
          elements: [
            { ...el, element: "first", fact_id: "f1", quote: "INVENTED MODEL QUOTE", quote_source: "model", quote_check: "ok", citation_note: "INVENTED ENGINE SENTENCE" },
            { ...el, element: "second", fact_id: "f2", quote: "INVENTED WHOLE FACT", quote_source: "whole_fact", quote_check: "ok" },
          ],
        }],
      },
    }),
  );
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByText("bns69").click();
  await page.getByRole("button", { name: "Analyse" }).click();
  const notes = page.getByTestId("cited-fact-note");
  await expect(notes.nth(0)).toHaveText("— INVENTED ENGINE SENTENCE");
  await expect(notes.nth(1)).toHaveText("— cites your fact f2 in full (the judge names the fact; it does not quote words)");
  // #82 shows the cited fact itself (data-driven from the facts), not a quote the facts do not contain
  await expect(page.getByTestId("cited-fact").first()).toContainText(FACT);
  await expect(page.getByText("INVENTED WHOLE FACT")).toHaveCount(0);
  await expect(page.locator("th[scope=col]").last()).toHaveText("cited fact");
});

test("an older engine (no quote_source) on the house path: the page says it cites the supporting fact, shows no quote and no quote-check cause", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  const el = { is_denial: false, status: "established", claimed: true, p_established: 0.9, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null };
  await page.route("**/api/v1/analyse-facts**", (r) =>
    r.fulfill({
      json: {
        run_id: "r-invented-5", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", facts: [{ id: "f1", text: FACT, sha256: "b".repeat(64) }],
        contracts: [{
          contract_id: "bns69", outcome: "PROOF", reason: "all_elements_established", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
          elements: [{ ...el, element: "first", fact_id: "f1", quote: "INVENTED OLDER QUOTE", quote_source: null, quote_check: "quote_not_found" }],
        }],
      },
    }),
  );
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByText("bns69").click();
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("cited-fact-note")).toHaveText("— cites the supporting fact");
  await expect(page.getByText("INVENTED OLDER QUOTE")).toHaveCount(0);
  await expect(page.getByTestId("quote-check-cause")).toHaveCount(0);
});
