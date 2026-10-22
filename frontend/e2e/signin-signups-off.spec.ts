import { expect, test } from "@playwright/test";

// /signin with new sign-ups OFF (app#523; R1's words). Needs the build with a Supabase URL (CI's placeholder): without it the page says sign-in is not configured.
const NEW = "New accounts cannot be created on this page. To get an account, ask your administrator.";
const SENT = "If this address has an account, a sign-in link is on its way. Open it on this device to continue.";

test.beforeEach(async ({ page }) => { await page.goto("/signin"); });

test("one mode: sign in; the sign-up toggle and its words are gone; the two sentences stand in its place", async ({ page }) => {
  test.skip(await page.getByText("Sign-in is not configured").count() > 0, "needs the build with a Supabase URL");
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  await expect(page.getByText("Enter your email and password to continue.")).toBeVisible();
  await expect(page.getByTestId("signin-no-new-accounts")).toHaveText(NEW);
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/Create an account|Create account|Creating account|Sign up|sign-up|Don't have an account|Already have an account/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in link instead" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
});

test("the sign-in link says the same neutral line for an address with an account and for one without (the provider's refusal is never shown)", async ({ page }) => {
  test.skip(await page.getByText("Sign-in is not configured").count() > 0, "needs the build with a Supabase URL");
  const body: string[] = [];
  let answer: { status: number; json: unknown } = { status: 200, json: {} };
  await page.route("**/auth/v1/otp**", (r) => { body.push(r.request().postData() ?? ""); return r.fulfill(answer); });
  for (const [a, addr] of [[{ status: 200, json: {} }, "has-account@example.invalid"], [{ status: 422, json: { error_description: "Signups not allowed for otp", msg: "Signups not allowed for otp" } }, "no-account@example.invalid"]] as const) {
    answer = a;
    await page.reload();
    await page.getByLabel("Email").fill(addr);
    await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
    await expect(page.getByText(SENT)).toBeVisible();
    const t = await page.locator("body").innerText();
    expect(t).not.toMatch(/Signups not allowed|not allowed for otp/i);
    expect(t).not.toContain(addr);
  }
  expect(body.every((b) => JSON.parse(b).create_user === false)).toBe(true);
});

test("a rate limit shows our own error, never the provider's words; an empty email shows R1's line", async ({ page }) => {
  test.skip(await page.getByText("Sign-in is not configured").count() > 0, "needs the build with a Supabase URL");
  await page.route("**/auth/v1/otp**", (r) => r.fulfill({ status: 429, json: { msg: "email rate limit exceeded" } }));
  await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
  await expect(page.getByText("Enter your email first, then ask for the link.")).toBeVisible();
  await page.getByLabel("Email").fill("someone@example.invalid");
  await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
  await expect(page.getByText("Could not send the link")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/rate limit exceeded/i);
});
