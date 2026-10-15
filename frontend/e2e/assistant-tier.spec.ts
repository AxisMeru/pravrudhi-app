import { expect, test } from "./support/engineTest";

// #122/#123 (Lead-2 and L2A, 14 Oct): the assistant tier from /api/health. PAUSED (a configured tier that is refused or over budget: upstream_error, quota, budget_floor) greys the assistant features with ONE line.
// NOT CONFIGURED (the field absent, malformed, no_key, disabled, any unknown reason) shows nothing new. A FAILED READ greys the features with no line (fail closed). AVAILABLE changes nothing. The reason code is never shown.
// R1 14 Oct: the paused line and the Workflows greying apply ONLY when the assistant is offered (NEXT_PUBLIC_ASSISTANT_ENTRY=1). The flag-ON build runs the paused/greyed specs; the flag-OFF build runs the "nothing shown" ones.
const ON = process.env.NEXT_PUBLIC_ASSISTANT_ENTRY === "1";
const NEEDS_ON = "needs a build with NEXT_PUBLIC_ASSISTANT_ENTRY=1 (the assistant is offered)";
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

// #128 D6: the frontier reader is not shown while it is unavailable, so Screening has no toggle in any state; the one paused line is printed by the page itself, once, only when the tier is PAUSED.
test("Screening, health call fails (unreachable): no frontier toggle, no paused line", async ({ page }) => {
  await mockHealth(page, { status: 503 });
  await page.goto("/screening");
  await expect(page.getByTestId("frontier-toggle")).toHaveCount(0);
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/paused/i);
});

test("Workflows, health call fails (unreachable): the assistant row is greyed, no paused line", async ({ page }) => {
  test.skip(!ON, NEEDS_ON);
  await mockHealth(page, { status: 503 });
  await page.goto("/workflows");
  await expect(page.getByTestId("workflow-row").first()).toHaveAttribute("data-paused", "true");
  await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
});

for (const [name, answer] of PAUSED_STATES) {
  test(`Screening, ${name}: the paused line shows once, with no reason code, and no frontier toggle`, async ({ page }) => {
    test.skip(!ON, NEEDS_ON);
    await mockHealth(page, answer);
    await page.goto("/screening");
    await expect(page.getByTestId("assistant-paused")).toHaveCount(1);
    await expect(page.getByTestId("assistant-paused")).toHaveText(PAUSED);
    await expect(page.getByTestId("frontier-toggle")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/upstream_error|budget_floor|quota/);
    await expect(page.getByRole("button", { name: "Screen these facts" })).toBeVisible();
  });
}

for (const [name, answer] of NOT_CONFIGURED) {
  test(`Screening, not configured (${name}): nothing about the assistant or the frontier reader is shown`, async ({ page }) => {
    await mockHealth(page, answer);
    await page.goto("/screening");
    await expect(page.getByTestId("frontier-toggle")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(TODAY_REASON);
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/paused/i);
  });
}

test("Screening, available: no paused line and no frontier toggle", async ({ page }) => {
  await mockHealth(page, { json: health({ assistant_tier: { state: "available", reason: null } }) });
  await page.goto("/screening");
  await expect(page.getByTestId("frontier-toggle")).toHaveCount(0);
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
});

test("Workflows, paused: the assistant row is greyed, the paused line shows once, the other rows are unchanged", async ({ page }) => {
  test.skip(!ON, NEEDS_ON);
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

// Both arms of the gate: with the entry flag OFF a paused or unreachable tier shows no line and greys nothing (the row keeps its note and chip); the engine route can be on while the app entry is not.
for (const [name, answer] of [...PAUSED_STATES, ["unreachable", { status: 503 }] as [string, Answer]]) {
  test(`flag off, ${name}: no paused line on Screening or Workflows and no greying (the page never describes an assistant that is not offered)`, async ({ page }) => {
    test.skip(ON, "the flag-ON build shows them (covered above)");
    await mockHealth(page, answer);
    await page.goto("/screening");
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
    await page.goto("/workflows");
    await expect(page.getByTestId("workflow-row").first()).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
    await expect(page.locator('[data-paused="true"]')).toHaveCount(0);
    await expect(page.getByTestId("workflow-row").first()).toContainText("Screening orchestration");
    await expect(page.getByTestId("workflow-status").first()).toHaveText("Not yet offered");
  });
}

// #323: a hidden tab makes no /api/health read (the tier poller and the connection banner both wait); showing the tab reads again.
test("a hidden tab makes no health read; showing it reads again", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/health", (r) => { calls++; return r.fulfill({ json: health({}) }); });
  await page.addInitScript(() => {
    let hidden = true;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    (window as unknown as { __show: () => void }).__show = () => { hidden = false; document.dispatchEvent(new Event("visibilitychange")); };
  });
  await page.goto("/workflows");
  await expect(page.getByTestId("workflow-row").first()).toBeVisible();
  await page.waitForTimeout(1500);
  expect(calls, "no health read while the tab is hidden").toBe(0);
  await page.evaluate(() => (window as unknown as { __show: () => void }).__show());
  await expect.poll(() => calls, { message: "a read when the tab is shown" }).toBeGreaterThanOrEqual(1);
});

// Track-B G1 (deploy-15 attack): a greyed Workflows card keeps its text and link at full colour (no opacity on the whole card), so every line of it meets 4.5:1 in both themes.
for (const scheme of ["light", "dark"] as const) {
  test(`Workflows, paused (${scheme}): the greyed card's heading, note and link are at least 4.5:1 on their background`, async ({ page }) => {
    test.skip(!ON, NEEDS_ON);
    await page.emulateMedia({ colorScheme: scheme });
    await mockHealth(page, { json: health({ assistant_tier: { state: "unavailable", reason: "quota" } }) });
    await page.goto("/workflows");
    const card = page.getByTestId("workflow-row").first();
    await expect(card).toHaveAttribute("data-paused", "true");
    const found = await card.evaluate((el) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = (c: number[]) => { const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      let bg: number[] = [255, 255, 255];
      for (let n: Element | null = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.99) { bg = c; break; } }
      const out: Record<string, number> = {};
      const parts: Record<string, Element | null> = { heading: el.querySelector("h2"), note: el.querySelector("p"), link: el.querySelector("a") };
      for (const [k, node] of Object.entries(parts)) {
        if (!node) continue;
        let op = 1; for (let n: Element | null = node; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
        const fg = rgb(getComputedStyle(node).color);
        const a = lum(fg), b = lum(bg);
        out[k] = op < 1 ? 0 : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }
      return out;
    });
    for (const [k, ratio] of Object.entries(found)) expect(ratio, `${k} ${ratio.toFixed(2)}:1 (0 means an element opacity is below 1)`).toBeGreaterThanOrEqual(4.5);
  });
}
