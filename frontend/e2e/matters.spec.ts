import { expect, test } from "@playwright/test";

/**
 * The matters page's CI-safe check: a real, non-mocked analyse-facts round trip through the UI, run
 * anonymously (no sign-in — the matters page is meant to work without one, Lead-2 2026-09-24). Deliberately
 * environment-tolerant on the OUTCOME: a bare `pravrudhi init` workspace (this repo's own CI recipe, see
 * README "Testing") has no Lean judge binary provisioned at all, so a real call here genuinely 503s with
 * "nyaya agent unavailable" — that is correct, honest engine behaviour on this environment, not a bug. What
 * this test actually proves is the round trip itself: a real request goes out, a real response comes back,
 * and the page renders EITHER a real judged result OR a clear, honest failure paragraph — never neither
 * (silently stuck on "Analysing…" forever would be the real bug this guards against).
 *
 * matters-live.spec.ts is the strict counterpart: same anonymous flow, but against the deployed app (which
 * does have a real judge), asserting the full happy-path response.
 */
test("a real analyse-facts round trip, run anonymously, never hangs and never renders silently", async ({ page }) => {
  await page.goto("/matters");
  await page.locator("main").getByRole("heading", { name: "Matters", exact: true }).waitFor();

  // No sign-in step here on purpose -- this call must go out without one.
  const contracts = page.getByRole("group", { name: "Contracts to check against" });
  const firstContract = contracts.getByRole("checkbox").first();
  await expect(firstContract, "the registry must offer at least one contract to check against").toBeVisible({ timeout: 15_000 });
  await firstContract.click({ force: true }); // the checkbox itself is visually hidden (sr-only); its label wraps it

  await page.getByLabel("Facts (one per line)").fill("The cheque was dishonoured on presentment for insufficient funds.");
  await page.getByLabel(/^Narrative/).fill("A real playwright e2e run, not a recorded demo.");
  await page.getByRole("button", { name: "Analyse" }).click();

  const realSummary = page.getByText(/^run .+ · score sha [0-9a-f]{64}$/);
  const honestFailure = page.getByText(/^(Could not reach|could not load|failed to)/i);
  await expect(realSummary.or(honestFailure), "the round trip must end in a real result or an honest failure, not silence").toBeVisible({
    timeout: 45_000,
  });

  // Whichever branch landed, the page must not be stuck mid-request once one of the two above appeared.
  await expect(page.getByText(/^Analysing…$/)).toHaveCount(0);
});
