import { expect, test } from "./support/engineTest";

// Engine 0.6.18 (#499): any unhandled exception answers HTTP 500 {"error":"internal_error","detail":"an internal error occurred; try again later"}. The code and the engine's detail never reach the page, on every surface
// that calls the engine, and R1's sentence (lib/internalError.ts INTERNAL_ERROR_LINE) replaces the whole line on each surface.
const SENTENCE = "Something went wrong on our side, so this request was not completed. Try again in a moment.";
const BODY = { error: "internal_error", detail: "an internal error occurred; try again later" };
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for a sum.";
const CONTRACTS = { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] };

async function noLeak(page: import("@playwright/test").Page) {
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("internal_error");
  expect(text).not.toContain("an internal error occurred");
  expect(text).not.toContain("Internal Server Error");
  expect(text).toContain(SENTENCE);
  expect(text).not.toContain("HTTP 500");
  expect(text).not.toContain("Nothing was scored.");
  expect(text).not.toContain("No result was returned.");
}

for (const [name, body] of [["coded", BODY], ["bare", { detail: "Internal Server Error" }]] as const) {
  test(`Screening: a ${name} 500 from analyse-facts shows R1's sentence, never the code, the status or the engine's detail`, async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
    await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ status: 500, json: body }));
    await page.goto("/screening");
    await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
    await page.getByTestId("split-facts").click();
    await page.getByText("Cheating", { exact: false }).first().click();
    await page.getByRole("button", { name: "Screen these facts" }).click();
    await expect(page.getByText(SENTENCE)).toBeVisible();
    await noLeak(page);
  });

  test(`Intake: a ${name} 500 shows R1's sentence, never the code, the status or the engine's detail`, async ({ page }) => {
    test.skip(process.env.INTAKE_BUILD !== "1", "needs the NEXT_PUBLIC_INTAKE=1 build");
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
    await page.route("**/api/v1/intake", (r) => r.fulfill({ status: 500, json: body }));
    await page.goto("/intake");
    await page.getByLabel("Paste the text").fill("Invented: a short text.");
    await page.getByTestId("intake-run").click();
    await expect(page.getByTestId("intake-error")).toBeVisible();
    await noLeak(page);
  });

  test(`Citations: a ${name} 500 shows R1's sentence, never the code, the status or the engine's detail`, async ({ page }) => {
    test.skip(process.env.CITATION_EXISTENCE_BUILD !== "1", "needs the citations-ON build");
    await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ status: 500, json: body }));
    await page.goto("/citations");
    await page.getByRole("textbox").fill("(2099) 1 SCC 1");
    await page.getByRole("button", { name: "Check citations" }).click();
    await expect(page.getByText(SENTENCE)).toBeVisible();
    await noLeak(page);
  });
}

// Engine 0.6.18 also adds {"error":"service_config_missing"} (HTTP 503): it never reaches the page either. And the coded 500 is retried once, like the bare 500 before it (one retry = two requests).
test("Screening: a coded 503 service_config_missing shows the signed line, never the code", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ status: 503, json: { error: "service_config_missing" } }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByText("The service is not fully set up. Nothing was scored.")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("service_config_missing");
});

for (const [name, body] of [["coded", BODY], ["bare", { detail: "Internal Server Error" }]] as const) {
  test(`Screening: a ${name} 500 is retried once (two requests), as the bare 500 was before the code`, async ({ page }) => {
    let calls = 0;
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
    await page.route("**/api/v1/analyse-facts**", (r) => { calls += 1; return r.fulfill({ status: 500, json: body }); });
    await page.goto("/screening");
    await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
    await page.getByTestId("split-facts").click();
    await page.getByText("Cheating", { exact: false }).first().click();
    await page.getByRole("button", { name: "Screen these facts" }).click();
    await expect(page.getByText(SENTENCE)).toBeVisible();
    expect(calls).toBe(2);
  });
}
