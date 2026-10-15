import { expect, test } from "./support/engineTest";

// P5 slice 3 (#144), R1's words: the offence search and a mark on EVERY offence row (the app's own marks).
const LIST = ["ipc415_property", "ipc415_damaging_act", "ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers", "ipc416"];
test("every offence row carries a mark: validated, or not validated, verify", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: LIST, entries: LIST.map((id) => ({ id, validated: id.startsWith("ipc415") })) } }));
  await page.goto("/screening");
  const rows = page.getByTestId("offence-list").locator("li");
  await expect(rows.first()).toBeVisible();
  const marks = await page.getByTestId("offence-mark").allTextContents();
  expect(marks.length).toBe(await rows.count());
  expect(marks.every((m) => m === "validated" || m === "not validated, verify"), JSON.stringify(marks)).toBe(true);
  expect(marks).toContain("validated");
  expect(marks).toContain("not validated, verify");
});

test("when the validated list cannot be read, every row says so", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: LIST, entries: [] } }));
  await page.goto("/screening");
  await expect(page.getByTestId("offence-list").locator("li").first()).toBeVisible();
  const marks = await page.getByTestId("offence-mark").allTextContents();
  expect(marks.length).toBeGreaterThan(0);
  expect(new Set(marks)).toEqual(new Set(["validation status unavailable, verify"]));
});

test("Search by name or section filters the rows; an empty result says so", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: LIST, entries: LIST.map((id) => ({ id, validated: true })) } }));
  await page.goto("/screening");
  const search = page.getByLabel("Search by name or section");
  await expect(search).toBeVisible();
  const all = await page.getByTestId("offence-list").locator("li").count();
  expect(all).toBeGreaterThan(1);
  await search.fill("cheating");
  const some = await page.getByTestId("offence-list").locator("li").count();
  expect(some).toBeGreaterThan(0);
  expect(some).toBeLessThan(all);
  await search.fill("318");
  await expect(page.getByTestId("offence-list").getByText("Cheating", { exact: true })).toBeVisible();
  await search.fill("zzzz");
  await expect(page.getByTestId("offence-search-empty")).toHaveText("No offence matches that search.");
  await expect(page.getByTestId("offence-list").locator("li")).toHaveCount(0);
});

test("a ticked offence stays visible, above the matches, while the search hides the others", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: LIST, entries: LIST.map((id) => ({ id, validated: true })) } }));
  await page.goto("/screening");
  const list = page.getByTestId("offence-list");
  await expect(list.locator("li").first()).toBeVisible();
  await list.getByRole("checkbox", { name: /Cheating by personation/ }).check();
  await page.getByLabel("Search by name or section").fill("breach");
  const names = await list.locator("li").allTextContents();
  expect(names.length).toBeGreaterThanOrEqual(2);
  expect(names[0]).toContain("Cheating by personation");
  expect(names.some((n) => n.includes("Criminal breach of trust"))).toBe(true);
  await expect(list.getByRole("checkbox", { name: /Cheating by personation/ })).toBeChecked();
});
