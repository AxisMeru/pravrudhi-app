import { expect, test } from "@playwright/test";

/**
 * ADR-0003: /models replaced the self-improvement loop's promotion history (a Studio/RSI concept a BYOK
 * product user has no way to produce) with the same configured/not-configured provider list /api/providers
 * already backs -- deliberately not a "Reachable" column: /api/panel/vendors' reachable_in, for every BYOK
 * provider, only checks whether a key is present, which is the same fact /api/providers' own `configured`
 * already states under a different name. Shipping that as a live health check would be dishonest; the real
 * on-demand check is filed separately (ADR-0004) rather than faked here.
 *
 * Per-row assertions only, not a whole-page empty-state check: this engine's provider-key store is shared
 * across every spec file run against it in one process (see settings-byok.spec.ts), so asserting "zero
 * providers configured anywhere" would be order-dependent on whatever ran before it.
 *
 * Run against a live engine that serves this repository's built interface:
 *   PRAVRUDHI_EDITION=product PRAVRUDHI_FRONTEND_DIR=$PWD/frontend/out pravrudhi app --root <workspace> --port 8301
 *   LOCAL_ENGINE_URL=http://127.0.0.1:8301 npx playwright test models-providers.spec.ts
 */

test.describe("/models providers view", () => {
  test("an unconfigured provider shows 'not configured' and a real add-key link to /settings", async ({ page }) => {
    await page.goto("/models");
    // Nothing in this suite ever configures "Google (Gemini)" -- if that changes, pick another provider no
    // other spec file touches, rather than resetting global state from here.
    const row = page.locator("tr", { has: page.getByText("Google (Gemini)", { exact: true }) });
    await expect(row.getByText("not configured", { exact: true })).toBeVisible();
    await row.getByRole("link", { name: "add key" }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("a provider configured on /settings shows as configured here too, with no add-key link", async ({ page }) => {
    await page.goto("/settings");
    const settingsRow = page.locator("tr", { has: page.getByText("OpenAI-compatible endpoint", { exact: true }) });
    await settingsRow.getByPlaceholder(/key/i).fill("sk-test-key-for-models-page");
    await settingsRow.getByRole("button", { name: "Save" }).click();
    await expect(settingsRow.getByText("configured", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.goto("/models");
    const row = page.locator("tr", { has: page.getByText("OpenAI-compatible endpoint", { exact: true }) });
    await expect(row.getByText("configured", { exact: true })).toBeVisible();
    await expect(row.getByRole("link", { name: "add key" })).toHaveCount(0);
  });

  test("no Studio/RSI promotion vocabulary survives on this page", async ({ page }) => {
    await page.goto("/models");
    for (const phrase of ["promoted", "Start a night", "candidate"]) {
      await expect(page.getByText(phrase, { exact: false })).toHaveCount(0);
    }
  });
});
