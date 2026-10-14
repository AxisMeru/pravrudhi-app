import { expect, test } from "./support/engineTest";

// #122/#123 (Lead-2 and L2A, 14 Oct): the assistant tier from /api/health. PAUSED (a configured tier that is refused or over budget: upstream_error, quota, budget_floor) greys the assistant features with ONE line.
// NOT CONFIGURED (the field absent, malformed, no_key, disabled, any unknown reason) shows nothing new. A FAILED READ greys the features with no line (fail closed). AVAILABLE changes nothing. The reason code is never shown.
const PAUSED = "The assistant features are paused; screening works as normal";
const TODAY_REASON = "Not available: this deployment has not switched the frontier reader on.";
const health = (extra: Record<string, unknown>) => ({ ok: true, version: "0.6.1", kernel: "0.6.1", ledger: true, ...extra });
type Answer = { status?: number; json?: unknown };

async function mockHealth(page: import("@playwright/test").Page, answer: Answer) {
  await page.route("**/api/health", (r) => (answer.status && answer.status >= 500 ? r.fulfill({ status: answer.status, json: { error: "x" } }) : r.fulfill({ json: answer.json })));
}

const PAUSED_STATES: Array<[string, Answer]> = ["upstream_error", "quota", "budget_floor"].map((reason) => [`paused: ${reason}`, { json: health({ assistant_tier: { state: "unavailable", reason } }) }]);
const NOT_CONFIGURED: Array<[string, Answer]> = [
  ["field absent (an older engine; production today)", { json: health({}) }],
  ["unavailable: no_key", { json: health({ assistant_tier: { state: "unavailable", reason: "no_key" } }) }],
  ["unavailable: disabled", { json: health({ assistant_tier: { state: "unavailable", reason: "disabled" } }) }],
  ["unavailable: an unknown reason", { json: health({ assistant_tier: { state: "unavailable", reason: "something_new" } }) }],
  ["unavailable: no reason", { json: health({ assistant_tier: { state: "unavailable", reason: null } }) }],
  ["a malformed field", { json: health({ assistant_tier: "unavailable" }) }],
];

test("Screening, health call fails (unreachable): the toggle is disabled and unchecked, no paused line", async ({ page }) => {
  await mockHealth(page, { status: 503 });
  await page.goto("/screening");
  const box = page.getByTestId("frontier-toggle").getByRole("checkbox");
  await expect(box).toBeDisabled();
  await expect(box).not.toBeChecked();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/paused/i);
});

test("Workflows, health call fails (unreachable): the assistant row is greyed, no paused line", async ({ page }) => {
  await mockHealth(page, { status: 503 });
  await page.goto("/workflows");
  await expect(page.getByTestId("workflow-row").first()).toHaveAttribute("data-paused", "true");
  await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
});

for (const [name, answer] of PAUSED_STATES) {
  test(`Screening, ${name}: the frontier toggle is greyed and unchecked and the paused line shows once, with no reason code`, async ({ page }) => {
    await mockHealth(page, answer);
    await page.goto("/screening");
    await expect(page.getByTestId("assistant-paused")).toHaveCount(1);
    await expect(page.getByTestId("assistant-paused")).toHaveText(PAUSED);
    const box = page.getByTestId("frontier-toggle").getByRole("checkbox");
    await expect(box).toBeDisabled();
    await expect(box).not.toBeChecked();
    await expect(page.getByTestId("frontier-unavailable")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/upstream_error|budget_floor|quota/);
    await expect(page.getByRole("button", { name: "Screen these facts" })).toBeVisible();
  });
}

for (const [name, answer] of NOT_CONFIGURED) {
  test(`Screening, not configured (${name}): nothing new is shown; the toggle is as it was`, async ({ page }) => {
    await mockHealth(page, answer);
    await page.goto("/screening");
    await expect(page.getByTestId("frontier-unavailable")).toHaveText(TODAY_REASON);
    const box = page.getByTestId("frontier-toggle").getByRole("checkbox");
    await expect(box).toBeDisabled();
    await expect(box).not.toBeChecked();
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/paused/i);
  });
}

test("Screening, available: no paused line (the toggle is as before)", async ({ page }) => {
  await mockHealth(page, { json: health({ assistant_tier: { state: "available", reason: null } }) });
  await page.goto("/screening");
  await expect(page.getByTestId("frontier-toggle")).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
});

test("Workflows, paused: the assistant row is greyed, the paused line shows once, the other rows are unchanged", async ({ page }) => {
  await mockHealth(page, { json: health({ assistant_tier: { state: "unavailable", reason: "quota" } }) });
  await page.goto("/workflows");
  await expect(page.getByTestId("assistant-paused")).toHaveCount(1);
  const rows = page.getByTestId("workflow-row");
  await expect(rows.first()).toHaveAttribute("data-paused", "true");
  for (let i = 1; i < (await rows.count()); i++) await expect(rows.nth(i)).not.toHaveAttribute("data-paused", "true");
  await expect(rows.first()).toContainText("Screening orchestration");
});

for (const [name, answer] of [...NOT_CONFIGURED, ["available", { json: health({ assistant_tier: { state: "available", reason: null } }) }] as [string, Answer]]) {
  test(`Workflows, ${name}: nothing is greyed and there is no paused line`, async ({ page }) => {
    await mockHealth(page, answer);
    await page.goto("/workflows");
    await expect(page.getByTestId("workflow-row").first()).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
    await expect(page.locator('[data-paused="true"]')).toHaveCount(0);
  });
}
