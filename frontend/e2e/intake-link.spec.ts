import { expect, test } from "./support/engineTest";

// R1 (15 Oct, #247): Intake is reached from ONE line under the Facts step on the Matter workspace ("To start from pasted text, use Intake." and the link "Open Intake"), only in a build with the
// Intake flag and only for a signed-in user; a signed-out visitor, or a visitor whose identity read failed, sees nothing there. No nav entry. On /intake a signed-out visitor is told up front.
// The same file runs in both builds: the flag-off build must show no line even when signed in.
const FLAG_ON = process.env.INTAKE_BUILD === "1";
const SENTENCE = "To start from pasted text, use Intake.";
const IN = { email: "invented@example.invalid" };

async function setup(page: import("@playwright/test").Page, me: "in" | "out" | "error") {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/me", (r) => (me === "in" ? r.fulfill({ json: IN }) : me === "out" ? r.fulfill({ status: 401, json: { error: "not signed in" } }) : r.fulfill({ status: 500, json: { error: "x" } })));
}

for (const [me, shown] of [["in", FLAG_ON], ["out", false], ["error", false]] as const) {
  test(`Matter workspace, Intake flag ${FLAG_ON ? "on" : "off"}, ${me === "in" ? "signed in" : me === "out" ? "signed out" : "identity read failed"}: the Intake line is ${shown ? "shown" : "absent"}`, async ({ page }) => {
    await setup(page, me);
    await page.goto("/screening");
    await expect(page.getByLabel("Paste the FIR, complaint or narrative")).toBeVisible();
    await page.waitForTimeout(800);
    if (shown) {
      await expect(page.getByTestId("intake-link-line")).toHaveText(`${SENTENCE} Open Intake`);
      await expect(page.getByTestId("intake-link")).toHaveAttribute("href", "/intake");
      // under the Facts step, not in the nav
      await expect(page.locator("#step-facts").getByTestId("intake-link-line")).toHaveCount(1);
    } else {
      await expect(page.getByTestId("intake-link-line")).toHaveCount(0);
      await expect(page.getByText(SENTENCE)).toHaveCount(0);
    }
    await expect(page.getByRole("navigation").getByRole("link", { name: "Intake", exact: true })).toHaveCount(0);
  });
}

test.describe("the Intake page up front", () => {
  test.skip(!FLAG_ON, "needs the NEXT_PUBLIC_INTAKE=1 build");
  test("signed out: R1's sentence above the paste box before anything is typed; signed in: not there", async ({ page }) => {
    await setup(page, "out");
    await page.goto("/intake");
    const notice = page.getByTestId("intake-signed-in-only-upfront");
    await expect(notice).toHaveText("Intake is offered only to signed-in users.");
    const [n, box] = [await notice.boundingBox(), await page.getByLabel("Paste the text").boundingBox()];
    expect(n!.y, "above the paste box").toBeLessThan(box!.y);
    await page.unroute("**/api/me");
    await page.route("**/api/me", (r) => r.fulfill({ json: IN }));
    await page.goto("/intake");
    await expect(page.getByLabel("Paste the text")).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page.getByTestId("intake-signed-in-only-upfront")).toHaveCount(0);
  });
});
