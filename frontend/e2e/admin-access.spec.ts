import { expect, test } from "./support/engineTest";
import { ACCESS_COPY, ERROR_COPY, ERROR_GENERIC } from "../src/lib/adminAccess/copy";

// app#520 minimal, against MOCKED routes: the Edge Function admin-invite (invite and resend by email). Every address is invented.
const ME = "11111111-1111-4111-8111-111111111111";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pravrudhi-auth-session", JSON.stringify({ accessToken: "invented-token", user: { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com" }, expiresAt: 4102444800 }));
  });
});

async function asAccess(page: import("@playwright/test").Page, access: string) {
  await page.route("**/api/me", (r) => r.fulfill({ json: { mode: "required", authenticated: true, id: ME, role: "authenticated", access, edition: "Pravrudhi", tagline: "x" } }));
}

test("admin: the invite box with Send invitation and Send again; no list, no block, no delete, no model switch", async ({ page }) => {
  await asAccess(page, "admin");
  await page.goto("/admin/access");
  await expect(page.getByRole("heading", { name: ACCESS_COPY.heading, exact: true })).toBeVisible();
  await expect(page.getByTestId("access-invite")).toBeVisible();
  await expect(page.getByTestId("access-invite-send")).toHaveText(ACCESS_COPY.inviteButton);
  await expect(page.getByTestId("access-resend")).toHaveText(ACCESS_COPY.resendButton);
  const text = (await page.locator("main").innerText()).toLowerCase();
  expect(text).not.toMatch(/\bblock|\bdelete|toggle|start the models/);
  await expect(page.getByTestId("access-account")).toHaveCount(0);
});

test("a bad address is refused before any call; a good one is lowercased and sent with the admin's own token and the publishable key", async ({ page }) => {
  await asAccess(page, "admin");
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
  await page.getByTestId("access-resend").click();
  await expect(page.getByTestId("access-email-error")).toHaveText(ERROR_COPY.invalid_email);
  expect(sent).toHaveLength(0);
  await page.getByLabel(ACCESS_COPY.inviteLabel).fill("  New.Person@Example.COM ");
  await page.getByTestId("access-invite-send").click();
  await expect(page.getByTestId("access-note")).toHaveText(ACCESS_COPY.invitedOk);
  expect(sent).toHaveLength(1);
  expect(JSON.parse(sent[0]!.body)).toEqual({ action: "invite", email: "new.person@example.com" });
  expect(sent[0]!.auth).toBe("Bearer invented-token");
  expect(sent[0]!.apikey).toBeTruthy();
  await expect(page.getByLabel(ACCESS_COPY.inviteLabel)).toHaveValue("");
});

test("Send again sends the resend action with the address, not an id", async ({ page }) => {
  await asAccess(page, "admin");
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/functions/v1/admin-invite", async (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}")); await r.fulfill({ json: { ok: true } }); });
  await page.goto("/admin/access");
  await page.getByLabel(ACCESS_COPY.inviteLabel).fill("again@example.com");
  await page.getByTestId("access-resend").click();
  await expect(page.getByTestId("access-note")).toHaveText(ACCESS_COPY.resentOk);
  expect(bodies).toEqual([{ action: "resend", email: "again@example.com" }]);
});

test("a user who is not an administrator sees only 'for administrators', and nothing is called", async ({ page }) => {
  await asAccess(page, "member");
  let called = 0;
  await page.route("**/functions/v1/admin-invite", (r) => { called++; return r.fulfill({ json: { ok: true } }); });
  await page.goto("/admin/access");
  await expect(page.getByTestId("access-not-admin")).toHaveText(ACCESS_COPY.notAdmin);
  await expect(page.getByTestId("access-invite")).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(called).toBe(0);
});

const CODES: [string, number][] = [["unauthorized", 401], ["forbidden", 403], ["invalid_email", 422], ["rate_limited", 429], ["invite_rate_limited", 429], ["already_registered", 409], ["invalid_request", 422], ["too_large", 413], ["method_not_allowed", 405], ["upstream_unavailable", 502], ["audit_unavailable", 503], ["not_configured", 503], ["invite_redirect_not_allowed", 502], ["something_new", 500]];
for (const [code, status] of CODES) {
  test(`error code ${code} (${status}) shows one fixed message, never the upstream text or the address`, async ({ page }) => {
    await asAccess(page, "admin");
    await page.route("**/functions/v1/admin-invite", (r) => r.fulfill({ status, json: { ok: false, code, message: "UPSTREAM-TEXT person@example.com" } }));
    await page.goto("/admin/access");
    await page.getByLabel(ACCESS_COPY.inviteLabel).fill("someone@example.com");
    await page.getByTestId("access-invite-send").click();
    await expect(page.getByTestId("access-note")).toHaveText(ERROR_COPY[code] ?? ERROR_GENERIC);
    await expect(page.getByTestId("access-note")).not.toContainText("UPSTREAM-TEXT");
  });
}

test("nothing writes an address to the console", async ({ page }) => {
  await asAccess(page, "admin");
  const logs: string[] = [];
  page.on("console", (m) => logs.push(m.text()));
  await page.route("**/functions/v1/admin-invite", (r) => r.fulfill({ json: { ok: true } }));
  await page.goto("/admin/access");
  await page.getByLabel(ACCESS_COPY.inviteLabel).fill("someone@example.com");
  await page.getByTestId("access-invite-send").click();
  await expect(page.getByTestId("access-note")).toBeVisible();
  expect(logs.join("\n")).not.toMatch(/@example\.invalid/);
});
