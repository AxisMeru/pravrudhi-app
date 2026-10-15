import { expect, test } from "./support/engineTest";

// #321 (explorer gap review, P3): at 390 x 844 the four-step bar used to stack in one column and push the first-run buttons below the fold. Two columns on a phone keep the panel's buttons in view; the panel's data link is a phone-size target.
const CONTRACTS = { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] };
test.use({ viewport: { width: 390, height: 844 } });

test("390 px first run: the step bar is two columns and the panel's buttons are above the fold", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
  await page.goto("/screening");
  const panel = page.getByTestId("start-panel");
  await expect(panel).toBeVisible();
  const steps = await page.getByTestId("workspace-steps").boundingBox();
  expect(steps, "the step bar has a box").not.toBeNull();
  expect(steps!.height, `step bar ${steps!.height}px tall`).toBeLessThan(200);
  for (const name of ["Try an example from a public court order", "Paste your own facts"]) {
    const b = await panel.getByRole("button", { name }).boundingBox();
    expect(b, name).not.toBeNull();
    expect(b!.y + b!.height, `${name} bottom ${b!.y + b!.height}`).toBeLessThanOrEqual(844);
  }
  const link = await panel.getByTestId("start-panel-data-link").boundingBox();
  expect(link!.height, "the data link is a phone-size target").toBeGreaterThanOrEqual(44);
});
