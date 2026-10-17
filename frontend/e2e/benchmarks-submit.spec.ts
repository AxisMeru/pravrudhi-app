import { expect, test } from "./support/engineTest";

import { NS_DRAWER } from "../src/lib/nyayasiddhiDrawer";
import { NS_COMING } from "../src/lib/nyayasiddhiComing";
import { NS_HIDDEN_SPLIT, NS_SUBMIT as T, NS_SUBMIT_LINKS as L, NS_SUBMIT_LINK_TEXT } from "../src/lib/nyayasiddhiSubmit";

// app#429 PR-B: the submission page. Every sentence is R1's (pinned by hash in src/lib/nyayasiddhiSubmit.spec.ts); no upload; links only to the public dataset files.
test("/benchmarks links to the page, and the page shows the six steps, the template, the checker, the limits and the hidden-split sentence", async ({ page }) => {
  await page.goto("/benchmarks");
  await page.getByTestId("ns-submit-link").click();
  await expect(page).toHaveURL(/\/benchmarks\/submit\/?$/);
  await expect(page.getByRole("heading", { name: T.heading, level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/^Submit a system · /);
  await expect(page.getByTestId("ns-submit-steps").locator("li")).toHaveCount(6);
  await expect(page.getByTestId("ns-submit-steps").locator("li").nth(5)).toHaveText(T.step6);
  await expect(page.getByTestId("ns-submit-status")).toContainText(NS_HIDDEN_SPLIT);
  await expect(page.getByTestId("ns-submit-status")).toContainText(T.no_outside_yet);
  await expect(page.getByTestId("ns-submit-template").locator("li")).toHaveCount(T.templateFields.length);
  await expect(page.getByTestId("ns-submit-limits").locator("li")).toHaveCount(4);
  await expect(page.getByTestId("ns-submit-no-upload")).toHaveText(T.no_upload);
  await expect(page.locator("main input[type=file], main textarea")).toHaveCount(0);
});

test("the links go only to the public dataset files, open safely, and the page has a way back", async ({ page }) => {
  await page.goto("/benchmarks/submit");
  for (const [id, url] of [["ns-link-checker", L.checker], ["ns-link-dataset", L.dataset]] as const) {
    const a = page.getByTestId(id);
    await expect(a).toHaveAttribute("href", url);
    await expect(a).toHaveAttribute("rel", /noopener/);
  }
  const hrefs = await page.locator("main a[href^='http']").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  for (const h of hrefs) expect(h).toMatch(/^https:\/\/huggingface\.co\/datasets\/AxisMeru\/nyayasiddhi(\/|$)/);
  await page.getByTestId("ns-link-back").click();
  await expect(page).toHaveURL(/\/benchmarks\/?$/);
  expect(NS_SUBMIT_LINK_TEXT.length).toBeGreaterThan(5);
});

test("the page works at phone width: no horizontal scroll, link targets are phone size", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/benchmarks/submit");
  await expect(page.getByTestId("ns-submit")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const id of ["ns-link-checker", "ns-link-dataset", "ns-link-back"]) {
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.height, id).toBeGreaterThanOrEqual(44);
  }
});

// app#429 PR-A: the "not populated yet" block on /benchmarks, the hidden-set sentence being the same constant the submission page prints.
test("/benchmarks shows the not-populated block with R1's lines and the one hidden-set sentence, and no digit", async ({ page }) => {
  await page.goto("/benchmarks");
  const block = page.getByTestId("ns-coming");
  await expect(block).toBeVisible();
  await expect(block.getByRole("heading", { level: 2 })).toHaveText(NS_COMING.coming_heading);
  await expect(block).toContainText(NS_HIDDEN_SPLIT);
  await expect(block).toContainText(NS_COMING.coming_rows);
  expect(await block.innerText()).not.toMatch(/\d/);
  await page.goto("/benchmarks/submit");
  await expect(page.getByTestId("ns-submit-status")).toContainText(NS_HIDDEN_SPLIT);
});

// app#429 PR-C (#693): the row-details dialog and the version selector on /benchmarks.
test("a row's details open in a modal dialog with R1's labels and the pinned public files, Esc closes it and focus returns to the button", async ({ page }) => {
  await page.goto("/benchmarks");
  const open = page.getByTestId("ns-row-details-open").first();
  await open.scrollIntoViewIfNeeded();
  await open.click();
  const dlg = page.getByTestId("ns-row-details").first();
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole("heading", { name: NS_DRAWER.dialog_title })).toBeVisible();
  await expect(dlg.getByText(NS_DRAWER.field_errors)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
  await expect(open).toBeFocused();
  // a row with pinned links shows both files, the two hashes and the note, all on the public dataset
  const linked = page.locator('[data-testid="ns-row"]').filter({ has: page.getByTestId("ns-detail-links") });
  await linked.first().getByTestId("ns-row-details-open").click();
  const links = page.getByTestId("ns-detail-links").first();
  await expect(links.getByRole("heading", { name: NS_DRAWER.links_heading })).toBeVisible();
  await expect(links.getByTestId("ns-detail-manifest")).toHaveAttribute("href", /^https:\/\/huggingface\.co\/datasets\/AxisMeru\/nyayasiddhi\/blob\/[0-9a-f]{40}\//);
  await expect(links.getByTestId("ns-detail-manifest-sha")).toHaveText(/^[0-9a-f]{64}$/);
  await expect(links).toContainText(NS_DRAWER.links_note);
  await page.getByTestId("ns-row-details-close").first().click();
});

test("the version selector lists only the versions that have rows, with no count, and its note is R1's", async ({ page }) => {
  await page.goto("/benchmarks");
  const box = page.getByTestId("ns-versions");
  await expect(box.getByRole("radio")).toHaveCount(1);
  await expect(box.getByRole("radio", { name: "v0.2" })).toBeChecked();
  await expect(page.getByTestId("ns-version-note")).toHaveText(NS_DRAWER.version_note);
  expect(await box.innerText()).not.toMatch(/\(\d|\d+ rows?/);
});
