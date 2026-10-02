import { expect, test } from "@playwright/test";

import { checkDemoResult } from "../src/lib/demoCheck";
import type { AnalyseFactsResult } from "../src/lib/api";
import { DEMO_FIXTURES } from "./fixtures/demo-fact-sets";

/**
 * Scripted demo path against the deployed app, with content assertions (outcome equals the recorded expectation,
 * element rows, quotes present in the submitted facts, hashes, memo download). Runs only in live-chromium, and
 * only inside the service window: outside it the test is skipped with the reason, never failed. A fixture whose
 * contract/expectation has not been recorded yet is skipped for that reason too.
 */
for (const fx of DEMO_FIXTURES) {
  test(`demo ${fx.id}: outcome, elements, quotes, hashes and memo`, async ({ page, request }) => {
    test.setTimeout(360_000);
    test.skip(fx.contractId === null || fx.expectedOutcome === null, `${fx.id}: expectation not recorded yet (needs 3 live runs per wording)`);

    const status = await request.get("/api/v1/status");
    if (status.ok()) {
      const s = (await status.json()) as { service_window?: { open_now?: boolean; enforced?: boolean } | null };
      test.skip(!!s.service_window?.enforced && !s.service_window.open_now, "outside the service window; nothing is sent");
    }

    await page.goto("/matters");
    const contracts = page.getByRole("group", { name: "Contracts to check against" });
    await contracts.getByLabel(fx.contractId as string).click({ force: true });
    await page.getByLabel("Facts (one per line)").fill(fx.facts.join("\n"));

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/analyse-facts"), { timeout: 340_000 }),
      page.getByRole("button", { name: "Analyse" }).click(),
    ]);
    expect(resp.ok(), `analyse-facts returned ${resp.status()}`).toBeTruthy();
    const result = (await resp.json()) as AnalyseFactsResult;
    expect(checkDemoResult(result, fx)).toEqual([]);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download memo/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`analysis-memo-${result.run_id}.md`);
  });
}
