import { createHash } from "node:crypto";

import type { AnalyseFactsWire } from "../src/lib/api";
import { knownElements } from "../src/lib/screening/model";
import { expect, test } from "./support/engineTest";

/**
 * The tonal look on paper (d25 explorer read, P3-1): under print emulation each result card keeps ONLY its inset state rule (no outer drop shadows), and the page is white. Runs only on a build with
 * NEXT_PUBLIC_LOOK_TONAL=1 (LOOK_BUILD=1 in the environment); otherwise skipped, since the rules are not applied without the attribute.
 */
test.skip(process.env.LOOK_BUILD !== "1", "needs the build with NEXT_PUBLIC_LOOK_TONAL=1");

const TEXT = "Invented: a petitioner is said to have taken an advance of money for a promised sale of land and then to have failed to complete it, and to have threatened the complainant when he asked.";
const CONTRACTS = ["ipc415_property"];
function answer(): AnalyseFactsWire {
  const facts = [{ id: "F1", sha256: createHash("sha256").update(TEXT).digest("hex") }];
  const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null, quote_source: "whole_fact", p_established_second: 0.8 };
  const contracts = CONTRACTS.map((id) => ({
    contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    citations: [{ act: "IPC", section: "415", corpus_id: "x", in_corpus: true, title: "t" }],
    elements: knownElements(id)!.elements.map((element, i) => ({ ...base, element, status: i === 0 ? "established" : i === 1 ? "not_confirmed" : "not_established", p_established: 0.5, fact_id: i === 0 ? "F1" : null })),
  }));
  return { run_id: "invented-look-print", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented", facts, contracts } as unknown as AnalyseFactsWire;
}

test("print emulation: the result cards keep the inset state rule and drop the outer drop shadows", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: CONTRACTS, entries: [] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer() }));
  await page.route("**/api/me", (r) => r.fulfill({ json: { edition: "Pravrudhi", tagline: "t", access: "member" } }));
  await page.goto("/screening");
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-look"))).toBe("tonal");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(TEXT);
  await page.getByTestId("split-facts").click();
  await page.getByTestId("offence-list").locator("label").filter({ hasText: "Cheating" }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await page.getByTestId("screening-result").waitFor({ timeout: 20000 });
  // screen: the cards carry the state rule AND the layered shadow (two shadows)
  const shadows = (chip: string) => page.locator(`[data-testid="ingredient-row"][data-chip="${chip}"]`).first().evaluate((el) => getComputedStyle(el).boxShadow);
  const count = (v: string) => v.split(/,\s(?![^(]*\))/).length;
  for (const chip of ["supported", "review", "not_supported"]) expect(count(await shadows(chip)), `${chip} on screen`).toBeGreaterThan(1);
  await page.emulateMedia({ media: "print" });
  for (const chip of ["supported", "review", "not_supported"]) {
    const v = await shadows(chip);
    expect(count(v), `${chip} in print is one shadow`).toBe(1);
    expect(v, `${chip} in print is the inset rule`).toContain("inset");
  }
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundImage)).toBe("none");
});
