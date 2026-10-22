import { expect, test } from "@playwright/test";

// /about and the footer (app#519): the engine version is /api/health's, read live; the app's sha and build time are baked; a failed read says so and never shows a number.
const HEALTH = { ok: true, version: "0.6.32", kernel: "0.1.0", ledger: true };
const BST = /^\d{1,2} \w{3} \d{4} \d\d:\d\d (BST|GMT)$/;

async function health(page: import("@playwright/test").Page, answer: "ok" | "down" | "notok") {
  await page.route("**/api/health", (r) => (answer === "ok" ? r.fulfill({ json: HEALTH }) : answer === "notok" ? r.fulfill({ json: { ...HEALTH, ok: false } }) : r.fulfill({ status: 503, json: { detail: "down" } })));
}

test("/about with a live engine: the versions, the signed What's new lines, the status, the report button and the pages", async ({ page }) => {
  await health(page, "ok");
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About", level: 1 })).toBeVisible();
  await expect(page.getByTestId("about-app")).toHaveText(/^([0-9a-f]{7}|unknown)$/);
  await expect(page.getByTestId("about-built")).toHaveText(BST);
  await expect(page.getByTestId("about-engine")).toHaveText("0.6.32");
  await expect(page.getByTestId("about-engine-released")).toHaveText("22 Oct 2026 14:15 BST");
  await expect(page.getByTestId("about-status")).toHaveText("Engine: running");
  const rel = page.getByTestId("about-release");
  await expect(rel).toHaveCount(5);
  await expect(rel.nth(0)).toHaveText("22 Oct 2026 14:15 BST · Engine 0.6.32 · Adds groundwork for a later feature, switched off. Nothing changes for you.");
  await expect(rel.nth(2)).toHaveText("21 Oct 2026 · Engine 0.6.28 · Old section look-up is on: it shows the table's section for an old IPC or CrPC number, and the IPC section text is restored.");
  await expect(page.getByRole("heading", { name: "What's new" })).toBeVisible();
  const links = page.getByTestId("about-pages").getByRole("link");
  await expect(links).toHaveCount(4);
  expect(await links.evaluateAll((a) => a.map((x) => x.getAttribute("href")))).toEqual(["/guide", "/how-it-was-built", "/benchmarks", "/data-handling"]);
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/@|contact|support|preview|beta|\bmodels?\b|judge|GPU/i);
});

test("/about when the engine does not answer: 'engine version unavailable right now', 'Engine: not answering', no version number, no stale release time", async ({ page }) => {
  await health(page, "down");
  await page.goto("/about");
  await expect(page.getByTestId("about-engine")).toHaveText("engine version unavailable right now");
  await expect(page.getByTestId("about-status")).toHaveText("Engine: not answering");
  await expect(page.getByTestId("about-engine-released")).toHaveCount(0);
  expect(await page.getByTestId("about-versions").innerText()).not.toMatch(/0\.6\.\d+/);
  await expect(page.getByTestId("site-footer")).toContainText("Engine unavailable");
});

test("/about when the engine answers ok:false is 'not answering' too", async ({ page }) => {
  await health(page, "notok");
  await page.goto("/about");
  await expect(page.getByTestId("about-status")).toHaveText("Engine: not answering");
  await expect(page.getByTestId("about-engine")).toHaveText("engine version unavailable right now");
});

test("the footer is on every page: 'App <sha> · Engine <version>', a link to /about; the menu has About", async ({ page }) => {
  await health(page, "ok");
  for (const path of ["/benchmarks", "/workflows", "/data-handling", "/guide"]) {
    await page.goto(path);
    await expect(page.getByTestId("site-footer"), path).toContainText(/^App ([0-9a-f]{7}|unknown) · Engine 0\.6\.32$/);
    await expect(page.getByTestId("site-footer-link")).toHaveAttribute("href", "/about");
  }
  await page.goto("/benchmarks");
  await expect(page.getByRole("navigation").getByRole("link", { name: "About", exact: true })).toBeVisible();
});

test("Copy details for a problem report: the text has only the app sha, build time, engine version and status, the page address and the time; 'Copied.' and nothing more", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await health(page, "ok");
  await page.goto("/about?matter=0123456789abcdef#frag");
  await page.getByTestId("about-copy").click();
  await expect(page.getByTestId("about-copied")).toHaveText("Copied.");
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const lines = clip.split("\n");
  expect(lines[0]).toBe("Problem report details");
  expect(lines[1]).toMatch(/^App: ([0-9a-f]{7}|unknown)( \(built .+ (BST|GMT)\))?$/);
  expect(lines[2]).toBe("Engine: 0.6.32");
  expect(lines[3]).toBe("Engine: running");
  expect(lines[4]).toMatch(/^Page: http:\/\/127\.0\.0\.1:\d+\/about$/);
  expect(lines[5]).toMatch(/^Browser: /);
  expect(lines[6]).toMatch(/^Time: \d{4}-\d\d-\d\dT.+Z \(.+(BST|GMT)\)$/);
  expect(clip).not.toMatch(/matter=|frag|@|token/i);
});

test("Copy details: when the clipboard refuses, the same text is shown to select and copy", async ({ page }) => {
  await health(page, "ok");
  await page.addInitScript(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true }); });
  await page.goto("/about");
  await page.getByTestId("about-copy").click();
  await expect(page.getByTestId("about-fallback")).toHaveValue(/^Problem report details\nApp: /);
  await expect(page.getByText("Select and copy this text")).toBeVisible();
  await expect(page.getByTestId("about-copied")).toHaveCount(0);
});

test("/about at 390 px: no sideways scroll", async ({ page }) => {
  await health(page, "ok");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");
  await expect(page.getByTestId("about-versions")).toBeVisible();
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
});
