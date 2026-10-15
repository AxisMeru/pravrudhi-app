import { expect, test } from "./support/engineTest";

// R1 (15 Oct, #213): under the signed-out consent prompt, one sentence says the example facts are a public court order, so the anonymous demo is enough: ONLY while the facts on the page are the
// loaded example, unchanged. The prompt and both buttons are unchanged.
const NOTE = "These facts are a public court order used as an example, not your matter, so the anonymous demo is enough.";
const CID = "ipc415_property";

async function signedOut(page: import("@playwright/test").Page) {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers", CID, "ipc415_damaging_act"], entries: [] } }));
  await page.route("**/api/me", (r) => r.fulfill({ status: 401, json: { error: "unauthenticated" } }));
}

test("an untouched example: the prompt shows the example sentence under it, and the prompt and both buttons are unchanged", async ({ page }) => {
  await signedOut(page);
  await page.goto("/screening?example=madras-public-order-2024");
  await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).not.toHaveValue("");
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const notice = page.getByTestId("not-signed-in");
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(notice).toContainText("You are not signed in, so nothing has been sent.");
  await expect(page.getByTestId("not-signed-in-signin")).toBeVisible();
  await expect(page.getByTestId("not-signed-in-anonymous")).toBeVisible();
  await expect(page.getByTestId("not-signed-in-example")).toHaveText(NOTE);
});

test("an edited example, or typed facts: the sentence is absent (the prompt is the same)", async ({ page }) => {
  await signedOut(page);
  await page.goto("/screening?example=madras-public-order-2024");
  const f1 = page.getByRole("textbox", { name: "Fact F1", exact: true });
  await expect(f1).not.toHaveValue("");
  await f1.fill("My own client's fact about a loan.");
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("not-signed-in")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("not-signed-in-example")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(NOTE);
});

test("typed facts with no example: the sentence is absent", async ({ page }) => {
  await signedOut(page);
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill("Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.");
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("not-signed-in")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("not-signed-in-example")).toHaveCount(0);
});
