import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

/**
 * The matters page's cited fact view (#15): the cited fact shown once (a passage marked only when the span is a strict part of it), and the Lean
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
        facts: [{ id: "F1", sha256: sha(F1) }, { id: "F2", sha256: sha(F2) }],
        contracts: [{
          contract_id: "bns69", outcome: "PROOF", reason: "all_elements_established", assertions: { a: true },
          lean, lean_outcome: lean ? "PROOF" : null,
          lean_attestation: lean ? { binary_sha256: BIN, wire_sha256: WIRE, verdict: "PROOF" } : null,
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
  element: "a promise", is_denial: false, screening_signal: null, citation_note: null, status: "established", claimed: true, p_established: 0.91, fact_id: "F1", quote: QUOTE1,
  start: cp(F1, QUOTE1), end: cp(F1, QUOTE1) + Array.from(QUOTE1).length, quote_check: "ok", attempts: 1, occurrences: 1,
  offsets_source: "system", quote_source: "model", error: null, ...o,
});

test("a strictly partial span is a passage within the cited fact, marked once, at the engine's code-point offsets (an emoji before it does not shift it)", async ({ page }) => {
  await analyse(page, [element({})]);
  const passage = page.getByTestId("cited-passage");
  await expect(passage).toBeVisible();
  await expect(passage.locator("mark")).toHaveText(QUOTE1);
  await expect(passage).toContainText("Passage within the cited fact F1");
  await expect(page.getByText(`“${QUOTE1}”`)).toHaveCount(0); // not repeated as a second, italic copy
});

test("a span that is the whole fact shows the cited fact once, plain, with no mark and no italic copy", async ({ page }) => {
  await analyse(page, [element({ fact_id: "F2", quote: F2, start: 0, end: Array.from(F2).length, quote_source: "whole_fact" })]);
  const fact = page.getByTestId("cited-fact");
  await expect(fact).toBeVisible();
  await expect(fact).toContainText("Cited fact F2");
  await expect(fact).toContainText(F2);
  await expect(fact.locator("mark")).toHaveCount(0);
  await expect(page.getByTestId("cited-passage")).toHaveCount(0);
  await expect(page.getByText(`“${F2}”`)).toHaveCount(0);
});

test("offsets that cannot be used show the cited fact plain; a fact that is not among the facts falls back to the labelled quote", async ({ page }) => {
  await analyse(page, [
    element({ element: "a promise", offsets_source: null }),
    element({ element: "a delay", fact_id: "F2", quote: QUOTE2, start: 0, end: 5, offsets_source: "system" }), // slice is not the quote
    element({ element: "a gap", fact_id: "F404", quote: "nowhere", start: null, end: null, offsets_source: null }),
    element({ element: "a hole", fact_id: "F405", quote: "everywhere", start: null, end: null, offsets_source: null, quote_source: "whole_fact" }),
  ]);
  await expect(page.getByTestId("cited-fact")).toHaveCount(2);
  await expect(page.getByTestId("cited-fact").first()).toContainText(F1);
  await expect(page.getByTestId("cited-passage")).toHaveCount(0);
  await expect(page.locator("mark")).toHaveCount(0);
  const fallback = page.getByTestId("cited-fact-fallback");
  await expect(fallback).toHaveCount(2);
  await expect(fallback.first()).toContainText("Cited fact:");
  await expect(fallback.first()).toContainText("“nowhere”"); // judge-written words keep the marks
  await expect(fallback.nth(1)).toContainText("everywhere");
  await expect(fallback.nth(1)).not.toContainText("“"); // a whole fact cited in full is not a quotation
});

test("the Lean attestation shows both hashes and the structural-check note, and never says verified", async ({ page }) => {
  await analyse(page, [element({})], { verdict: "PROOF", denied_claims: [], unlicensed_claims: [], omitted_claims: [] });
  const att = page.getByTestId("lean-attestation");
  await expect(att).toBeVisible();
  await expect(att).toContainText(BIN);
  await expect(att).toContainText(WIRE);
  await expect(att).toContainText("structural");
  await expect(att).not.toContainText(/verified|proven in lean/i);
});

test("no attestation block when the engine sent none", async ({ page }) => {
  await analyse(page, [element({})], null);
  await expect(page.getByTestId("cited-passage")).toBeVisible();
  await expect(page.getByTestId("lean-attestation")).toHaveCount(0);
});

test("at phone width the page itself does not scroll sideways and the evidence stays inside the screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await analyse(page, [element({})], { verdict: "PROOF", denied_claims: [], unlicensed_claims: [], omitted_claims: [] });
  await expect(page.getByTestId("cited-passage")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "the page scrolls sideways at 375 px").toBeLessThanOrEqual(0);
  const box = await page.getByTestId("cited-passage").boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375, `the evidence cell is cut off: ${JSON.stringify(box)}`).toBeTruthy();
  const att = await page.getByTestId("lean-attestation").boundingBox();
  expect(att && att.x >= 0 && att.x + att.width <= 375, `the hash block is cut off: ${JSON.stringify(att)}`).toBeTruthy();
});

test("the no-structural-check line is not shown on a contract that is not a referral", async ({ page }) => {
  await analyse(page, [element({ status: "not_established", p_established: 0.3 })], null);
  // the recorded answer above is a PROOF with no Lean result: the line must NOT show (not a referral)
  await expect(page.getByTestId("no-structural-check")).toHaveCount(0);
});

test("REFER_TO_LAWYER with lean null shows the signed line; with a structural check it shows the check instead", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  let withLean = false;
  await page.route("**/api/v1/analyse-facts**", (r) =>
    r.fulfill({
      json: {
        run_id: "r-invented-3", judge: "invented", score_sha256: "c".repeat(64), provenance: "invented",
        facts: [{ id: "F1", sha256: sha(F1) }],
        contracts: [{
          contract_id: "bns69", outcome: "REFER_TO_LAWYER", reason: "uncertain", assertions: null,
          lean: withLean ? { verdict: "PROOF", denied_claims: [], unlicensed_claims: [], omitted_claims: [] } : null,
          lean_outcome: withLean ? "PROOF" : null,
          lean_attestation: withLean ? { binary_sha256: BIN, wire_sha256: WIRE, verdict: "PROOF" } : null,
          uncertain: [], statute_text_mismatch: null, citations: [], elements: [element({ status: "not_established", p_established: 0.5 })],
        }],
      },
    }),
  );
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(F1);
  await page.getByRole("group", { name: "Contracts to check against" }).getByText("bns69").click();
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("no-structural-check")).toHaveText("No structural check was run for this referral.");
  await expect(page.getByTestId("lean-attestation")).toHaveCount(0);
  withLean = true;
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("lean-attestation")).toBeVisible();
  await expect(page.getByTestId("no-structural-check")).toHaveCount(0);
});
