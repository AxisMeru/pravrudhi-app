import { expect, test as base, type ConsoleMessage } from "@playwright/test";

/**
 * The product is a clean slate (ADR-0049 in AxisMeru/pravrudhi): twelve pages for a user's own objective, and none
 * of Studio's. Run against a live engine that serves this repository's built interface:
 *   PRAVRUDHI_EDITION=product PRAVRUDHI_FRONTEND_DIR=$PWD/frontend/out pravrudhi app --root <workspace> --port 8301
 *   LOCAL_ENGINE_URL=http://127.0.0.1:8301 npx playwright test
 */
const test = base.extend<{ diagnostics: void }>({
  diagnostics: [async ({ context }, use): Promise<void> => {
    const failed: string[] = [];
    const consoleErrors: string[] = [];
    context.on("response", (r): void => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    context.on("console", (m: ConsoleMessage): void => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
    });
    await use();
    expect.soft(failed, "every request the product's pages make must succeed on a product engine").toEqual([]);
    expect.soft(consoleErrors, "the product's pages must not log errors").toEqual([]);
  }, { auto: true }],
});

const PAGES: Array<[string, string]> = [
  ["/start", "Start"], ["/", "Pravrudhi"], ["/objectives", "Objectives"], ["/progress", "Progress"],
  ["/memory", "Memory"], ["/catalogue", "Catalogue"], ["/chat", "Chat"], ["/nyaya", "Nyaya"],
  ["/runs", "Runs"], ["/models", "Models"], ["/settings", "Settings"], ["/install", "Get it running"],
  ["/signin", "Sign in"],
];

for (const [path, heading] of PAGES) {
  test(`${path} renders on a product engine`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.ok(), `${path} must load`).toBe(true);
    await expect(page.locator("main").getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
  });
}

test("the interface offers only the product's pages", async ({ page }) => {
  await page.goto("/settings");
  await page.locator("main").getByRole("heading", { name: "Settings", exact: true }).waitFor();
  const offered = new Set(
    await page.locator("nav a[href]").evaluateAll((links) => links.map((a) => new URL((a as HTMLAnchorElement).href).pathname)),
  );
  for (const studio of ["/appetite", "/inbox", "/candidates", "/swarm", "/diffs", "/heartbeat", "/trace", "/parity",
    "/search", "/system", "/requests", "/machines", "/tour", "/desktop"]) {
    expect(offered.has(studio), `${studio} is Studio's and must not be offered`).toBe(false);
  }
  // Sign-in is reached from the account control in the sidebar header, not from the navigation list.
  for (const own of PAGES.map(([p]) => p).filter((p) => p !== "/signin")) {
    expect(offered.has(own), `${own} is the product's and must be offered`).toBe(true);
  }
  expect(offered.has("/signin") || (await page.locator("a[href='/signin']").count()) > 0, "sign-in is reachable").toBe(true);
});

test("the engine names the product edition", async ({ request }) => {
  const me = await request.get("/api/me");
  expect(me.ok()).toBe(true);
  expect(((await me.json()) as { edition?: string }).edition).toBe("Pravrudhi");
});
