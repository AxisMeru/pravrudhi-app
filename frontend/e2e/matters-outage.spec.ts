import { expect, test } from "./support/engineTest";

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

// Lead-2 / L2A, 14 Oct: the window is reported but NOT enforced (production: 09:00-21:00 London, the engine answers 24/7). Outside the hours the page must stay usable: no offline note, the run button enabled.
const UNENFORCED_CLOSED = { ...CLOSED, service_window: { ...CLOSED.service_window, enforced: false } };

test("outside a window the engine does not enforce, Screening and /matters stay usable (no offline note, buttons enabled)", async ({ page }) => {
  await page.route("**/api/v1/status", (r) => r.fulfill({ json: UNENFORCED_CLOSED }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.goto("/matters");
  await expect(page.getByRole("button", { name: "Analyse" })).toBeVisible();
  await page.waitForTimeout(1500); // the status read has answered by now; an enforced window would have shown the note by then
  await expect(page.getByTestId("matters-offline")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analyse" })).toBeEnabled();
  await page.goto("/screening");
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("screening-offline")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("The hosted demo is offline outside its service hours");
});

test("an ENFORCED closed window still closes Screening (the other arm)", async ({ page }) => {
  await page.route("**/api/v1/status", (r) => r.fulfill({ json: CLOSED }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.goto("/screening");
  await expect(page.getByTestId("screening-offline")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Screen these facts" })).toBeDisabled();
});
