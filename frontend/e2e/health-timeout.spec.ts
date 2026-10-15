import { expect, test } from "./support/engineTest";

// #312 (Track-B storm attack): an /api/health that never answers must not hold its connection for ever. The request is aborted after 8 s, so the banner reports the engine as unreachable and the browser's connection pool is not filled by hung reads.
test("a health read that never answers is aborted and the connection banner says the engine is not reachable", async ({ page }) => {
  test.setTimeout(40_000);
  let aborted = 0;
  await page.route("**/api/health", () => { /* never fulfilled */ });
  page.on("requestfailed", (r) => { if (r.url().includes("/api/health")) aborted += 1; });
  await page.goto("/workflows");
  await expect(page.getByText(/No engine reachable|The hosted engine is not answering/)).toBeVisible({ timeout: 20_000 });
  expect(aborted, "the hung health request was aborted by its own timeout").toBeGreaterThanOrEqual(1);
});

test("a hidden tab does not poll health, and checks again when it is shown", async ({ page }) => {
  let hits = 0;
  await page.route("**/api/health", (r) => { hits += 1; return r.fulfill({ json: { ok: true, version: "x", kernel: "x", ledger: true } }); });
  await page.goto("/workflows");
  await expect.poll(() => hits).toBeGreaterThanOrEqual(1);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  const before = hits;
  await page.waitForTimeout(6_500); // longer than one 5 s poll: nothing is read while hidden
  expect(hits, "no health reads while the tab is hidden").toBe(before);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => hits, { timeout: 5_000 }).toBeGreaterThan(before);
});
