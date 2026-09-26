import { expect, test } from "@playwright/test";

/**
 * The /nyaya page's citation-verification loop against the real deployed app: whatever vendors this
 * deployment currently offers, asking a question must resolve to a real verdict badge for every vendor
 * checked, and the vendor list itself must be honest about availability. Deliberately does not assume any
 * particular vendor is healthy right now (2026-09-26: every vendor this deployment offers is degraded --
 * CLI creds absent, no DashScope key, GLM weights not served, nyaya-p2b-local's host shim unreachable, see
 * issues #27/#28/#29/#30) -- `error` ("no answer") is one of the five real verdict badges the page itself
 * renders (VERDICT record, nyaya/page.tsx), not a failure of this test. What this DOES catch: a stuck
 * "Asking…" spinner, a vendor the page claims is available that the backend silently can't reach, or a
 * result that renders nothing at all.
 */

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

test.beforeAll(() => {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must both be set (see ~/.config/pravrudhi/e2e.env).");
  }
});

const VERDICT_LABELS = /^(licensed|unlicensed|invented citation|abstained|no answer)$/;

test("asking a question on /nyaya resolves to a real verdict badge, never a stuck spinner", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/signin");
  await page.getByLabel("Email", { exact: true }).fill(E2E_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });

  await page.goto("/nyaya");
  // The page has an "Ask"/"Audit" tab switcher AND an "Ask" submit button, both matched by plain role+name --
  // scope to the section holding the question textarea, the only place the real submit button lives.
  const askSection = page.locator("section").filter({ has: page.locator("textarea") });
  const askButton = askSection.getByRole("button", { name: "Ask", exact: true });
  await askButton.waitFor({ timeout: 15_000 });

  const enabledVendors = askSection.locator("label").filter({ has: page.locator("input[type=checkbox]:not([disabled])") });
  const nEnabled = await enabledVendors.count();

  if (nEnabled === 0) {
    // Honest current state: no vendor this install offers is reachable right now. The Ask button must
    // reflect that (nothing selectable to check), not silently accept a submit with zero vendors chosen.
    await expect(askButton, "with no vendor available, Ask must stay disabled").toBeDisabled();
    return;
  }

  await enabledVendors.first().locator("input[type=checkbox]").check();
  await askSection
    .locator("textarea")
    .fill("A man strikes another with a stick intending to hurt him; the victim dies of a head wound. Which sections of the IPC apply?");
  await askButton.click();

  // Real proof the request actually completed, not just "something is on screen": a verdict badge with one
  // of the five labels the page's own VERDICT record defines (nyaya/page.tsx) -- "no answer" IS a real,
  // honestly-rendered outcome here (a vendor that could not be reached), never a stuck "Asking…".
  await expect(page.getByText(VERDICT_LABELS).first(), "a real verdict badge must appear for the asked vendor").toBeVisible({
    timeout: 150_000,
  });
  await expect(page.getByText(/^Asking…$/)).toHaveCount(0);
});
