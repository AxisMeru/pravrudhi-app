import { expect, test } from "./support/engineTest";

// #301 (WCAG 1.3.5, identify input purpose): the sign-in fields say what they are for, so a browser or password manager can fill them. No wording changes.
test("the email and password fields carry autocomplete tokens; the password's follows sign-in vs create an account", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.locator("#email")).toHaveAttribute("autocomplete", "email");
  await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password");
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.locator("#password")).toHaveAttribute("autocomplete", "new-password");
  await expect(page.locator("#email")).toHaveAttribute("autocomplete", "email");
});
