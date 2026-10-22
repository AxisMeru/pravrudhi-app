import { expect, test } from "./support/engineTest";
import { HOME_COPY as C, HOME_FILMS } from "../src/lib/productHome/copy";

// app#539: the product Home at "/" against mocked engine answers. Invented data only.
const M1 = "0123456789abcdef0123456789abcdef", M2 = "fedcba9876543210fedcba9876543210";
const status = (judges?: { first: string; second: string }) => ({ engine_version: "0.6.32", service_window: { timezone: "Europe/London", open: "00:00", close: "23:59", enforced: false, open_now: true, next_open_utc: "2026-10-22T15:00:00+00:00" }, judge: { state: "unknown", checked_at: null }, workflows: {}, ...(judges ? { judges } : {}) });

async function asMember(page: import("@playwright/test").Page, access: "member" | "admin", judges?: { first: string; second: string }, matters: { matter_id: string; papers: number }[] = [{ matter_id: M1, papers: 3 }, { matter_id: M2, papers: 0 }]) {
  await page.addInitScript(() => { localStorage.setItem("pravrudhi-auth-session", JSON.stringify({ accessToken: "invented-token", user: { id: "00000000-0000-4000-8000-000000000001", email: "someone@example.com" }, expiresAt: 4102444800 })); });
  await page.route("**/api/me", (r) => r.fulfill({ json: { mode: "required", authenticated: true, id: "00000000-0000-4000-8000-000000000001", role: "authenticated", access, edition: "Pravrudhi", tagline: "x" } }));
  await page.route("**/api/v1/status", (r) => r.fulfill({ json: status(judges) }));
  await page.route("**/api/v1/matter-spans/my-matters", (r) => r.fulfill({ json: { matters: matters, truncated: false } }));
}

test("signed out: '/' is the landing (no redirect), with Sign in, the no-new-accounts line, three films, the main links and one standing line", async ({ page }) => {
  await page.route("**/api/me", (r) => r.fulfill({ status: 401, json: { detail: "unauthorized" } }));
  await page.goto("/");
  await expect(page.getByTestId("home-landing")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("home-signin")).toHaveAttribute("href", /\/signin\/?$/);
  await expect(page.getByTestId("home-no-new-accounts")).toHaveText(C.noNewAccounts);
  await expect(page.getByTestId("home-films").locator("li")).toHaveCount(3);
  for (const f of HOME_FILMS) await expect(page.getByTestId("home-films")).toContainText(`${f.title}`);
  await expect(page.getByTestId("home-read-more").locator("li")).toHaveCount(4);
  await expect(page.getByText(C.standing)).toBeVisible();
  await expect(page.getByTestId("home-workspace")).toHaveCount(0);
});

test("signed in (member): Start a screening only opens the Screening page; models parked says 'switched off at the moment'; five most recent matters with an Open link; three workflows; quick links; no Invite people", async ({ page }) => {
  await asMember(page, "member", { first: "parked", second: "parked" });
  let wakes = 0;
  await page.route("**/api/v1/analyse-facts/wake**", (r) => { wakes++; return r.fulfill({ status: 503, json: { error: "judges_offline", wake: "not_allowed" } }); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: C.workspaceHeading, exact: true })).toBeVisible();
  await expect(page.getByTestId("home-models")).toHaveText(C.modelsOff);
  await expect(page.getByTestId("home-matter-row")).toHaveCount(2);
  await expect(page.getByTestId("home-matter-row").first()).toContainText("Matter 1 · 3 papers");
  await expect(page.getByTestId("home-workflows").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("home-quick").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("home-invite")).toHaveCount(0);
  await expect(page.getByTestId("home-start")).toHaveAttribute("href", /\/screening\/?$/);
  expect(wakes).toBe(0);
});

test("signed in (admin): Invite people opens Access; the models line reads ready / starting from the status; an absent judges field shows no line; more than five matters show five", async ({ page }) => {
  await asMember(page, "admin", { first: "ready", second: "ready" }, Array.from({ length: 7 }, (_, i) => ({ matter_id: (i + 10).toString(16).padStart(32, "a"), papers: i })));
  await page.goto("/");
  await expect(page.getByTestId("home-invite").getByRole("link", { name: C.invitePeople })).toHaveAttribute("href", /\/admin\/access\/?$/);
  await expect(page.getByTestId("home-models")).toHaveText(C.modelsReady);
  await expect(page.getByTestId("home-matter-row")).toHaveCount(5);
  await page.unroute("**/api/v1/status");
  await page.route("**/api/v1/status", (r) => r.fulfill({ json: status() }));
  await page.reload();
  await expect(page.getByTestId("home-start")).toBeVisible();
  await expect(page.getByTestId("home-models")).toHaveCount(0);
});

test("the Home still renders when the engine answers neither status nor matters (plain words, no spinner forever)", async ({ page }) => {
  await asMember(page, "member");
  await page.unroute("**/api/v1/status");
  await page.route("**/api/v1/status", (r) => r.fulfill({ status: 500, json: { error: "x" } }));
  await page.unroute("**/api/v1/matter-spans/my-matters");
  await page.route("**/api/v1/matter-spans/my-matters", (r) => r.fulfill({ status: 500, json: { error: "x" } }));
  await page.goto("/");
  await expect(page.getByTestId("home-models")).toHaveText(C.modelsUnavailable);
  await expect(page.getByText(C.mattersUnavailable)).toBeVisible();
  await expect(page.getByTestId("home-start")).toBeVisible();
});

test("Home is the first item of the nav and the brand links to it, on every page; Studio-only nothing changes here", async ({ page }) => {
  await asMember(page, "member", { first: "parked", second: "parked" });
  await page.goto("/guide");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link").first()).toHaveText(C.navLabel);
  await expect(nav.getByTestId("nav-home")).toHaveAttribute("href", /\/$/);
  await expect(page.getByTestId("brand-home-link")).toHaveAttribute("href", /\/$/);
  await nav.getByTestId("nav-home").click();
  await expect(page.getByTestId("home-workspace")).toBeVisible();
  await expect(nav.getByTestId("nav-home")).toHaveAttribute("aria-current", "page");
});
