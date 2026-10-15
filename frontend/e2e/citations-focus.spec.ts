import { expect, test } from "./support/engineTest";

// #260 (explorer gap review, citations ON): after pressing Check the keyboard focus fell to <body> (the button is disabled while it runs, and a disabled element cannot keep focus). The button now stays
// focusable (aria-disabled) and keeps focus through the run and after the result.
test.skip(process.env.CITATION_EXISTENCE_BUILD !== "1", "needs the citations-ON build");

test("Check citations: keyboard focus stays on the button while the check runs and after the result", async ({ page }) => {
  await page.route("**/api/v1/verify-citations", async (r) => { await new Promise((res) => setTimeout(res, 400)); await r.fulfill({ json: { result: "NOT_IN_INDEX", note: "n", status: "not_in_index", label: "not in index", verified: false, preview: true } }); });
  await page.goto("/citations");
  await page.getByRole("textbox").fill("(2099) 1 SCC 1");
  const button = page.getByRole("button", { name: /^Check( citations)?$|^Checking/ }); // "Check" on the single-citation form, "Check citations" on the list panel
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveText(/Checking/);
  expect(await page.evaluate(() => document.activeElement?.tagName), "focus during the run").toBe("BUTTON");
  await expect(button).toHaveText(/^Check/);
  await expect(page.getByText("Not found in our index").first()).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.textContent), "focus after the result").toMatch(/^Check/);
  // a second press while idle works from the keyboard too; an empty box does nothing and still keeps focus
  await page.getByRole("textbox").fill("");
  await button.focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement?.textContent)).toMatch(/^Check/);
});
