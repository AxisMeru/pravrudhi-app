import { expect, test } from "./support/engineTest";

// #557: one failed status read while the engine is busy must not show "The engine is not answering right now"; three in a row do, a success in between resets.
const LINE = "The engine is not answering right now. Nothing is sent until it is back.";
const OK = { engine_version: "0.0.0", service_window: { timezone: "Europe/London", open: "00:00", close: "23:59", enforced: false, open_now: true, next_open_utc: "2026-10-23T00:00:00+00:00" }, judge: { state: "ready", checked_at: "2026-10-23T00:00:00+00:00" } };

test("one failed status read stays quiet; a success resets; three failures in a row show the line", async ({ page }) => {
  await page.clock.install();
  const answers: Array<"fail" | "ok"> = ["fail", "ok", "fail", "fail", "fail"];
  let n = 0;
  await page.route("**/api/v1/status", (r) => (answers[Math.min(n++, answers.length - 1)] === "fail" ? r.fulfill({ status: 503, json: { error: "x" } }) : r.fulfill({ json: OK })));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.goto("/screening");
  await expect.poll(() => n).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("screening-engine-offline")).toHaveCount(0);
  await page.clock.fastForward(6_000); // the failed read is asked again quickly
  await expect.poll(() => n).toBeGreaterThanOrEqual(2); // success: resets
  await page.clock.fastForward(30_000);
  await expect.poll(() => n).toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId("screening-engine-offline")).toHaveCount(0); // 1st failure after the reset
  await page.clock.fastForward(6_000);
  await expect.poll(() => n).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId("screening-engine-offline")).toHaveCount(0); // 2nd
  await page.clock.fastForward(6_000);
  await expect.poll(() => n).toBeGreaterThanOrEqual(5);
  await expect(page.getByTestId("screening-engine-offline")).toHaveText(LINE); // 3rd in a row
});
