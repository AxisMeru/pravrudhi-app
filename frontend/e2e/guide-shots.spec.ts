import { expect, test } from "./support/engineTest";

// Regenerates the guide's screenshots from the real UI with an invented matter (opt-in: GUIDE_SHOTS=1 npx playwright test guide-shots). The guide's images are checked in under
// public/guide/; run this after the screens they show change, then commit the PNGs. It is skipped in the normal matrix.
test.skip(process.env.GUIDE_SHOTS !== "1", "opt-in: regenerates public/guide/*.png");

const F = "Invented: a seller said a plot was his own and sold it for a sum paid in cash, and the buyer later learned the plot belonged to someone else.";
const answer = {
  run_id: "run-guide", judge: "invented", score_sha256: "0".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: "1".repeat(64) }],
  contracts: [{ contract_id: "ipc415_property", outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, elements: [] }],
};

test("06 the memo export group", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer }));
  await page.setViewportSize({ width: 832, height: 900 });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const actions = page.getByTestId("memo-actions");
  await expect(actions).toBeVisible();
  await actions.screenshot({ path: "public/guide/06-memo-export.png" });
});

const FACTS6 = [
  "Invented: a seller told a buyer that a plot of land was his own and showed a paper he called a title deed.",
  "Invented: the buyer paid a sum in cash to the seller on the day they agreed the sale.",
  "Invented: the seller gave the buyer a receipt but no registered sale deed.",
  "Invented: months later the buyer learned that the plot belonged to someone else.",
  "Invented: the buyer asked for the money back and the seller refused.",
  "Invented: the seller stopped answering the buyer's calls after that.",
];
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const EL = [
  "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts",
  "the deception fraudulently or dishonestly induces the deceived person",
  "the inducement causes delivery of property to any person, or consent that any person shall retain property",
];
const full = {
  run_id: "run-guide", judge: "invented", score_sha256: "0".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: FACTS6.map((_, i) => ({ id: `F${i + 1}`, sha256: String(i + 1).repeat(64).slice(0, 64) })),
  contracts: [{
    contract_id: "ipc415_property", outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [
      { ...base, element: EL[0], status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" },
      { ...base, element: EL[1], status: "not_confirmed", p_established: 0.6, p_established_second: null, fact_id: null, quote_source: null },
      { ...base, element: EL[2], status: "not_established", p_established: 0.1, p_established_second: null, fact_id: null, quote_source: null },
    ],
  }],
};

// the floating "Shortcuts" helper would sit on top of the shots
async function hideFloaters(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      if (getComputedStyle(el).position === "fixed" && /Shortcuts/.test(el.textContent ?? "")) el.style.display = "none";
    });
  });
}

async function openWith(page: import("@playwright/test").Page, answerBody: unknown) {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answerBody }));
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(FACTS6.join("\n\n"));
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
}

test("01 the input after Split into numbered facts", async ({ page }) => {
  await openWith(page, full);
  await expect(page.getByRole("textbox", { name: "Fact F6", exact: true })).toBeVisible();
  await hideFloaters(page);
  await page.getByTestId("standing-line").evaluate((el) => { for (let n: HTMLElement | null = el as HTMLElement; n; n = n.parentElement) n.scrollTop = 0; });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "public/guide/01-screening-input.png" });
});

test("02 the ingredient checklist", async ({ page }) => {
  await openWith(page, full);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const checklist = page.getByTestId("checklist").first();
  await expect(checklist).toBeVisible();
  await page.setViewportSize({ width: 832, height: 900 });
  await hideFloaters(page);
  await checklist.screenshot({ path: "public/guide/02-ingredient-checklist.png" });
  const rows = page.getByTestId("ingredient-row");
  await rows.nth(0).screenshot({ path: "public/guide/03-cited-fact.png" });
  await rows.nth(1).screenshot({ path: "public/guide/04-needs-your-review.png" });
});

// R1 (14 Oct): frames 02 and 03 should come from a REAL run of a public-order example, not from invented facts. GUIDE_EXAMPLE=<example id> (for instance karnataka-cheating-2025) loads
// that example and screens it against a LIVE engine (no mocked analyse-facts: LOCAL_ENGINE_URL must point at an engine with judges); frame 01 stays the invented input form above.
// Run: GUIDE_SHOTS=1 GUIDE_EXAMPLE=karnataka-cheating-2025 npx playwright test guide-shots -g "real example".
test("02/03 the checklist and a row from a real example run (live engine)", async ({ page }) => {
  test.skip(!process.env.GUIDE_EXAMPLE, "set GUIDE_EXAMPLE=<example id> and a live engine to retake 02 and 03 from the real example");
  test.setTimeout(400_000);
  await page.setViewportSize({ width: 832, height: 900 });
  await page.goto(`/screening?example=${process.env.GUIDE_EXAMPLE}`);
  await expect(page.getByTestId("example-citation")).toBeVisible();
  await expect(page.getByTestId("offence-list").locator("input:checked")).not.toHaveCount(0); // the example selects its offence once the registry has loaded
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const checklist = page.getByTestId("checklist").first();
  await expect(checklist).toBeVisible({ timeout: 380_000 });
  await hideFloaters(page);
  await checklist.screenshot({ path: "public/guide/02-ingredient-checklist.png" });
  await page.getByTestId("ingredient-row").first().screenshot({ path: "public/guide/03-cited-fact.png" });
  // 04 from the same live run, when a row carries the Needs your review mark (skipped silently otherwise; keep the existing frame then).
  const review = page.getByTestId("ingredient-row").filter({ hasText: "Needs your review" }).first();
  if (await review.count()) await review.screenshot({ path: "public/guide/04-needs-your-review.png" });
});

// 05: the Case citations panel as the hosted build serves it today: no citation index, so the engine refuses and the panel says so (the product's own refusal; the citation is the
// neutral citation of the Karnataka public order the first example uses, not an invented case).
test("05 the citations panel with the index not available (hosted state)", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD !== "1" || process.env.CITATION_EXISTENCE_BUILD !== "1", "the Screening panel is rendered only on a build with both citation flags");
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ status: 503, json: { error: "citation_index_unavailable", code: "citation_index_unavailable" } }));
  await openWith(page, full); // the panel sits under a result
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist").first()).toBeVisible();
  await page.setViewportSize({ width: 832, height: 900 });
  const panel = page.getByTestId("citations-panel");
  await panel.scrollIntoViewIfNeeded();
  await panel.locator("textarea").fill("2025:KHC:12773");
  await panel.getByRole("button", { name: "Check citations" }).click();
  await expect(panel).toContainText("The citation index is not available");
  await hideFloaters(page);
  await panel.screenshot({ path: "public/guide/05-citations-panel.png" });
});
