import { expect, test } from "./support/engineTest";

// #122 (L2A, 14 Oct): the assistant tier from /api/health. Available = the assistant features behave as before; anything else (unavailable with any reason, the field absent, a failed health call) greys
// them with one paused line, and screening works as normal. The reason code is never shown.
const PAUSED = "The assistant features are paused; screening works as normal";
const health = (extra: Record<string, unknown>) => ({ ok: true, version: "0.6.1", kernel: "0.6.1", ledger: true, ...extra });

async function mockHealth(page: import("@playwright/test").Page, answer: { status?: number; json?: unknown }) {
  await page.route("**/api/health", (r) => (answer.status && answer.status >= 500 ? r.fulfill({ status: answer.status, json: { error: "x" } }) : r.fulfill({ json: answer.json })));
}

const PAUSED_STATES: Array<[string, { status?: number; json?: unknown }]> = [
  ["unavailable: no_key", { json: health({ assistant_tier: { state: "unavailable", reason: "no_key" } }) }],
  ["unavailable: upstream_error", { json: health({ assistant_tier: { state: "unavailable", reason: "upstream_error" } }) }],
  ["unavailable: quota", { json: health({ assistant_tier: { state: "unavailable", reason: "quota" } }) }],
  ["unavailable: budget_floor", { json: health({ assistant_tier: { state: "unavailable", reason: "budget_floor" } }) }],
  ["unavailable: disabled", { json: health({ assistant_tier: { state: "unavailable", reason: "disabled" } }) }],
  ["the field absent", { json: health({}) }],
  ["the health call fails", { status: 503 }],
];

for (const [name, answer] of PAUSED_STATES) {
  test(`Screening, ${name}: the frontier toggle is greyed and unchecked, the paused line shows once, no reason code, screening still works`, async ({ page }) => {
    await mockHealth(page, answer);
    await page.goto("/screening");
    await expect(page.getByTestId("assistant-paused")).toHaveCount(1);
    await expect(page.getByTestId("assistant-paused")).toHaveText(PAUSED);
    const box = page.getByTestId("frontier-toggle").getByRole("checkbox");
    await expect(box).toBeDisabled();
    await expect(box).not.toBeChecked();
    await expect(page.locator("body")).not.toContainText(/no_key|upstream_error|budget_floor|quota/);
    await expect(page.getByRole("button", { name: "Screen these facts" })).toBeVisible();
  });
}

test("Screening, available: no paused line (the toggle is as before)", async ({ page }) => {
  await mockHealth(page, { json: health({ assistant_tier: { state: "available", reason: null } }) });
  await page.goto("/screening");
  await expect(page.getByTestId("frontier-toggle")).toBeVisible();
  await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
});

test("Workflows, paused: the assistant row is greyed, the paused line shows once, the other rows are unchanged", async ({ page }) => {
  await mockHealth(page, { json: health({ assistant_tier: { state: "unavailable", reason: "disabled" } }) });
  await page.goto("/workflows");
  await expect(page.getByTestId("assistant-paused")).toHaveCount(1);
  const rows = page.getByTestId("workflow-row");
  await expect(rows.first()).toHaveAttribute("data-paused", "true");
  for (let i = 1; i < (await rows.count()); i++) await expect(rows.nth(i)).not.toHaveAttribute("data-paused", "true");
  await expect(rows.first()).toContainText("Screening orchestration");
});

test("Workflows, available: nothing is greyed and no paused line", async ({ page }) => {
  await mockHealth(page, { json: health({ assistant_tier: { state: "available", reason: null } }) });
  await page.goto("/workflows");
  await expect(page.getByTestId("workflow-row").first()).toBeVisible();
  await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
  await expect(page.locator('[data-paused="true"]')).toHaveCount(0);
});
