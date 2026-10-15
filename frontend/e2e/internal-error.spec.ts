import { expect, test } from "./support/engineTest";

// Engine 0.6.18 (#499): any unhandled exception answers HTTP 500 {"error":"internal_error","detail":"an internal error occurred; try again later"}. The code and the engine's detail never reach the page, on every surface
// that calls the engine. The sentence itself is R1's (lib/internalError.ts INTERNAL_ERROR_LINE, null until worded): until then each surface shows its own existing generic line.
const BODY = { error: "internal_error", detail: "an internal error occurred; try again later" };
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for a sum.";
const CONTRACTS = { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] };

async function noLeak(page: import("@playwright/test").Page) {
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("internal_error");
  expect(text).not.toContain("an internal error occurred");
  expect(text).not.toContain("Internal Server Error");
}

for (const [name, body] of [["coded", BODY], ["bare", { detail: "Internal Server Error" }]] as const) {
  test(`Screening: a ${name} 500 from analyse-facts shows the page's own line, never the code or the engine's detail`, async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
    await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ status: 500, json: body }));
    await page.goto("/screening");
    await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
    await page.getByTestId("split-facts").click();
    await page.getByText("Cheating", { exact: false }).first().click();
    await page.getByRole("button", { name: "Screen these facts" }).click();
    await expect(page.getByText("The engine answered with an error")).toBeVisible();
    await noLeak(page);
  });

  test(`Intake: a ${name} 500 shows the general line, never the code or the engine's detail`, async ({ page }) => {
    test.skip(process.env.INTAKE_BUILD !== "1", "needs the NEXT_PUBLIC_INTAKE=1 build");
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
    await page.route("**/api/v1/intake", (r) => r.fulfill({ status: 500, json: body }));
    await page.goto("/intake");
    await page.getByLabel("Paste the text").fill("Invented: a short text.");
    await page.getByTestId("intake-run").click();
    await expect(page.getByTestId("intake-error")).toBeVisible();
    await noLeak(page);
  });

  test(`Citations: a ${name} 500 shows the page's own line, never the code or the engine's detail`, async ({ page }) => {
    test.skip(process.env.CITATION_EXISTENCE_BUILD !== "1", "needs the citations-ON build");
    await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ status: 500, json: body }));
    await page.goto("/citations");
    await page.getByRole("textbox").fill("(2099) 1 SCC 1");
    await page.getByRole("button", { name: "Check citations" }).click();
    await expect(page.getByText("The engine answered with an error")).toBeVisible();
    await noLeak(page);
  });
}
