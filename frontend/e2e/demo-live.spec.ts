import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

import { expect, test } from "./support/engineTest";

import { InvalidEngineAnswerError, decideResultOnly, withFactText, type AnalyseFactsWire } from "../src/lib/api";
import { checkDemoResult, type DemoFixture } from "../src/lib/demo/liveCheck";
import { CHIP_LABEL } from "../src/lib/screening/copy";
import { memoBlockHeading } from "../src/lib/screening/memo";
import { knownElements, rowsFor, summarize } from "../src/lib/screening/model";
import { OFFENCES } from "../src/lib/screening/offences";
import { INVALID_ENGINE_ANSWER_TEXT } from "../src/lib/surfaceCopy";

/**
 * The scripted demo E2E (pravrudhi-app#18): three invented fact sets (PROOF-capable, ABSTAIN, REFER), each in a plain and a
 * near-statutory wording, run against the DEPLOYED app and judge, with content assertions (src/lib/demo/liveCheck.ts, which is
 * itself unit-tested with planted failures): result per contract, element rows, the cited fact (a model quote word for word in
 * the submitted facts, or a whole-fact citation naming a submitted fact, with no quote claim), citations, hashes, the recorded outcome once it binds, and the downloaded memo.
 * It drives the revamped Screening page (#118): paste the facts, Split into numbered facts, pick the offence, Screen these facts, then the checklist (or, when the app cannot read the engine's answer, the unreadable-answer notice, which fails the run).
 *
 * NOT RUN BY DEFAULT. A production run needs Lead-2's written go (set DEMO_LIVE_GO=1 for the window it was granted for) and the
 * e2e member account in the environment (E2E_EMAIL / E2E_PASSWORD). Objective and metrics are on #18. It must not run before
 * the nightly-surface fix (pravrudhi-app#59) is merged. It is SKIPPED, not failed, outside the service window, with the reason.
 *
 * Each fixture/wording is run DEMO_LIVE_REPEATS times (default 3) in the one window, so the outcomes and run ids can be
 * recorded on the issue (pipeline-measured, n stated): they are attached to each test as `observed-run` JSON.
 */
const GO = process.env.DEMO_LIVE_GO === "1";
// A rehearsal against a LOCAL engine: no sign-in, no judge; the registry and the analysis are INVENTED recorded-shape answers (page.route). It proves the page flow and these
// assertions on a well-formed answer before a real window is spent; it makes no claim about the engine.
const REHEARSAL = process.env.DEMO_LIVE_REHEARSAL === "1";
const REPEATS = Math.max(1, Number(process.env.DEMO_LIVE_REPEATS ?? "3") || 3);
const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

const FIXTURES = (JSON.parse(readFileSync(join(__dirname, "fixtures", "demoFixtures.json"), "utf8")) as { fixtures: DemoFixture[] }).fixtures;

test.skip(!GO && !REHEARSAL, "no production run without Lead-2's written go (DEMO_LIVE_GO=1); objective and metrics are on pravrudhi-app#18");

test.beforeAll(() => {
  if (GO && !REHEARSAL && (!E2E_EMAIL || !E2E_PASSWORD)) throw new Error("DEMO_LIVE_GO is set but E2E_EMAIL and E2E_PASSWORD are not (see ~/.config/pravrudhi/e2e.env).");
});

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

/** A well-formed invented answer in the engine's real wire shape (the echoed facts carry id and sha256 only, never text). */
function rehearsalAnswer(contractIds: string[], facts: string[]): AnalyseFactsWire {
  const echoed = facts.map((text, i) => ({ id: `F${i + 1}`, sha256: createHash("sha256").update(text.trim()).digest("hex") }));
  const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null, quote_source: "whole_fact" };
  const contracts = contractIds.map((id, ci) => {
    const known = knownElements(id)!;
    return {
      contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, citations: [{ act: "BNS", section: "x", corpus_id: "x", in_corpus: true, title: "t" }],
      elements: known.elements.map((element, i) => ({ ...base, element, status: i === 0 ? "established" : i === 1 ? "not_confirmed" : "not_established", p_established: 0.5, p_established_second: 0.5, fact_id: i === 0 ? `F${(ci % echoed.length) + 1}` : null })),
    };
  });
  return { run_id: "rehearsal-invented", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice", facts: echoed, contracts } as unknown as AnalyseFactsWire;
}

/** The offences whose contracts include the fixture's contract ids: the offence is the unit of choice on the Screening page. */
const offencesFor = (ids: readonly string[]) => OFFENCES.filter((o) => o.contracts.some((c) => ids.includes(c)));

