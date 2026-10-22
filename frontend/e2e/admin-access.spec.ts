import { expect, test } from "./support/engineTest";
import { ACCESS_COPY, ERROR_COPY, ERROR_GENERIC } from "../src/lib/adminAccess/copy";

// app#520, against MOCKED routes (Track B's contract v1.1 81a69344a916): the engine list route and the Edge Function. Every address and id is invented.
const ME = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const B = "33333333-3333-4333-8333-333333333333";
const list = (policy: "any_signed_in" | "allowlist") => ({
  wake_policy: policy, allowlist_size: policy === "allowlist" ? 3 : null, limit: 50, offset: 0, returned: 3, next_offset: null,
  accounts: [
    { id: ME, email: "admin@example.invalid", created_at: "2026-09-01T09:00:00Z", last_sign_in_at: "2026-10-22T13:00:00Z", banned_until: null, blocked: false, role: "admin", invite_state: "accepted" },
    { id: P, email: "pending@example.invalid", created_at: "2026-10-20T09:00:00Z", last_sign_in_at: null, banned_until: null, blocked: false, role: "member", invite_state: "pending" },
    { id: B, email: "gone@example.invalid", created_at: "2026-10-01T09:00:00Z", last_sign_in_at: "2026-10-05T09:00:00Z", banned_until: "2125-01-01T00:00:00Z", blocked: true, role: "member", invite_state: "accepted" },
  ],
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pravrudhi-auth-session", JSON.stringify({ accessToken: "invented-token", user: { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.invalid" }, expiresAt: 4102444800 }));
  });
});

async function setup(page: import("@playwright/test").Page, opts: { access?: string; policy?: "any_signed_in" | "allowlist"; listRoute?: (r: import("@playwright/test").Route) => unknown } = {}) {
  const calls: { body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  let listCalls = 0;
  await page.route("**/api/me", (r) => r.fulfill({ json: { mode: "required", authenticated: true, id: ME, role: "authenticated", access: opts.access ?? "admin", edition: "Pravrudhi", tagline: "x" } }));
  await page.route("**/api/v1/admin/access**", (r) => { listCalls++; return opts.listRoute ? opts.listRoute(r) : r.fulfill({ json: list(opts.policy ?? "any_signed_in") }); });
  return { calls, listCalls: () => listCalls };
}

test("admin with policy any_signed_in: the list, badges, and the invite, resend and block controls; no model-start switch and no delete", async ({ page }) => {
  await setup(page);
  await page.goto("/admin/access");
  await expect(page.getByRole("heading", { name: ACCESS_COPY.heading, exact: true })).toBeVisible();
  await expect(page.getByTestId("access-policy")).toHaveText(ACCESS_COPY.policyAnySignedIn);
  await expect(page.getByTestId("access-account")).toHaveCount(3);
  await expect(page.getByTestId("access-pending-badge")).toHaveCount(1);
  await expect(page.getByTestId("access-blocked-badge")).toHaveCount(1);
  await expect(page.getByTestId("access-invite")).toBeVisible();
  await expect(page.getByTestId("access-resend")).toHaveCount(1); // the pending, not blocked account only
  await expect(page.getByTestId("access-block")).toHaveCount(1); // not the admin, not the blocked account
  const text = (await page.locator("main").innerText()).toLowerCase();
  expect(text).not.toMatch(/\bdelete\b|un-?block|start the models for|toggle/);
});

test("invite: a bad address is refused before any call; a good one is lowercased and sent with the admin's own token and the publishable key; the list is read again", async ({ page }) => {
  await setup(page);
  const sent: { body: string; auth: string | undefined; apikey: string | undefined }[] = [];
  await page.route("**/functions/v1/admin-invite", async (r) => {
    const q = r.request();
    sent.push({ body: q.postData() ?? "", auth: q.headers()["authorization"], apikey: q.headers()["apikey"] });
    await r.fulfill({ json: { ok: true } });
  });
  await page.goto("/admin/access");
  await page.getByLabel(ACCESS_COPY.inviteLabel).fill("not an address");
  await page.getByTestId("access-invite-send").click();
  await expect(page.getByTestId("access-email-error")).toHaveText(ERROR_COPY.invalid_email);
  expect(sent).toHaveLength(0);
  await page.getByLabel(ACCESS_COPY.inviteLabel).fill("  New.Person@Example.INVALID ");
  await page.getByTestId("access-invite-send").click();
  await expect(page.getByTestId("access-note")).toHaveText(ACCESS_COPY.invitedOk);
  expect(sent).toHaveLength(1);
  expect(JSON.parse(sent[0]!.body)).toEqual({ action: "invite", email: "new.person@example.invalid" });
  expect(sent[0]!.auth).toBe("Bearer invented-token");
  expect(sent[0]!.apikey).toBeTruthy();
  await expect(page.getByLabel(ACCESS_COPY.inviteLabel)).toHaveValue("");
});

test("resend sends the user id only; block asks first (the 1-hour sentence), Cancel does nothing, Confirm sends the ban", async ({ page }) => {
  await setup(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/functions/v1/admin-invite", async (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}")); await r.fulfill({ json: { ok: true } }); });
  await page.goto("/admin/access");
  await page.getByTestId("access-resend").click();
  await expect(page.getByTestId("access-note")).toHaveText(ACCESS_COPY.resentOk);
  expect(bodies).toEqual([{ action: "resend", user_id: P }]);
  await page.getByTestId("access-block").click();
  await expect(page.getByTestId("access-block-explain")).toContainText("up to 1 hour");
  await page.getByRole("button", { name: ACCESS_COPY.blockCancel }).click();
  await expect(page.getByTestId("access-block-confirm")).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  await page.getByTestId("access-block").click();
  await page.getByTestId("access-block-confirm").click();
  await expect(page.getByTestId("access-note")).toHaveText(ACCESS_COPY.blockedOk);
  expect(bodies[1]).toEqual({ action: "ban", user_id: P });
});

