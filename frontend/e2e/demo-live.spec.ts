import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { withFactText, type AnalyseFactsWire } from "../src/lib/api";
import { checkDemoResult, checkMemoText, type DemoFixture } from "../src/lib/demo/liveCheck";

/**
 * The scripted demo E2E (pravrudhi-app#18): three invented fact sets (PROOF-capable, ABSTAIN, REFER), each in a plain and a
 * near-statutory wording, run against the DEPLOYED app and judge, with content assertions (src/lib/demo/liveCheck.ts, which is
 * itself unit-tested with planted failures): result card per contract, element rows, the cited fact (a model quote word for word in
 * the submitted facts, or a whole-fact citation naming a submitted fact, with no quote claim), citations, hashes, retention notice, the recorded outcome once it binds, and the downloaded memo.
 *
 * NOT RUN BY DEFAULT. A production run needs Lead-2's written go (set DEMO_LIVE_GO=1 for the window it was granted for) and the
 * e2e member account in the environment (E2E_EMAIL / E2E_PASSWORD). Objective and metrics are on #18. It must not run before
 * the nightly-surface fix (pravrudhi-app#59) is merged. It is SKIPPED, not failed, outside the service window, with the reason.
 *
 * Each fixture/wording is run DEMO_LIVE_REPEATS times (default 3) in the one window, so the outcomes and run ids can be
 * recorded on the issue (pipeline-measured, n stated): they are attached to each test as `observed-run` JSON.
 */
const GO = process.env.DEMO_LIVE_GO === "1";
const REPEATS = Math.max(1, Number(process.env.DEMO_LIVE_REPEATS ?? "3") || 3);
const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

const FIXTURES = (JSON.parse(readFileSync(join(__dirname, "fixtures", "demoFixtures.json"), "utf8")) as { fixtures: DemoFixture[] }).fixtures;

test.skip(!GO, "no production run without Lead-2's written go (DEMO_LIVE_GO=1); objective and metrics are on pravrudhi-app#18");

test.beforeAll(() => {
  if (GO && (!E2E_EMAIL || !E2E_PASSWORD)) throw new Error("DEMO_LIVE_GO is set but E2E_EMAIL and E2E_PASSWORD are not (see ~/.config/pravrudhi/e2e.env).");
});

async function signIn(page: Page): Promise<void> {
  await page.goto("/signin");
  await page.getByLabel("Email", { exact: true }).fill(E2E_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD!);
  const accepted = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/me" && r.request().method() === "GET" && r.ok(), { timeout: 30_000 });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/matters", { timeout: 20_000 });
  await expect(page.getByText(E2E_EMAIL!, { exact: true })).toBeVisible();
  await accepted;
}

for (const fixture of FIXTURES) {
  for (const wording of ["plain", "formal"] as const) {
    for (let run = 1; run <= REPEATS; run++) {
      test(`${fixture.id} / ${wording} / run ${run}`, async ({ page }) => {
        test.setTimeout(420_000);
        const facts = fixture.wordings[wording];
        await signIn(page);
        await page.goto("/matters");
        await page.locator("main").getByRole("heading", { name: "Matters", exact: true }).waitFor();
        // Outside the service window the hosted demo says so and refuses to send: skipped, with the reason, not failed.
        const offline = page.getByTestId("matters-offline");
        test.skip(await offline.isVisible().catch(() => false), `outside the service window: ${await offline.innerText().catch(() => "")}`);

        const group = page.getByRole("group", { name: "Contracts to check against" });
        for (const id of fixture.contract_ids) {
          const label = group.locator("label").filter({ hasText: id }).first();
          await expect(label, `the registry must offer ${id}`).toBeVisible({ timeout: 20_000 });
          if (!(await label.locator("input").isChecked())) await label.click({ force: true });
        }
        await page.getByLabel("Facts (one per line)").fill(facts.join("\n"));
        const responded = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/analyse-facts" && r.request().method() === "POST", { timeout: 400_000 });
        await page.getByRole("button", { name: "Analyse" }).click();
        const response = await responded;
        expect(response.ok(), `analyse-facts answered ${response.status()}`).toBe(true);
        const wire = (await response.json()) as AnalyseFactsWire;
        await test.info().attach("raw-response", { body: JSON.stringify(wire, null, 2), contentType: "application/json" });
        const result = withFactText(wire, facts);

        // The content assertions on the REAL response.
        expect(checkDemoResult(wire, facts, fixture), "violations of the demo result").toEqual([]);

        // What the page shows matches that response.
        await expect(page.getByText(new RegExp(`^run ${result.run_id} · score sha ${result.score_sha256}$`))).toBeVisible({ timeout: 30_000 });
        await expect(page.locator("main article")).toHaveCount(result.contracts.length);
        for (const c of result.contracts) {
          const card = page.locator("main article").filter({ hasText: c.contract_id }).first();
          await expect(card.locator("tbody tr")).toHaveCount(c.elements.length);
        }

        // The memo the user downloads carries the same run.
        const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download memo/ }).click()]);
        const memo = readFileSync(await download.path(), "utf8");
        expect(checkMemoText(memo, result), "violations of the downloaded memo").toEqual([]);

        // For the record on #18 (pipeline-measured, n = runs in this window): the observed outcomes and run id, no figures.
        await test.info().attach("observed-run", {
          contentType: "application/json",
          body: JSON.stringify({ fixture: fixture.id, wording, run, run_id: result.run_id, outcomes: Object.fromEntries(result.contracts.map((c) => [c.contract_id, `${c.outcome}${c.reason ? ` (${c.reason})` : ""}`])) }),
        });
      });
    }
  }
}
