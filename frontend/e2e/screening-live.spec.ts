import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

import type { AnalyseFactsResult } from "../src/lib/api";
import { EXAMPLE_CONTRACTS, EXAMPLE_FACTS, EXAMPLE_ID } from "../src/lib/demo/example";
import { checkDemoResult, type DemoFixture } from "../src/lib/demo/liveCheck";
import { CHIP_LABEL } from "../src/lib/screening/copy";
import { knownElements, rowsFor, summarize } from "../src/lib/screening/model";
import { OFFENCES, offenceOf } from "../src/lib/screening/offences";

/**
 * The Screening view's production E2E (O8.5, #830): the design-partner flow on the public judgment the demo page uses (the allegations of
 * Crl.O.P. No. 13624 of 2024, Madras High Court), against the DEPLOYED app and judge. It asserts the real response (src/lib/demo/liveCheck.ts), and
 * that what the page shows is a plain-words reading of it: one checklist per contract, one row per ingredient with one of the three chips, the
 * cited fact shown in full, a what-to-check line, the summary banner per contract, the review items not styled as errors, no "proved" /
 * "established" / "verbatim" in the checklist, the memo and the audit trail.
 *
 * NOT RUN BY DEFAULT. A production run needs Lead-2's written go: set SCREENING_LIVE_GO=1 for the window it was granted for (the go names the
 * call count and the $ cap; one run is ONE analyse-facts call), the e2e member account in the environment (E2E_EMAIL / E2E_PASSWORD), and
 * #59, #60 and #61 merged first (see docs/demo-runbook.md). Skipped, not failed, outside the service window, with the reason.
 * SCREENING_LIVE_REPEATS (default 1) runs it more than once in the window; each run attaches `observed-screening` JSON with run id and the
 * per-contract chip counts (pipeline-measured, n = the runs in the window, no performance claim).
 */
const GO = process.env.SCREENING_LIVE_GO === "1";
// A rehearsal against a LOCAL engine: no sign-in, no judge; the registry and the analysis are recorded INVENTED answers (page.route). It exists so the
// assertions below are proven to pass on a well-formed answer before a real window is spent. It makes no claim about the engine.
const REHEARSAL = process.env.SCREENING_LIVE_REHEARSAL === "1";
const REPEATS = Math.max(1, Number(process.env.SCREENING_LIVE_REPEATS ?? "1") || 1);
const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

test.skip(!GO && !REHEARSAL, "no production run without Lead-2's written go (SCREENING_LIVE_GO=1); objective and metrics are on pravrudhi-app#830");

test.beforeAll(() => {
  if (GO && !REHEARSAL && (!E2E_EMAIL || !E2E_PASSWORD)) throw new Error("SCREENING_LIVE_GO is set but E2E_EMAIL and E2E_PASSWORD are not (see ~/.config/pravrudhi/e2e.env).");
});

// the offences the example invokes, and every contract of each (the offence is the unit of choice on the page)
const CONTRACT_IDS = [...new Set(EXAMPLE_CONTRACTS.flatMap((id) => offenceOf(id)?.contracts ?? [id]))];
const FIXTURE: DemoFixture = {
  id: EXAMPLE_ID,
  label: "the public judgment's allegations, as the demo page loads them",
  path: "proof",
  contract_ids: CONTRACT_IDS,
  wordings: { plain: [...EXAMPLE_FACTS], formal: [...EXAMPLE_FACTS] },
  expect: { recorded_runs: 0, outcomes: null },
};

