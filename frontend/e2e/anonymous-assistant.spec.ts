import { expect, test } from "./support/engineTest";

// P0 (Lead-2, 14 Oct): an ANONYMOUS visitor on a build whose engine reports the assistant tier "available" must not be bounced to /signin. The consent line's provider
// name (GET /api/assistant) is a signed-in-only read; a 401 on it used to hit the global sign-in redirect (api.ts toSignIn) and end /screening on the sign-in page.
// Needs a build with NEXT_PUBLIC_SUPABASE_URL set (the redirect only exists on the hosted build); both assistant flag arms are the same test.
const health = { ok: true, version: "0.6.8", kernel: "0.6.8", ledger: true, assistant_tier: { state: "available", reason: null } };

test("an anonymous visitor with the assistant tier available stays on /screening: a 401 on /api/assistant does not redirect to sign-in", async ({ page }) => {
  const hits = { assistant: 0 };
  await page.route("**/api/me", (r) => r.fulfill({ status: 401, json: { error: "not signed in" } }));
  await page.route("**/api/health", (r) => r.fulfill({ json: health }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/assistant", (r) => {
    hits.assistant += 1;
    return r.fulfill({ status: 401, json: { error: "not signed in" } });
  });
  await page.goto("/screening");
  await expect(page.getByLabel("Paste the FIR, complaint or narrative")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname).toMatch(/^\/screening\/?$/);
  expect(hits.assistant, "the provider read is for signed-in visitors only").toBe(0);
});

test("a signed-in visitor still gets the provider name read", async ({ page }) => {
  const hits = { assistant: 0 };
  await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } }));
  await page.route("**/api/health", (r) => r.fulfill({ json: health }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/assistant", (r) => {
    hits.assistant += 1;
    return r.fulfill({ json: { provider: "Anthropic", call_timeout_s: 60, session_budget_usd: 0.25, consent_required: true, assistant_tier: { state: "available", reason: null } } });
  });
  await page.goto("/screening");
  await expect.poll(() => hits.assistant, { timeout: 5000 }).toBeGreaterThan(0);
});
