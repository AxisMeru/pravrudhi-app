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

// #259 (explorer gap review, citations ON): signed out on a hosted engine, Check on /citations sends NOTHING: no app-token request, no verify-citations request carrying the citation (it used to send both and get two red 401s).
// Needs the citations-ON build as well (CITATION_EXISTENCE_BUILD=1).
test("anonymous Check on /citations: no app-token and no verify request is sent, the signed-out sentence is shown", async ({ page }) => {
  test.skip(process.env.CITATION_EXISTENCE_BUILD !== "1", "needs the citations-ON build");
  const CITATION = "(2099) 1 SCC 1";
  const sent: string[] = [];
  page.on("request", (r) => { if (/\/api\/(app-token|v1\/verify-citations)/.test(r.url())) sent.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  page.on("request", (r) => { if ((r.postData() ?? "").includes(CITATION)) sent.push(`body carries the citation: ${r.url()}`); });
  await page.route("**/api/me", (r) => r.fulfill({ status: 401, json: { error: "unauthenticated" } }));
  await page.route("**/api/v1/status**", (r) => r.fulfill({ status: 401, json: { error: "unauthenticated" } }));
  await page.route("**/api/app-token", (r) => r.fulfill({ status: 401, json: { detail: "unauthenticated" } }));
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ status: 401, json: { detail: "unauthenticated" } }));
  await page.goto("/citations");
  await page.getByRole("textbox").fill(CITATION);
  await page.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citation-check-error")).toContainText("Nothing was looked up");
  expect(sent, "nothing was sent for an anonymous visitor").toEqual([]);
});