function rehearsalAnswer(): AnalyseFactsResult {
  const facts = EXAMPLE_FACTS.map((text, i) => ({ id: `F${i + 1}`, text, sha256: "b".repeat(64) }));
  const base = { is_denial: false, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null, quote_source: "whole_fact", p_established_second: 0.8 };
  const contracts = CONTRACT_IDS.map((id, ci) => {
    const known = knownElements(id)!;
    return {
      contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
      citations: [{ act: "IPC", section: "405", corpus_id: "x", in_corpus: true, title: "t" }],
      elements: known.elements.map((element, i) => ({ ...base, element, status: i === 0 ? "established" : i === 1 ? "not_confirmed" : "not_established", p_established: 0.5, fact_id: i === 0 ? `F${(ci % facts.length) + 1}` : null })),
    };
  });
  return { run_id: "rehearsal-invented", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice", facts, contracts } as unknown as AnalyseFactsResult;
}

async function signIn(page: Page): Promise<void> {
  if (REHEARSAL) return;
  await page.goto("/signin");
  await page.getByLabel("Email", { exact: true }).fill(E2E_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD!);
  const accepted = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/me" && r.request().method() === "GET" && r.ok(), { timeout: 30_000 });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => ["/", "/screening", "/matters"].includes(url.pathname), { timeout: 20_000 });
  await expect(page.getByText(E2E_EMAIL!, { exact: true })).toBeVisible();
  await accepted;
}

for (let run = 1; run <= REPEATS; run++) {
  test(`screening / ${EXAMPLE_ID} / run ${run}`, async ({ page }) => {
    test.setTimeout(REHEARSAL ? 40_000 : 420_000);
    if (REHEARSAL) {
      await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: CONTRACT_IDS, entries: [] } }));
      await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: rehearsalAnswer() }));
      await page.route("**/api/me", (r) => r.fulfill({ json: { edition: "Pravrudhi", tagline: "t", access: "member" } }));
    }
    await signIn(page);
    // the landing page after sign-in is Screening
    await page.goto("/");
    await page.waitForURL(/\/screening/, { timeout: 20_000 });
    await page.goto(`/screening?example=${EXAMPLE_ID}`);
    await page.locator("main").getByRole("heading", { name: "Screening", exact: true }).waitFor();
    const offline = page.getByTestId("screening-offline");
    // Lazily: innerText() on an element that is not there waits for the whole test timeout, so only read it when the notice is visible.
    const closed = await offline.isVisible().catch(() => false);
    test.skip(closed, `outside the service window: ${closed ? await offline.innerText() : ""}`);

    // the example loaded: numbered facts, its offences selected
    await expect(page.getByTestId("example-banner")).toContainText("Crl.O.P. No. 13624 of 2024");
    for (let i = 0; i < EXAMPLE_FACTS.length; i++) {
      await expect(page.getByRole("textbox", { name: `Fact F${i + 1}`, exact: true })).toHaveValue(EXAMPLE_FACTS[i]);
    }
    await expect(page.getByTestId("offence-list").locator("input:checked")).toHaveCount(new Set(EXAMPLE_CONTRACTS.map((c) => offenceOf(c)?.id)).size, { timeout: 30_000 });

    const responded = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/analyse-facts" && r.request().method() === "POST", { timeout: 400_000 });
    await page.getByRole("button", { name: "Screen these facts" }).click();
    const response = await responded;
    expect(response.ok(), `analyse-facts answered ${response.status()}`).toBe(true);
    const result = (await response.json()) as AnalyseFactsResult;
    const submitted = [...EXAMPLE_FACTS];
    expect(checkDemoResult(result, submitted, FIXTURE), "violations of the real response").toEqual([]);

    // what the page shows is a plain-words reading of that response
    await expect(page.getByTestId("screening-result")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("checklist")).toHaveCount(result.contracts.length);
    const observed: Record<string, { supported: number; review: number; notSupported: number; banner: string }> = {};
    for (const c of result.contracts) {
      const section = page.getByTestId("checklist").filter({ hasText: c.contract_id });
      const rows = rowsFor(c, result.facts);
      const summary = summarize(c, rows);
      await expect(section.getByTestId("ingredient-row")).toHaveCount(rows.ingredients.length + rows.defences.length);
      await expect(section.getByTestId("summary-text")).toHaveText(summary.text);
      // directly above the standing line
      await expect(section.getByTestId("summary-banner")).toHaveText(new RegExp(`${summary.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*This is a screening aid, not legal advice\\. A lawyer decides\\.`));
      const chips = await section.getByTestId("ingredient-chip").allInnerTexts();
      for (const t of chips) expect(Object.values(CHIP_LABEL), `an unknown chip "${t}"`).toContain(t);
      // every row names what to check, and a cited fact is shown in full from the submitted facts
      const rowsLoc = section.getByTestId("ingredient-row");
      for (let i = 0; i < (await rowsLoc.count()); i++) {
        await expect(rowsLoc.nth(i).getByTestId("what-to-check")).toBeVisible();
      }
      for (const r of [...rows.ingredients, ...rows.defences]) {
        if (r.factText) await expect(section.getByTestId("cited-fact-text").filter({ hasText: r.factText })).not.toHaveCount(0);
      }
      // review items are never styled as errors
      for (const chip of await section.locator('[data-chip="review"] [data-testid="ingredient-chip"]').all()) await expect(chip).not.toHaveClass(/red/);
      const text = await section.innerText();
      expect(text, "the checklist says proved, established or verbatim").not.toMatch(/\bproved\b|\bestablished\b|verbatim|offence is made out/i);
      observed[c.contract_id] = { supported: summary.supported, review: summary.review, notSupported: summary.total - summary.supported - rows.ingredients.filter((r) => r.chip === "review").length, banner: summary.text };
    }
    // the IPC-text disclosure sits on the IPC-family offences the example invokes
    for (const o of OFFENCES.filter((o) => o.ipcChecked && CONTRACT_IDS.some((id) => o.contracts.includes(id)))) {
      await expect(page.getByTestId("checklist").filter({ hasText: o.title }).first().getByTestId("ipc-disclosure")).toContainText(`s.${o.ipcChecked}`);
    }

    // the Citations panel is below the checklist
    await expect(page.getByRole("heading", { name: /citation/i }).first()).toBeVisible();

    // the memo and the audit trail carry the same run
    const [memoDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download memo (.md)" }).click()]);
    const memo = readFileSync(await memoDl.path(), "utf8");
    expect(memo).toContain("# Screening memo");
    expect(memo).toContain(result.run_id);
    expect(memo).toContain(result.score_sha256);
    for (const c of result.contracts) {
      expect(memo, `the memo has no section for ${c.contract_id}`).toContain(`Contract: ${c.contract_id}`);
      expect(memo, `the memo lacks ${c.contract_id}'s banner`).toContain(summarize(c, rowsFor(c, result.facts)).text);
    }
    const lines = memo.split("\n");
    for (const line of lines) {
      if (/ingredients have a supporting fact|All ingredients supported/.test(line)) {
        expect(lines[lines.indexOf(line) + 1]).toBe("This is a screening aid, not legal advice. A lawyer decides.");
      }
    }
    const [auditDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download audit trail (.json)" }).click()]);
    const audit = JSON.parse(readFileSync(await auditDl.path(), "utf8"));
    expect(audit.response.run_id).toBe(result.run_id);
    expect(audit.request.facts).toEqual(submitted);

    await test.info().attach("observed-screening", {
      contentType: "application/json",
      body: JSON.stringify({ run, run_id: result.run_id, contracts: observed }),
    });
  });
}
