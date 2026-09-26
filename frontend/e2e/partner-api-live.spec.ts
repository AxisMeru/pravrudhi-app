import { expect, test } from "@playwright/test";

/**
 * The partner tenancy API (POST/GET /api/v1/orgs...) against the real deployed door -- no frontend page calls
 * this; it's a pure API surface for external partners, so this is a pure `request`-fixture spec, no browser.
 * Uses only the seed e2e account's own bearer token, never a real client's -- and never provisions anything:
 * every request here is expected to be refused (401/403/429), which the tenancy code itself proves before it
 * ever asks whether a key or workspace was actually provisioned. Kept small on purpose: `provision_rate_limit_
 * per_minute` defaults to 10 (partner.py), far lower than the main analyse-facts limit, so an 11-request burst
 * is enough to observe a real 429 at zero judge/GPU cost -- these calls never reach the judge at all, they are
 * refused before the admin-identity check even runs (partner.py's own `_provision_rate_limit` gate is first).
 */

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

test.beforeAll(() => {
  if (!E2E_EMAIL || !E2E_PASSWORD || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "E2E_EMAIL, E2E_PASSWORD, SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must all be set " +
        "(see ~/.config/pravrudhi/e2e.env and supabase.env).",
    );
  }
});

async function e2eBearerToken(request: import("@playwright/test").APIRequestContext): Promise<string> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_ANON_KEY!, "content-type": "application/json" },
    data: { email: E2E_EMAIL, password: E2E_PASSWORD },
  });
  expect(res.ok(), "the seed e2e account must be able to sign in via Supabase").toBeTruthy();
  const body = await res.json();
  return body.access_token as string;
}

test("no bearer token is refused, and this account (not provisioned as an admin) is refused too", async ({ request }) => {
  const noAuth = await request.get("/api/v1/orgs/e2e-test-org/keys");
  expect(noAuth.status()).toBe(401);
  expect((await noAuth.json()).detail).toMatch(/bearer token/i);

  const token = await e2eBearerToken(request);
  const withAuth = await request.get("/api/v1/orgs/e2e-test-org/keys", { headers: { Authorization: `Bearer ${token}` } });
  expect(withAuth.status(), "the seed e2e account is deliberately never provisioned as a tenancy admin").toBe(403);
  expect((await withAuth.json()).detail).toMatch(/allowlisted admin identity|provisioning secret/i);
});

test("a small provisioning-endpoint burst gets a real 429 with Retry-After, at zero judge cost", async ({ request }) => {
  const token = await e2eBearerToken(request);
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) {
    const res = await request.get(`/api/v1/orgs/e2e-burst-${i}/keys`, { headers: { Authorization: `Bearer ${token}` } });
    statuses.push(res.status());
    if (res.status() === 429) {
      expect(res.headers()["retry-after"], "a 429 must carry Retry-After so a real client knows when to retry").toBeTruthy();
      expect((await res.json()).detail).toMatch(/rate limit/i);
      return;
    }
  }
  throw new Error(`expected a 429 within 11 requests (provision_rate_limit_per_minute defaults to 10); got ${statuses.join(", ")}`);
});
