import { expect, test } from "@playwright/test";

/**
 * The matters page's evidence view (#15): the supporting quote shown once, inside its fact, at the engine's offsets, and the Lean
 * attestation hashes. Recorded engine answers (page.route) with invented values only: no judge is needed. Claim tier: unit-tested and
 * rendered against a recorded answer, not run live.
 */
const REGISTRY = "**/api/nyaya/registry/contracts";
const F1 = "😀 Ravi lent the toy lorry to Meena on a Monday in the invented town of Quillpoort, and Meena promised to return it by Friday.";
const F2 = "Meena kept the lorry for a month.";
const QUOTE1 = "promised to return it by Friday";
const QUOTE2 = "kept the lorry";
const cp = (s: string, sub: string) => Array.from(s.slice(0, s.indexOf(sub))).length; // the engine counts code points
const BIN = "a".repeat(64);
const WIRE = "0123456789abcdef".repeat(4);

async function analyse(page: import("@playwright/test").Page, elements: object[], lean: object | null = null) {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) =>
    r.fulfill({
      json: {
        run_id: "r-invented-2", judge: "invented", score_sha256: "c".repeat(64), provenance: "invented",
        facts: [{ id: "F1", text: F1, sha256: "d".repeat(64) }, { id: "F2", text: F2, sha256: "e".repeat(64) }],
        contracts: [{
          contract_id: "bns69", outcome: "PROOF", reason: "all_elements_established", assertions: { a: true },
          lean, lean_outcome: lean ? "Proof" : null,
          lean_attestation: lean ? { binary_sha256: BIN, wire_sha256: WIRE, verdict: "Proof" } : null,
          uncertain: [], statute_text_mismatch: null, citations: [], elements,
        }],
      },
    }),
  );
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(`${F1}\n${F2}`);
  await page.getByRole("group", { name: "Contracts to check against" }).getByText("bns69").click();
  await page.getByRole("button", { name: "Analyse" }).click();
}

const element = (o: object) => ({
  element: "a promise", is_denial: false, status: "established", claimed: true, p_established: 0.91, fact_id: "F1", quote: QUOTE1,
  start: cp(F1, QUOTE1), end: cp(F1, QUOTE1) + Array.from(QUOTE1).length, quote_check: "ok", attempts: 1, occurrences: 1,
  offsets_source: "system", quote_source: "model", error: null, ...o,
});

test("a quote is shown once, highlighted in its fact at the engine's code-point offsets (an emoji before it does not shift it)", async ({ page }) => {
  await analyse(page, [element({})]);
  const inFact = page.getByTestId("quote-in-fact");
  await expect(inFact).toBeVisible();
  await expect(inFact.locator("mark")).toHaveText(QUOTE1);
  await expect(inFact).toContainText("In fact F1");
  await expect(page.getByText(`“${QUOTE1}”`)).toHaveCount(0); // not repeated as a second, italic copy
});

test("offsets that cannot be used fall back to the plain quote: not from the engine, or not the quote", async ({ page }) => {
  await analyse(page, [
    element({ element: "a promise", offsets_source: null }),
    element({ element: "a delay", fact_id: "F2", quote: QUOTE2, start: 0, end: 5, offsets_source: "system" }), // slice is not the quote
  ]);
  await expect(page.getByText(`“${QUOTE1}”`)).toBeVisible();
  await expect(page.getByText(`“${QUOTE2}”`)).toBeVisible();
  await expect(page.getByTestId("quote-in-fact")).toHaveCount(0);
});

test("the Lean attestation shows both hashes and the structural-check note, and never says verified", async ({ page }) => {
  await analyse(page, [element({})], { verdict: "Proof", denied_claims: [], unlicensed_claims: [], omitted_claims: [] });
  const att = page.getByTestId("lean-attestation");
  await expect(att).toBeVisible();
  await expect(att).toContainText(BIN);
  await expect(att).toContainText(WIRE);
  await expect(att).toContainText("structural");
  await expect(att).not.toContainText(/verified|proven in lean/i);
});

test("no attestation block when the engine sent none", async ({ page }) => {
  await analyse(page, [element({})], null);
  await expect(page.getByTestId("quote-in-fact")).toBeVisible();
  await expect(page.getByTestId("lean-attestation")).toHaveCount(0);
});

test("at phone width the page itself does not scroll sideways and the evidence stays inside the screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await analyse(page, [element({})], { verdict: "Proof", denied_claims: [], unlicensed_claims: [], omitted_claims: [] });
  await expect(page.getByTestId("quote-in-fact")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "the page scrolls sideways at 375 px").toBeLessThanOrEqual(0);
  const box = await page.getByTestId("quote-in-fact").boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375, `the evidence cell is cut off: ${JSON.stringify(box)}`).toBeTruthy();
  const att = await page.getByTestId("lean-attestation").boundingBox();
  expect(att && att.x >= 0 && att.x + att.width <= 375, `the hash block is cut off: ${JSON.stringify(att)}`).toBeTruthy();
});