for (const fixture of FIXTURES) {
  for (const wording of ["plain", "formal"] as const) {
    for (let run = 1; run <= REPEATS; run++) {
      test(`${fixture.id} / ${wording} / run ${run}`, async ({ page }) => {
        test.setTimeout(420_000);
        const facts = fixture.wordings[wording];
        if (REHEARSAL) {
          const ids = offencesFor(fixture.contract_ids).flatMap((o) => [...o.contracts]);
          await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ids, entries: [] } }));
          await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: rehearsalAnswer(ids, facts) }));
          await page.route("**/api/me", (r) => r.fulfill({ json: { edition: "Pravrudhi", tagline: "t", access: "member" } }));
        }
        await signIn(page);
        await page.goto("/screening");
        await page.locator("main").getByRole("heading", { name: "Matter workspace", exact: true }).waitFor();
        // Outside the service window the hosted demo says so and refuses to send: skipped, with the reason, not failed.
        const offline = page.getByTestId("screening-offline");
        const closed = await offline.isVisible().catch(() => false);
        test.skip(closed, `outside the service window: ${closed ? await offline.innerText() : ""}`);

        const offences = offencesFor(fixture.contract_ids);
        // The offence is the unit of choice on the page, so every contract of the offences the fixture needs is requested and answered.
        const requested: DemoFixture = { ...fixture, contract_ids: offences.flatMap((o) => [...o.contracts]) };
        expect(offences.length, `no offence on the Screening page offers ${fixture.contract_ids.join(", ")}`).toBeGreaterThan(0);
        // the facts go in as pasted text (one per line) and become the numbered facts F1..Fn
        await page.getByLabel("Paste the FIR, complaint or narrative").fill(facts.join("\n"));
        await page.getByTestId("split-facts").click();
        for (let i = 0; i < facts.length; i++) await expect(page.getByRole("textbox", { name: `Fact F${i + 1}`, exact: true })).toHaveValue(facts[i].trim());
        for (const o of offences) {
          const label = page.getByTestId("offence-list").locator("label").filter({ has: page.getByText(o.title, { exact: true }) });
          await expect(label, `the page must offer ${o.title}`).toBeVisible({ timeout: 20_000 });
          await label.click();
        }
        const responded = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/analyse-facts" && r.request().method() === "POST", { timeout: 400_000 });
        await page.getByRole("button", { name: "Screen these facts" }).click();
        const response = await responded;
        expect(response.ok(), `analyse-facts answered ${response.status()}`).toBe(true);
        const wire = (await response.json()) as AnalyseFactsWire;
        await test.info().attach("raw-response", { body: JSON.stringify(wire, null, 2), contentType: "application/json" });

        // An answer the app cannot read as a whole is shown as the notice and no result (#114): the run fails, with the page's behaviour checked first.
        let readable = true;
        try { decideResultOnly(wire); } catch (e) { if (e instanceof InvalidEngineAnswerError) readable = false; else throw e; }
        if (!readable) {
          await expect(page.getByTestId("screening-error")).toHaveText(INVALID_ENGINE_ANSWER_TEXT);
          await expect(page.getByTestId("checklist")).toHaveCount(0);
          expect(readable, "the engine's answer could not be read by the app (the page showed the notice, as designed)").toBe(true);
        }
        const result = await withFactText(wire, facts);

        // The content assertions on the REAL response.
        expect(checkDemoResult(wire, facts, requested), "violations of the demo result").toEqual([]);

        // What the page shows is a plain-words reading of that response: a checklist per contract, a row per ingredient, the summary line.
        await expect(page.getByTestId("screening-result")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("screening-result")).toContainText(result.run_id);
        await expect(page.getByTestId("checklist")).toHaveCount(result.contracts.length);
        for (const c of result.contracts) {
          const section = page.getByTestId("checklist").filter({ hasText: c.contract_id }).first();
          const rows = rowsFor(c, result.facts);
          await expect(section.getByTestId("ingredient-row")).toHaveCount(rows.ingredients.length + rows.defences.length);
          await expect(section.getByTestId("summary-text")).toHaveText(summarize(c, rows).text);
          for (const t of await section.getByTestId("ingredient-chip").allInnerTexts()) expect(Object.values(CHIP_LABEL), `an unknown chip "${t}"`).toContain(t);
        }

        // The memo the user downloads carries the same run, contract by contract.
        await page.getByTestId("memo-menu-button").click();
        const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Markdown (.md)", exact: true }).click()]);
        const memo = readFileSync(await download.path(), "utf8");
        expect(memo, "the memo does not carry the run id").toContain(result.run_id);
        expect(memo, "the memo does not carry the score sha256").toContain(result.score_sha256);
        for (const c of result.contracts) {
          expect(memo, `the memo has no section for ${c.contract_id}`).toContain(`## ${memoBlockHeading(c.contract_id)}`);
          expect(memo, `the memo lacks ${c.contract_id}'s summary line`).toContain(summarize(c, rowsFor(c, result.facts)).text);
        }

        // For the record on #18 (pipeline-measured, n = runs in this window): the observed outcomes and run id, no figures.
        await test.info().attach("observed-run", {
          contentType: "application/json",
          body: JSON.stringify({ fixture: fixture.id, wording, run, run_id: result.run_id, outcomes: Object.fromEntries(result.contracts.map((c) => [c.contract_id, `${c.outcome}${c.reason ? ` (${c.reason})` : ""}`])) }),
        });
      });
    }
  }
}
