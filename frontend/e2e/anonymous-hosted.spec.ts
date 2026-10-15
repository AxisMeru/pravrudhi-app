import { expect, test } from "./support/engineTest";

// Lead-2 (15 Oct): an anonymous visitor of a HOSTED engine (a build with NEXT_PUBLIC_API_BASE; HOSTED_BUILD=1 in the test environment) must not call the keyed GET /api/v1/status, and the
// refused /api/app-token probe is asked once, so the visitor's console shows no 401/403 from those two calls.
test.skip(process.env.HOSTED_BUILD !== "1", "needs a build with NEXT_PUBLIC_API_BASE set (a hosted engine)");

test("anonymous visit to Screening: no request to /api/v1/status or /api/me, no 401/403 from status, app-token or me", async ({ page }) => {
  const asked: string[] = [];
  const refused: string[] = [];
  page.on("request", (r) => { if (/\/api\/(v1\/status|app-token|me)/.test(r.url())) asked.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  page.on("response", (r) => { if ((r.status() === 401 || r.status() === 403) && /\/api\/(v1\/status|app-token|me)/.test(r.url())) refused.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  await page.route("**/api/me", (r) => r.fulfill({ status: 401, json: { error: "unauthenticated" } }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.route("**/api/app-token", (r) => r.fulfill({ status: 403, json: { detail: "forbidden" } }));
  await page.goto("/screening");
  await expect(page.getByTestId("standing-line")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(asked.filter((a) => a.includes("/api/v1/status")), "the keyed status is not asked for an anonymous visitor").toEqual([]);
  expect(asked.filter((a) => a.includes("/api/me")), "the identity probe is not asked for an anonymous visitor of a hosted engine (#137)").toEqual([]);
  expect(refused, "no 401/403 from the status, app-token or identity calls").toEqual([]);
});
