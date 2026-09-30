import { expect, test } from "@playwright/test";

// #14: with the engine's status reporting the service window closed, /matters says so, disables Analyse and
// sends no analyse-facts request. The status endpoint is mocked; nothing here needs a live engine.
const CLOSED = {
  engine_version: "0.0.0",
  service_window: { timezone: "Europe/London", open: "09:00", close: "21:00", enforced: true, open_now: false, next_open_utc: "2099-01-01T09:00:00+00:00" },
  judge: { state: "unknown", checked_at: null },
};

test("outside the service window /matters is offline and sends no analyse request", async ({ page }) => {
  let analyseCalls = 0;
  await page.route("**/api/v1/status", (r) => r.fulfill({ json: CLOSED }));
  await page.route("**/api/v1/analyse-facts", (r) => {
    analyseCalls += 1;
    return r.fulfill({ status: 500, json: {} });
  });
  await page.goto("/matters");
  await expect(page.getByTestId("matters-offline")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Analyse" })).toBeDisabled();
  await page.waitForTimeout(500);
  expect(analyseCalls).toBe(0);
});
