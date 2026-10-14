import { expect, test } from "./support/engineTest";

// P5 and #138: fact boxes grow with their text instead of clipping it, and the small controls meet the 24 px target size.
test("a long fact is shown whole (the box grows) and Remove is at least 24 px", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/screening");
  const box = page.getByRole("textbox", { name: "Fact F1", exact: true });
  const before = (await box.boundingBox())!.height;
  await box.fill("A long fact sentence that runs over several lines when the box is narrow. ".repeat(12));
  await expect.poll(async () => (await box.boundingBox())!.height).toBeGreaterThan(before + 40);
  expect(await box.evaluate((el) => el.scrollHeight <= el.clientHeight + 1 || getComputedStyle(el).overflowY === "auto")).toBe(true);
  const rm = (await page.getByRole("button", { name: "Remove fact F1" }).boundingBox())!;
  expect(rm.height).toBeGreaterThanOrEqual(24);
  expect(rm.width).toBeGreaterThanOrEqual(24);
});

// P1 and P13 (R1's words, 14 Oct): the intro is a fold named "About this screening" with the standing line outside it; the example entry names each choice by its citation.
test("the intro folds behind 'About this screening' with the standing line outside, and the example entry lists the public orders by citation", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property", "ipc405_misappropriation"], entries: [] } }));
  await page.goto("/screening");
  await expect(page.getByTestId("standing-line")).toHaveText("This is a screening aid, not legal advice. A lawyer decides.");
  const fold = page.getByTestId("about-screening");
  await expect(fold.locator("summary")).toHaveText("About this screening");
  await expect(page.getByTestId("caveat-strip")).toBeVisible(); // the caveats stay OUTSIDE the fold (R1 and R2): visible without opening it
  await expect(page.getByTestId("product-line")).toBeHidden();
  await fold.locator("summary").click();
  await expect(page.getByTestId("product-line")).toBeVisible();
  await expect(fold.getByTestId("caveat-strip")).toHaveCount(0);
  const entry = page.getByTestId("example-entry");
  await expect(entry).toContainText("Try an example from a public court order");
  await expect(entry.getByRole("link")).toHaveText(["Madras High Court, order of 12 June 2024", "High Court of Karnataka at Bengaluru, order of 25 March 2025, 2025:KHC:12773"]);
  await entry.getByRole("link", { name: /Karnataka/ }).click();
  await expect(page.getByTestId("example-citation")).toHaveText("High Court of Karnataka at Bengaluru, order of 25 March 2025, 2025:KHC:12773");
  await expect(page.getByTestId("example-entry")).toHaveCount(0);
});

// P2 and P3: a new result is scrolled into view, and the run id and score sha come last, not first.
test("the result is brought into view and the run identifiers are the last line of it", async ({ page }) => {
  const F = "A person was promised gold coins for money paid, and the company then closed without returning it, and nothing was delivered to the buyer at all afterwards.";
  const answer = {
    run_id: "run-1", judge: "invented", score_sha256: "0".repeat(64), provenance: "invented", retention_notice: "invented retention notice", facts: [{ id: "F1", sha256: "1".repeat(64) }],
    contracts: [{ contract_id: "ipc415_property", outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, elements: [] }],
  };
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer }));
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F.repeat(3));
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const result = page.getByTestId("screening-result");
  await expect(result).toBeVisible();
  await expect.poll(async () => (await result.boundingBox())!.y, { timeout: 5000 }).toBeLessThan(200);
  const last = await result.locator(":scope > *").last().getAttribute("data-testid");
  expect(last).toBe("run-ids");
});

// P12: on a phone the menu button no longer sits on top of the page title, and a signed-out visitor's "Sign in" is a quiet link, not the loudest control.
test("on a phone the menu button clears the page title; Sign in is a secondary link", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/screening");
  const menu = (await page.getByRole("button", { name: "Open navigation" }).boundingBox())!;
  const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
  expect(menu.x + menu.width).toBeLessThanOrEqual(title.x + 1);
  await page.setViewportSize({ width: 1280, height: 800 });
  const signIn = page.getByRole("link", { name: "Sign in", exact: true }).first();
  await expect(signIn).toBeVisible();
  expect(await signIn.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
});

// R2 (14 Oct): a modified click on an example link opens it elsewhere and must NOT overwrite what the lawyer typed in this tab.
test("a ctrl-click on an example link leaves this tab's facts unchanged; a plain click loads the example", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/screening");
  const box = page.getByRole("textbox", { name: "Fact F1", exact: true });
  await box.fill("Invented: what the lawyer typed in this tab.");
  const popup = page.context().waitForEvent("page");
  await page.getByTestId("example-link-karnataka-cheating-2025").click({ modifiers: ["Control"] });
  await (await popup).close();
  await expect(box).toHaveValue("Invented: what the lawyer typed in this tab.");
  await expect(page.getByTestId("example-citation")).toHaveCount(0);
  await page.getByTestId("example-link-karnataka-cheating-2025").click();
  await expect(page.getByTestId("example-citation")).toHaveText("High Court of Karnataka at Bengaluru, order of 25 March 2025, 2025:KHC:12773");
});

// Studio (14 Oct): on a phone the floating "Shortcuts ?" pill covered page text; it is a keyboard help, so it shows from the md breakpoint up only (the ? key still opens the help).
test("the Shortcuts pill is hidden on a phone and shown on a desktop", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  const pill = page.getByRole("button", { name: /Shortcuts/ });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/screening");
  await expect(pill).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(pill).toBeVisible();
});
