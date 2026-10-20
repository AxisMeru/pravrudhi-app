import { expect, test } from "@playwright/test";

// "Your matters" on /matter-tools (engine #597/#599 contract; NEXT_PUBLIC_YOUR_MATTERS=1, YOUR_MATTERS_BUILD=1). OFF: no section and no call to the route.
const ON = process.env.YOUR_MATTERS_BUILD === "1";
const A = "0123456789abcdef0123456789abcdef", B = "fedcba9876543210fedcba9876543210";
test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

test("flag OFF: no 'Your matters' section and the list route is never called", async ({ page }) => {
  test.skip(ON, "this is the flag-OFF check");
  let called = 0;
  await page.route("**/api/v1/matter-spans/my-matters", (r) => { called++; r.fulfill({ json: { matters: [], truncated: false } }); });
  await page.goto("/matter-tools");
  await expect(page.getByTestId("pv-matter")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("pv-yourmatters")).toHaveCount(0);
  expect(called).toBe(0);
});

test("flag ON: rows in the engine's order, numbered, with paper counts and no id; Open loads that matter's papers; Delete asks first and a Cancel changes nothing", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_YOUR_MATTERS=1");
  const deleted: string[] = [];
  await page.route("**/api/v1/matter-spans/my-matters", (r) => r.fulfill({ json: { matters: [{ matter_id: A, papers: 3 }, { matter_id: B, papers: 1 }], truncated: false } }));
  await page.route("**/api/v1/matter-spans/list", (r) => { const id = (JSON.parse(r.request().postData() ?? "{}") as { matter_id: string }).matter_id; r.fulfill({ json: { matter_id: id, documents: id === A ? [{ doc_id: "d1", name: "FIR (invented sample)", n_pages: 1, n_spans: 1, n_chars: 1, ingest_done: true, pages_without_text: [], indexed_complete: true }] : [], pages_total: 1, pages_not_read: 0, pages_note: "" } }); });
  await page.route("**/api/v1/matter-spans/delete", (r) => { deleted.push((JSON.parse(r.request().postData() ?? "{}") as { matter_id: string }).matter_id); r.fulfill({ json: { deleted: true } }); });
  await page.goto("/matter-tools");
  const rows = page.getByTestId("pv-yourmatters-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Matter 1");
  await expect(rows.nth(0)).toContainText("3 papers");
  await expect(rows.nth(1)).toContainText("Matter 2");
  await expect(rows.nth(1)).toContainText("1 paper");
  expect(await page.getByTestId("pv-yourmatters").innerText()).not.toContain(A);
  // the list is on screen, so the matter note may say so (R1: ym_note only when the list rendered)
  await expect(page.getByTestId("pv-matter-note")).toContainText("Your matters are listed above, and you can open or delete them there.");
  await expect(page.getByTestId("pv-matter-note")).not.toContainText("cannot be listed here");
  await rows.nth(0).getByTestId("pv-yourmatters-open").click();
  await expect(page.getByTestId("pv-papers")).toContainText("FIR (invented sample)");
  await rows.nth(1).getByTestId("pv-yourmatters-delete").click();
  await expect(page.getByTestId("pv-yourmatters-confirm")).toContainText("Delete Matter 2 and its 1 paper? It is removed from this service's store. This cannot be undone.");
  await page.getByTestId("pv-yourmatters-confirm-cancel").click();
  await expect(page.getByTestId("pv-yourmatters-confirm")).toHaveCount(0);
  expect(deleted).toEqual([]);
  await rows.nth(1).getByTestId("pv-yourmatters-delete").click();
  await page.getByTestId("pv-yourmatters-confirm-yes").click();
  await expect(rows).toHaveCount(1);
  expect(deleted).toEqual([B]);
  await expect(page.getByTestId("pv-yourmatters-message")).toHaveText("The matter was deleted.");
});

test("flag ON: an empty list, a truncated list (says only the first 50), and a route that is not on (the section is hidden)", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_YOUR_MATTERS=1");
  await page.route("**/api/v1/matter-spans/my-matters", (r) => r.fulfill({ json: { matters: [], truncated: false } }));
  await page.goto("/matter-tools");
  await expect(page.getByTestId("pv-yourmatters-empty")).toHaveText("You have no matters yet.");
  await page.unroute("**/api/v1/matter-spans/my-matters");
  await page.route("**/api/v1/matter-spans/my-matters", (r) => r.fulfill({ json: { matters: [{ matter_id: A, papers: 2 }, { matter_id: B, papers: 0 }], truncated: true } }));
  await page.reload();
  await expect(page.getByTestId("pv-yourmatters-truncated")).toHaveText("Showing 2 matters. There are more, and they are not listed here.");
  await page.unroute("**/api/v1/matter-spans/my-matters");
  await page.route("**/api/v1/matter-spans/my-matters", (r) => r.fulfill({ status: 404, json: { detail: "Not Found" } }));
  await page.reload();
  await expect(page.getByTestId("pv-matter")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("pv-yourmatters")).toHaveCount(0);
  // the list is hidden, so the matter note must NOT say your matters are listed above (R1): it falls back to the interim note
  await page.getByTestId("pv-start").click();
  await expect(page.getByTestId("pv-matter-note")).not.toContainText("listed above");
  await expect(page.getByTestId("pv-matter-note")).toContainText("your matters cannot be listed here");
});
