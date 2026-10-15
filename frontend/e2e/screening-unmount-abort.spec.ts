import { expect, test } from "./support/engineTest";

// #176 (R2): leaving /screening while a run is in flight cancels the request (no ticker or request running on after the page is gone).
test("leaving the page cancels the run in flight", async ({ page }) => {
  const CID = "ipc415_property";
  let seen = false;
  let aborted = false;
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", () => { seen = true; /* never answered: the run stays in flight */ });
  page.on("requestfailed", (r) => { if (r.url().includes("/api/v1/analyse-facts")) aborted = true; });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill("Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.");
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("screening-cancel")).toBeVisible();
  await expect.poll(() => seen).toBe(true);
  // leave by client-side navigation (the page unmounts)
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "User guide", exact: true }).click();
  await expect(page).toHaveURL(/\/guide\/?$/);
  await expect.poll(() => aborted, { timeout: 5000 }).toBe(true);
});