test("policy allowlist: the invite form and the resend control are hidden, the banner says only listed accounts can start the models", async ({ page }) => {
  await setup(page, { policy: "allowlist" });
  await page.goto("/admin/access");
  await expect(page.getByTestId("access-policy")).toHaveText(ACCESS_COPY.policyAllowlist);
  await expect(page.getByTestId("access-account")).toHaveCount(3);
  await expect(page.getByTestId("access-invite")).toHaveCount(0);
  await expect(page.getByTestId("access-resend")).toHaveCount(0);
});

test("a member sees only 'for administrators' and the list route is never called", async ({ page }) => {
  const s = await setup(page, { access: "member" });
  await page.goto("/admin/access");
  await expect(page.getByTestId("access-not-admin")).toHaveText(ACCESS_COPY.notAdmin);
  await page.waitForTimeout(500);
  expect(s.listCalls()).toBe(0);
});

test("feature off: a 404, or a 200 text/html answer (the SPA fallback, contract v1.1), shows nothing and the HTML is never parsed", async ({ page }) => {
  await setup(page, { listRoute: (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<!DOCTYPE html><html><body>app</body></html>" }) });
  await page.goto("/admin/access");
  await expect(page.getByTestId("access-page")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: ACCESS_COPY.heading, exact: true })).toHaveCount(0);
  await page.unroute("**/api/v1/admin/access**");
  await page.route("**/api/v1/admin/access**", (r) => r.fulfill({ status: 404, json: { detail: "Not Found" } }));
  await page.reload();
  await expect(page.getByTestId("access-page")).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(page.getByRole("heading", { name: ACCESS_COPY.heading, exact: true })).toHaveCount(0);
});

test("a failed list read says so and offers a retry (503 upstream_unavailable)", async ({ page }) => {
  await setup(page, { listRoute: (r) => r.fulfill({ status: 503, json: { code: "upstream_unavailable" } }) });
  await page.goto("/admin/access");
  await expect(page.getByTestId("access-load-error")).toContainText(ACCESS_COPY.loadError);
  await expect(page.getByRole("button", { name: ACCESS_COPY.retry })).toBeVisible();
});

const CODES: [string, number][] = [["unauthorized", 401], ["forbidden", 403], ["invalid_email", 422], ["rate_limited", 429], ["invite_rate_limited", 429], ["already_registered", 409], ["already_accepted", 409], ["account_banned", 409], ["upstream_unavailable", 502], ["audit_unavailable", 503], ["not_configured", 503], ["invite_redirect_not_allowed", 502], ["something_new", 500]];
for (const [code, status] of CODES) {
  test(`error code ${code} (${status}) shows one fixed message, never the upstream text or the address`, async ({ page }) => {
    await setup(page);
    await page.route("**/functions/v1/admin-invite", (r) => r.fulfill({ status, json: { ok: false, code, message: "UPSTREAM-TEXT person@example.invalid" } }));
    await page.goto("/admin/access");
    await page.getByLabel(ACCESS_COPY.inviteLabel).fill("someone@example.invalid");
    await page.getByTestId("access-invite-send").click();
    await expect(page.getByTestId("access-note")).toHaveText(ERROR_COPY[code] ?? ERROR_GENERIC);
    await expect(page.getByTestId("access-note")).not.toContainText("UPSTREAM-TEXT");
  });
}

test("nothing writes an address to the console", async ({ page }) => {
  await setup(page);
  const logs: string[] = [];
  page.on("console", (m) => logs.push(m.text()));
  await page.route("**/functions/v1/admin-invite", (r) => r.fulfill({ json: { ok: true } }));
  await page.goto("/admin/access");
  await page.getByLabel(ACCESS_COPY.inviteLabel).fill("someone@example.invalid");
  await page.getByTestId("access-invite-send").click();
  await expect(page.getByTestId("access-note")).toBeVisible();
  expect(logs.join("\n")).not.toMatch(/@example\.invalid/);
});
