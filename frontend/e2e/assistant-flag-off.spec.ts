import { expect, test } from "./support/engineTest";

// The assistant entry is behind one build flag (lib/assistantFlag.ts). In the flag-OFF build (the shipped default) nothing about the assistant is offered or described, whatever the engine says.
test.skip(process.env.NEXT_PUBLIC_ASSISTANT_ENTRY === "1", "this spec is for the flag-off build");

test("flag off: an available assistant tier still shows no entry on Screening and no section or sentence on Data handling", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/health", (r) => r.fulfill({ json: { ok: true, version: "0.6.2", kernel: "0.6.2", ledger: true, assistant_tier: { state: "available", reason: null } } }));
  await page.goto("/screening");
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("assistant-run")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Run with the screening assistant");
  await page.goto("/data-handling");
  await expect(page.getByTestId("dh-assistant")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Anthropic");
});
