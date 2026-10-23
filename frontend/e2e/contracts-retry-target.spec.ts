import { expect, test } from "./support/engineTest";

// Track-B (deploy-14 slice): the picker's "Try again" button (shown only when the offence list fails to load) is at least 24 px high on a desktop and 44 px on a phone, and pressing it loads the list.
for (const path of ["/screening", "/matters"]) for (const [width, min] of [[1280, 24], [390, 44]] as const) {
  test(`${path} at ${width} px: the contracts "Try again" button is at least ${min} px high and works`, async ({ page }) => {
    let failing = true; // the registry route fails until the visitor presses Try again (the client may retry a failed read itself, so a fixed number of failures is not a safe count)
    await page.route("**/api/nyaya/registry/contracts", (r) => (failing ? r.fulfill({ status: 500, json: { error: "internal" } }) : r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } })));
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    const retry = page.getByTestId("contracts-retry");
    await expect(retry).toBeVisible();
    const box = await retry.boundingBox();
    expect(box!.height, `Try again height at ${width}px`).toBeGreaterThanOrEqual(min - 0.5);
    expect(box!.width).toBeGreaterThanOrEqual(24);
    failing = false;
    await retry.click();
    await expect(page.getByTestId("contracts-retry")).toHaveCount(0);
  });
}
