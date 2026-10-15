import { expect, test } from "./support/engineTest";

// #302 (R1's rule): every offence label on the /matters list is "<title> · <sections>" from the offence's own row, the same rule as the guide; a way of a multi-way offence keeps its own block title.
test("the /matters contract list labels every offence with its sections", async ({ page }) => {
  const ids = ["ipc416", "bns85", "bns47", "ni138", "bns69", "ipc415_property"];
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ids, entries: ids.map((id) => ({ id, validated: id !== "ni138" })) } }));
  await page.goto("/matters");
  const label = async (id: string) => (await page.locator(`[data-contract-id="${id}"]`).innerText()).replace(/\s+/g, " ").trim();
  await expect(page.locator('[data-contract-id="ipc416"]')).toBeVisible();
  expect(await label("ipc416")).toContain("Cheating by personation · BNS 319 · IPC 416");
  expect(await label("bns85")).toContain("Cruelty by the husband or his relatives · BNS 85, 86 · IPC 498A");
  expect(await label("bns47")).toContain("Abetment in India of an offence outside India · BNS 47 · IPC 108A");
  expect(await label("ni138")).toContain("Dishonour of a cheque · Negotiable Instruments Act s.138");
  expect(await label("ipc415_property")).toContain("Cheating · BNS 318 · IPC 415: by delivery of property");
  expect(await label("bns69")).toContain("BNS 69");
});
