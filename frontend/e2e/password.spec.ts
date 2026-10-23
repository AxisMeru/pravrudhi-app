import { expect, test } from "@playwright/test";

// app d65: set, change and recover a password. R1's words (#555). Needs the build with a Supabase URL (CI's placeholder). The Supabase endpoints are mocked; no password here is a real one.
const USER = { id: "00000000-0000-4000-8000-000000000001", email: "someone@example.invalid" };
const PW = "a-test-password-1";
const SENT = "If this address has an account, a link to set a new password is on its way.";
const FAILED = "Could not send the link. Try again later.";
const EXPIRED = "This link has expired. On the sign-in page choose \"Forgot password?\" for a new one, or ask your administrator.";
const REAUTH = "To change your password, sign out, sign in again, then try again.";

async function needsSupabase(page: import("@playwright/test").Page) {
  test.skip(await page.getByText("Sign-in is not configured").count() > 0, "needs the build with a Supabase URL");
}
async function arrive(page: import("@playwright/test").Page, type: string) {
  await page.route("**/auth/v1/user", (r) => (r.request().method() === "GET" ? r.fulfill({ json: USER }) : r.fallback()));
  await page.goto(`/signin#access_token=tok-arrival&refresh_token=ref-arrival&expires_in=3600&type=${type}`);
}

test("Forgot password: an empty email shows R1's line and sends nothing", async ({ page }) => {
  let sent = 0;
  await page.route("**/auth/v1/recover**", (r) => { sent += 1; return r.fulfill({ json: {} }); });
  await page.goto("/signin");
  await needsSupabase(page);
  await page.getByTestId("forgot-password").click();
  await expect(page.getByText("Enter your email first, then ask for the link.")).toBeVisible();
  expect(sent).toBe(0);
});

test("Forgot password: the SAME line for an address with an account and for one without; redirect_to is /signin; only the email is sent", async ({ page }) => {
  const seen: Array<{ url: string; body: string }> = [];
  let answer: { status: number; json: unknown } = { status: 200, json: {} };
  await page.route("**/auth/v1/recover**", (r) => { seen.push({ url: r.request().url(), body: r.request().postData() ?? "" }); return r.fulfill(answer); });
  await page.goto("/signin");
  await needsSupabase(page);
  for (const a of [{ status: 200, json: {} }, { status: 404, json: { msg: "User not found" } }, { status: 422, json: { msg: "Unable to validate email address" } }]) {
    answer = a;
    await page.reload();
    await page.getByLabel("Email").fill("someone@example.invalid");
    await page.getByTestId("forgot-password").click();
    await expect(page.getByText(SENT)).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/not found|Unable to validate/i);
  }
  expect(seen.length).toBe(3);
  for (const s of seen) {
    expect(new URL(s.url).searchParams.get("redirect_to")).toMatch(/\/signin$/);
    expect(JSON.parse(s.body)).toEqual({ email: "someone@example.invalid" });
  }
});

test("Forgot password: a rate limit or a server error is the one failure line, never the provider's words", async ({ page }) => {
  await page.goto("/signin");
  await needsSupabase(page);
  for (const status of [429, 500]) {
    await page.route("**/auth/v1/recover**", (r) => r.fulfill({ status, json: { msg: "email rate limit exceeded" } }));
    await page.reload();
    await page.getByLabel("Email").fill("someone@example.invalid");
    await page.getByTestId("forgot-password").click();
    await expect(page.getByText(FAILED)).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/rate limit exceeded/i);
    await page.unroute("**/auth/v1/recover**");
  }
});

