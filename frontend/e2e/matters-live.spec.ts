import { expect, test } from "@playwright/test";

/**
 * The matters page's strict check against the deployed app: a real analyse-facts call, run anonymously (no
 * sign-in — unlike live.spec.ts, which always signs in first), asserted on the FULL real judged response.
 * Only meaningful against a door that actually has a Lean judge provisioned (the deployed gateway containers
 * do; a bare CI-initialized local engine does not, see matters.spec.ts's own comment) — lives in the
 * live-chromium project for exactly that reason, so it only runs in the nightly/a rehearsal, never on every
 * PR against an engine that can't possibly pass it.
 *
 * Depends on the engine actually opening POST /api/v1/analyse-facts to anonymous callers (Lead-2, 2026-09-24:
 * "engine 0.5.29 opens ... without login"). Against whatever engine is deployed BEFORE that ships, this test
 * correctly fails with a 401 in the honest-failure branch below — that is real, expected behaviour for the
 * gap this test exists to close, not a flake to retry around.
 */
test("a real analyse-facts call against the deployed app, run anonymously, returns a real judged response", async ({
  page,
}) => {
  await page.goto("/matters");
  await page.locator("main").getByRole("heading", { name: "Matters", exact: true }).waitFor();

  // No sign-in step here on purpose -- this run must succeed without one.
  const contracts = page.getByRole("group", { name: "Contracts to check against" });
  const firstContract = contracts.getByRole("checkbox").first();
  await expect(firstContract, "the registry must offer at least one contract to check against").toBeVisible({ timeout: 15_000 });
  await firstContract.click({ force: true });

  await page.getByLabel("Facts (one per line)").fill("The cheque was dishonoured on presentment for insufficient funds.");
  await page.getByLabel(/^Narrative/).fill("A real playwright e2e run against the deployed app, not a recorded demo.");
  await page.getByRole("button", { name: "Analyse" }).click();

  // Real proof of a real response, not just "something rendered": a real run id and a real 64-hex score sha
  // appear verbatim in the DOM.
  const summary = page.getByText(/^run .+ · score sha [0-9a-f]{64}$/);
  await expect(summary, "a real run id and a real 64-hex score sha must appear together").toBeVisible({ timeout: 60_000 });

  // Every requested contract reached one of the real outcome values analyseFacts()'s own
  // AnalyseFactsContract["outcome"] type allows -- not a placeholder, not a blank card.
  const outcomeBadges = page.locator("article").locator("span", {
    hasText: /^(established|not established|abstained|refer to a lawyer|not yet covered)$/,
  });
  expect(await outcomeBadges.count(), "every requested contract must produce a result card with a real outcome").toBeGreaterThan(0);

  await expect(page.getByText(/^(Could not reach|could not load|failed to)/i)).toHaveCount(0);
});
