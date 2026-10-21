import { expect, test } from "@playwright/test";

// R1 (D50B_LIVE_RENDER db7f6b1e611f): /matter-tools must not show the signed-in buttons (Start a matter, Load a sample matter, the sample note) in the server-rendered HTML or the first paint
// and then take them away from a signed-out visitor; and it shows no sign-in line either until the identity check has come back. Nothing here is a new string.
const HEX = "0123456789abcdef0123456789abcdef";
const NOT_YET = ["pv-start", "pv-sample", "pv-sample-note", "pv-signed-out", "pv-signed-out-sample", "pv-session-unverified"];

test("/matter-tools: the HTML a visitor gets before any script runs carries no Start a matter, no sample button or note and no sign-in line", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await ctx.newPage();
  await page.goto("/matter-tools");
  for (const id of NOT_YET) await expect(page.getByTestId(id), id).toHaveCount(0);
  await ctx.close();
});

test("/matter-tools: while the identity check is still out nothing is offered; signed in, the buttons appear when it comes back", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await page.route("**/api/me", async (r) => { await gate; await r.fulfill({ json: { email: "invented@example.invalid" } }); });
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.goto("/matter-tools");
  await expect(page.getByTestId("matter-tools-page")).toBeVisible();
  for (const id of NOT_YET) await expect(page.getByTestId(id), `${id} before the check`).toHaveCount(0);
  release();
  await expect(page.getByTestId("pv-start")).toBeVisible();
  await expect(page.getByTestId("pv-sample")).toBeVisible();
  await expect(page.getByTestId("pv-sample-note")).toBeVisible();
  await expect(page.getByTestId("pv-signed-out")).toHaveCount(0);
});

test("/matter-tools: signed out, the sign-in lines appear only after the check and no signed-in button ever appears", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await page.route("**/api/me", async (r) => { await gate; await r.fulfill({ status: 401, json: { detail: "no session" } }); });
  const shown: string[] = [];
  await page.exposeFunction("seen", (id: string) => { shown.push(id); });
  await page.addInitScript(() => {
    const check = () => { for (const id of ["pv-start", "pv-sample", "pv-sample-note"]) if (document.querySelector(`[data-testid="${id}"]`)) (window as unknown as { seen: (i: string) => void }).seen(id); };
    new MutationObserver(check).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/matter-tools");
  await expect(page.getByTestId("pv-signed-out")).toHaveCount(0);
  release();
  await expect(page.getByTestId("pv-signed-out")).toBeVisible();
  await expect(page.getByTestId("pv-signed-out-sample")).toBeVisible();
  await expect(page.getByTestId("pv-start")).toHaveCount(0);
  expect(shown, "no signed-in button was in the page at any moment").toEqual([]);
});

// R1 on #499 (final ruling): if the identity check fails or never returns (timeout, 5xx, 403, drop), the page offers NOTHING and shows ONE neutral line; never the signed-out line (it can be false for someone signed in),
// never the signed-in actions, and the area is not left empty with no end.
for (const how of ["a 500", "a 403", "a dropped connection", "no answer (timeout)"] as const) {
  test(`/matter-tools: ${how} on the identity check shows the one neutral line and nothing else`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.route("**/api/me", async (r) => {
      if (how === "a 500") return r.fulfill({ status: 500, json: { detail: "boom" } });
      if (how === "a 403") return r.fulfill({ status: 403, json: { detail: "no" } });
      if (how === "a dropped connection") return r.abort("connectionreset");
      await new Promise(() => {}); // never answers
    });
    await page.goto("/matter-tools");
    await expect(page.getByTestId("pv-session-unverified")).toHaveText("We could not check your sign-in. Reload the page to try again.", { timeout: 20_000 });
    for (const id of ["pv-start", "pv-sample", "pv-sample-note", "pv-signed-out", "pv-signed-out-sample", "pv-signin-link"]) await expect(page.getByTestId(id), id).toHaveCount(0);
  });
}