for (const type of ["invite", "recovery"]) {
  test(`a ${type} link asks for a password: the checks, one PUT with the password in the body only, the fragment removed, then home`, async ({ page }) => {
    const puts: Array<{ url: string; body: string; auth: string }> = [];
    await page.route("**/auth/v1/user", (r) => {
      if (r.request().method() !== "PUT") return r.fallback();
      puts.push({ url: r.request().url(), body: r.request().postData() ?? "", auth: r.request().headers().authorization ?? "" });
      return r.fulfill({ json: USER });
    });
    await arrive(page, type);
    await needsSupabase(page);
    await expect(page.getByRole("heading", { name: "Set your password", level: 1 })).toBeVisible();
    await expect(page.getByText("Choose a password for your account. You will use it with your email to sign in.")).toBeVisible();
    await expect(page.getByText("At least 8 characters.")).toBeVisible();
    expect(page.url()).not.toContain("access_token");
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Confirm new password").fill("short");
    await page.getByRole("button", { name: "Set password" }).click();
    await expect(page.getByTestId("password-error")).toHaveText("Use at least 8 characters.");
    await page.getByLabel("New password", { exact: true }).fill(PW);
    await page.getByLabel("Confirm new password").fill(PW + "x");
    await page.getByRole("button", { name: "Set password" }).click();
    await expect(page.getByTestId("password-error")).toHaveText("The two passwords do not match.");
    expect(puts).toHaveLength(0);
    await page.getByLabel("Confirm new password").fill(PW);
    await page.getByRole("button", { name: "Set password" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0]!.body)).toEqual({ password: PW });
    expect(puts[0]!.url).not.toContain(PW);
    expect(puts[0]!.auth).toBe("Bearer tok-arrival");
    expect(page.url()).not.toContain(PW);
  });
}

test("a magic-link arrival goes straight home: no password form", async ({ page }) => {
  await arrive(page, "magiclink");
  await needsSupabase(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("set-password")).toHaveCount(0);
});

test("setting a password with a link whose session is gone shows R1's next step; the other refusals have their own lines", async ({ page }) => {
  let answer: { status: number; json: unknown } = { status: 401, json: { msg: "invalid JWT" } };
  await page.route("**/auth/v1/user", (r) => (r.request().method() === "PUT" ? r.fulfill(answer) : r.fulfill({ json: USER })));
  await page.goto(`/signin#access_token=tok-arrival&type=invite`);
  await needsSupabase(page);
  const cases: Array<[number, unknown, string]> = [
    [401, { msg: "invalid JWT" }, EXPIRED],
    [422, { error_code: "same_password", msg: "New password should be different" }, "Choose a password you have not used before."],
    [422, { error_code: "weak_password", msg: "Password is known to be weak" }, "Choose a password that is harder to guess."],
    [500, {}, "Could not set the password. Try again."],
  ];
  for (const [status, json, line] of cases) {
    answer = { status, json };
    await page.getByLabel("New password", { exact: true }).fill(PW);
    await page.getByLabel("Confirm new password").fill(PW);
    await page.getByRole("button", { name: "Set password" }).click();
    await expect(page.getByTestId("password-error")).toHaveText(line);
    expect(await page.locator("body").innerText()).not.toMatch(/invalid JWT|known to be weak|should be different/i);
  }
});

test.describe("Settings", () => {
  test("signed out: no Change password section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
    await expect(page.getByTestId("change-password")).toHaveCount(0);
  });

  test("signed in: Change password sends one PUT with the password in the body only, says R1's line; a fresh sign-in request has its own line", async ({ page }) => {
    await page.addInitScript((u) => localStorage.setItem("pravrudhi-auth-session", JSON.stringify({ accessToken: "tok-settings", user: u, expiresAt: Math.floor(Date.now() / 1000) + 3000 })), USER);
    const puts: Array<{ url: string; body: string; auth: string }> = [];
    let reauth = false;
    await page.route("**/auth/v1/user", (r) => {
      if (r.request().method() !== "PUT") return r.fulfill({ json: USER });
      puts.push({ url: r.request().url(), body: r.request().postData() ?? "", auth: r.request().headers().authorization ?? "" });
      return reauth ? r.fulfill({ status: 400, json: { error_code: "reauthentication_needed", msg: "Password update requires reauthentication" } }) : r.fulfill({ json: USER });
    });
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill(PW);
    await page.getByLabel("Confirm new password").fill(PW);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByTestId("password-changed")).toHaveText("Your password has been changed.");
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0]!.body)).toEqual({ password: PW });
    expect(puts[0]!.url).not.toContain(PW);
    expect(puts[0]!.auth).toBe("Bearer tok-settings");
    expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).not.toContain(PW);
    reauth = true;
    await page.getByLabel("New password", { exact: true }).fill(PW + "2");
    await page.getByLabel("Confirm new password").fill(PW + "2");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByTestId("password-error")).toHaveText(REAUTH);
  });
});
