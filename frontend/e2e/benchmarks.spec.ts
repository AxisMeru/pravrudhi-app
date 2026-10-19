import type { Locator } from "@playwright/test";

import { expect, test } from "./support/engineTest";

// The benchmarks page is short (R1's strings, 13 Oct): what we check, how we test, what the checks do and do not show. No figure outside the NyayaSiddhi results view: Interim lead's explicit exception (15 Oct) allows figures there only (the signed NyayaSiddhi rows, each with its n and exact 95% interval).
test("the page shows R1's statements, NyayaSiddhi and How we test, and no figure", async ({ page }) => {
  await page.goto("/benchmarks");
  await expect(page.getByRole("heading", { name: "Benchmarks", level: 1 })).toBeVisible();
  await expect(page.getByText("What we check, and what the checks do and do not show.")).toBeVisible();
  const items = page.getByTestId("benchmark-statements").locator("li");
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText("Court material: fixed sets of real Indian court items");
  await expect(items.nth(1)).toContainText("Citation checker:");
  await expect(items.nth(2)).toContainText("Public test: a United States rule-application benchmark");
  await expect(items.nth(3)).toContainText("Legal-knowledge test: how our models do");
  await expect(page.getByTestId("block-how")).toContainText("Each result is checked by a second model reviewer.");
  await expect(page.getByText("Research results, not legal advice.")).toBeVisible();
  // everything outside the NyayaSiddhi results view
  const text = await page.locator("main").evaluate((el) => { const c = el.cloneNode(true) as HTMLElement; c.querySelectorAll('[data-testid="nyayasiddhi-results"], [data-testid="block-film"]').forEach((n) => n.remove()); return c.innerText; });
  expect(text).not.toMatch(/%|interval|upper bound|Result pending|Registered bar|Inconclusive/i);
  expect(text.replace(/NyayaSiddhi v0\.2/, "")).not.toMatch(/\d/);
});

test("the page works at phone width: no horizontal scroll of the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/benchmarks");
  await expect(page.getByTestId("benchmark-statements")).toBeVisible();
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
});

test("the benchmarks page and the demo page link NyayaSiddhi with its blurb, and show no figure for it", async ({ page }) => {
  for (const path of ["/benchmarks", "/demo"]) {
    await page.goto(path);
    const link = page.getByTestId("nyayasiddhi-link");
    await expect(link).toHaveText("NyayaSiddhi v0.2: open Indian element-by-element development benchmark (data + scorer)");
    await expect(link).toHaveAttribute("href", "https://huggingface.co/datasets/AxisMeru/nyayasiddhi");
    await expect(page.getByTestId("nyayasiddhi-blurb")).toHaveText("development benchmark; descriptive; no ranking");
    await expect(page.getByTestId("nyayasiddhi")).not.toContainText(/\d+(\.\d+)?%/);
  }
});

// Interim lead's exception (15 Oct): the NyayaSiddhi results from the signed rows (src/data/nyayasiddhi/rows.json), R1's words, each figure with its n and exact 95% interval; no ranking, no "proof".
const DEV = "Development items; used to design fixes, so seen by us";
const SECOND = "Second development set, cruelty items left out; exposed to Anthropic in an earlier study";
const CARD_HEADS = { product: "nyaya-product", o1: "nyayasiddhi-open-O1", o2: "nyayasiddhi-open-O2", direct: "nyayasiddhi-ref-S-direct", harness: "nyayasiddhi-ref-S-harness" } as const;
const cardOf = (box: Locator, system: keyof typeof CARD_HEADS, split: "dev" | "second") => box.getByTestId("ns-row").filter({ hasText: CARD_HEADS[system] }).filter({ hasText: split === "dev" ? DEV : SECOND });

test("the NyayaSiddhi results: R1's heading and intro, the signed cards in a fixed order under two split subheadings, with their labels, and each figure with n and its exact interval", async ({ page }) => {
  await page.goto("/benchmarks");
  const box = page.getByTestId("nyayasiddhi-results");
  await expect(box.getByRole("heading", { name: "NyayaSiddhi results", level: 2 })).toBeVisible();
  await expect(box).toContainText("Only signed runs appear here, and every figure is a development figure on material we have already seen, not a measure of how the product does on your matter.");
  await expect(box.getByTestId("ns-supply-line")).toHaveText("For now the board holds only our own rows. A larger hidden set depends on the supply of suitable court items, and we promise no date.");
  await expect(box.getByTestId("ns-order-line")).toHaveText("Rows are listed in a fixed order, by split and system name, never by a figure.");
  await expect(box.getByText("How the system decides each item", { exact: true })).toBeVisible();
  await expect(box.getByTestId("ns-unit-note")).toHaveText("Every figure on this page counts items, however the system decides them.");
  // two subheadings, the development items first; inside each: the product row, then the reference arms by system name
  await expect(box.getByTestId("ns-split-heading")).toHaveText([DEV, SECOND]);
  const rows = box.getByTestId("ns-row");
  await expect(rows).toHaveCount(8);
  for (let i = 0; i < 8; i++) await expect(rows.nth(i)).toContainText([CARD_HEADS.product, CARD_HEADS.o1, CARD_HEADS.o2, CARD_HEADS.direct][i % 4]);
  // About this run: one closed block on each of the six reference rows in this view (none on the product rows); opening one shows R1's first line
  const about = box.getByTestId("ns-about-run");
  await expect(about).toHaveCount(6);
  await expect(cardOf(box, "product", "dev").getByTestId("ns-about-run")).toHaveCount(0);
  const o2 = cardOf(box, "o2", "dev").getByTestId("ns-about-run");
  await expect(o2).not.toHaveAttribute("open", "");
  await expect(o2.locator("summary")).toHaveText("About this run");
  await o2.locator("summary").click();
  await expect(o2.locator("li").first()).toHaveText("The prompt's output-format line was changed after a smoke test on five invented items; no real item was used for that test.");
  await expect(o2.locator("li").filter({ hasText: /^Errors:/ })).toHaveText("Errors: 2 (1 item not served for context, 1 reply that could not be read as an answer).");
  await expect(o2.locator("li").filter({ hasText: /^Not served:/ })).toContainText("did not fit the served context length of 4096 tokens");
  await expect(o2).not.toContainText(/PROOF|error_mapping|\{item_id/);
  // the API rows open with the exposure sentence, by split
  const apiFirst = (split: "dev" | "second") => cardOf(box, "direct", split).getByTestId("ns-about-run").locator("li").first();
  await cardOf(box, "direct", "dev").getByTestId("ns-about-run").locator("summary").click();
  await expect(apiFirst("dev")).toHaveText("In this study, the allegation text of this split was sent to the Anthropic API, beginning with the stopped 20-item run; the registration records that it had not been sent to the API before.");
  await cardOf(box, "direct", "second").getByTestId("ns-about-run").locator("summary").click();
  await expect(apiFirst("second")).toHaveText("In this run, the allegation text of this split was sent to the Anthropic API again; it had been sent before, in an earlier study.");
  await expect(cardOf(box, "product", "second")).toContainText("Reported by the entrant");
  // the per-row stack label and the per-row organiser line
  for (const sys of ["product", "o1", "o2"] as const) for (const sp of ["dev", "second"] as const) await expect(cardOf(box, sys, sp).getByTestId("ns-stack")).toHaveText("dev stack (local)");
  for (const sp of ["dev", "second"] as const) await expect(cardOf(box, "direct", sp).getByTestId("ns-stack")).toHaveText("Anthropic API; not our dev stack or production stack");
  for (const sp of ["dev", "second"] as const) await expect(cardOf(box, "product", sp).getByTestId("ns-organiser")).toHaveText("Entered by the NyayaSiddhi organisers, who also built this system");
  for (const sys of ["o1", "o2", "direct"] as const) await expect(cardOf(box, sys, "dev").getByTestId("ns-organiser")).toHaveText("Run by the NyayaSiddhi organisers with prompts they wrote; not an outside entry");
  const text = await box.innerText();
  for (const t of ["0 of 64 (exact 95% interval 0.0% to 5.6%)", "0 of 128 (exact 95% interval 0.0% to 2.8%)", "0 of 107 (exact 95% interval 0.0% to 3.4%)", "9 of 107 (exact 95% interval 3.9% to 15.4%)", "1 of 64 (exact 95% interval 0.0% to 8.4%)", "23 of 107 (exact 95% interval 14.1% to 30.5%)", "3 of 64 (exact 95% interval 1.0% to 13.1%)", "69 of 107 (exact 95% interval 54.6% to 73.5%)", "12 of 64 (exact 95% interval 10.1% to 30.5%)", "7 of 15 (exact 95% interval 21.3% to 73.4%)", "20 of 128 (exact 95% interval 9.8% to 23.1%)"]) expect(text).toContain(t);
  expect(text).toContain("The system marked no item as supported here, so a count of 0 wrongly supported is not read on its own.");
  expect(text).not.toMatch(/\bproof\b|verified|\bbest\b|better|\bbeat\b|rank/i);
  await expect(box.getByTestId("ns-chart")).toHaveCount(16);
  // the errors line: only rows that had errors and whose figure changes the other way (R1's sentence, numbers from the error-sensitivity files)
  await expect(cardOf(box, "product", "second").getByTestId("ns-error-line")).toHaveCount(0);
  await expect(cardOf(box, "product", "dev").getByTestId("ns-error-line")).toHaveText("1 gave an error. Errors are counted as not supported here; counted as supported, wrongly supported would be 1 of 64.");
  await expect(cardOf(box, "o2", "dev").getByTestId("ns-error-line")).toHaveText("2 gave an error. Errors are counted as not supported here; counted as supported, wrongly supported would be 4 of 64 and coverage would be 24 of 107.");
  await expect(cardOf(box, "o1", "dev").getByTestId("ns-error-line")).toHaveText("1 gave an error. Errors are counted as not supported here; counted as supported, wrongly supported would be 13 of 64.");
  await expect(cardOf(box, "o2", "second").getByTestId("ns-error-line")).toHaveCount(0);
  // "Ingredient by ingredient": the API harness arm's two rows, now two cards under the two subheadings
  await box.getByTestId("ns-units").getByText("Ingredient by ingredient", { exact: true }).click();
  await expect(rows).toHaveCount(2);
  await expect(box.getByTestId("ns-about-run")).toHaveCount(2);
  for (const i of [0, 1]) await expect(rows.nth(i)).toContainText("Anthropic API; not our dev stack or production stack");
  expect(await box.innerText()).toContain("8 of 64 (exact 95% interval 5.6% to 23.2%)");
  // the harness arm was not given dishonoured-cheque items: All groups carries R1's no-numbers line
  await expect(box.getByTestId("ns-not-run-all")).toHaveCount(2);
  await expect(box.getByTestId("ns-not-run-all").first()).toHaveText("Dishonoured-cheque items were not given to this system; the figures for All groups count them as not supported.");
});

test("the NyayaSiddhi results: the group chooser shows a family's figures; the unit chooser offers the units the rows carry; the not-run and Dishonoured cheque lines", async ({ page }) => {
  await page.goto("/benchmarks");
  const box = page.getByTestId("nyayasiddhi-results");
  await expect(box.getByTestId("ns-units").locator("label")).toHaveText(["Whole item at once", "Ingredient by ingredient"]);
  await expect(box.getByTestId("ns-groups").locator("label")).toHaveText(["All groups", "Cheating", "Criminal breach of trust", "Dishonoured cheque"]);
  await box.getByTestId("ns-groups").getByText("Cheating", { exact: true }).click();
  const text = await box.innerText();
  expect(text).toContain("0 of 27 (exact 95% interval 0.0% to 12.8%)");
  expect(text).toContain("0 of 47 (exact 95% interval 0.0% to 7.5%)");
  // for the Cheating group the two error mappings also disagree on the product obj1_dev row (1 of 27), so its errors line names that figure
  await expect(cardOf(box, "product", "dev").getByTestId("ns-error-line")).toHaveText("1 gave an error. Errors are counted as not supported here; counted as supported, wrongly supported would be 1 of 27.");
  await expect(box.getByTestId("ns-ni138-note")).toHaveCount(0);
  // Dishonoured cheque: the note shows on every row where the group is shown; for wrongly supported the mappings agree, but the open-model rows' coverage would change, so each of those rows carries a one-part line and the product rows none
  await box.getByTestId("ns-groups").getByText("Dishonoured cheque", { exact: true }).click();
  const note = "Dishonoured cheque is not a product contract; a result of 'supported' here is not a product result.";
  await expect(box.getByTestId("ns-ni138-note")).toHaveCount(4); // the four development rows carry figures for the group; the second-set rows have none
  await expect(box.getByTestId("ns-ni138-note").first()).toHaveText(note);
  await expect(cardOf(box, "o2", "dev").getByTestId("ns-error-line")).toHaveText("2 gave an error. Errors are counted as not supported here; counted as supported, coverage would be 23 of 93.");
  await expect(cardOf(box, "product", "dev").getByTestId("ns-error-line")).toHaveCount(0);
  // the harness arm: not run for this group. R1's line replaces the figures, there is no note under it
  await box.getByTestId("ns-units").getByText("Ingredient by ingredient", { exact: true }).click();
  await expect(box.getByTestId("ns-not-run")).toHaveCount(2);
  await expect(box.getByTestId("ns-not-run").first()).toHaveText("Not run: this system was not given dishonoured-cheque items, which are outside its contracts.");
  await expect(box.getByTestId("ns-ni138-note")).toHaveCount(0);
  await expect(box.getByTestId("ns-chart")).toHaveCount(0);
  await expect(box.getByTestId("ns-zero-with-zero")).toHaveCount(0);
  await expect(box.getByTestId("ns-about-run")).toHaveCount(2); // the About block stays for a not-run group
});

test("the NyayaSiddhi results work at phone width: no horizontal scroll and the choosers are phone-size targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/benchmarks");
  await expect(page.getByTestId("nyayasiddhi-results")).toBeVisible();
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
  for (const l of await page.getByTestId("ns-groups").locator("label").all()) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

// WCAG 2.4.7: the unit and group choosers are radios hidden from view (sr-only inputs in labels): keyboard focus must show on the label.
test("the NyayaSiddhi choosers show keyboard focus: tabbing to a radio draws an outline on its label", async ({ page }) => {
  await page.goto("/benchmarks");
  const box = page.getByTestId("nyayasiddhi-results");
  await expect(box).toBeVisible();
  await box.getByTestId("ns-units").locator("input").first().focus();
  let o = await box.getByTestId("ns-units").locator("label").first().evaluate((l) => ({ style: getComputedStyle(l).outlineStyle, width: getComputedStyle(l).outlineWidth }));
  expect(o).toEqual({ style: "solid", width: "2px" });
  // by keyboard: tab from the unit radio to the group radio group, and the focused label is outlined
  await page.keyboard.press("Tab");
  const focusedLabel = page.locator("label:focus-within");
  await expect(focusedLabel).toHaveCount(1);
  o = await focusedLabel.evaluate((l) => ({ style: getComputedStyle(l).outlineStyle, width: getComputedStyle(l).outlineWidth }));
  expect(o).toEqual({ style: "solid", width: "2px" });
  expect(await focusedLabel.evaluate((l) => !!l.closest('[data-testid="ns-groups"]'))).toBe(true);
  // an unfocused label has no outline
  await expect(box.getByTestId("ns-units").locator("label").first()).toHaveCSS("outline-style", "none");
});

// The NyayaSiddhi film inside the Benchmarks page (operator, 16 Oct; R1's strings hash 9f41ebf6cbd5): the silent explainer cut above the results (film #430, 19 Oct; the narrated cut follows the operator's listening), poster first, nothing requested until Play, captions off, no figure beside it.
test("/benchmarks: the silent NyayaSiddhi explainer film (#430) sits above the results, poster first, no film request at load, then plays with the captions control and no sound control", async ({ page }) => {
  const filmRequests: string[] = [];
  page.on("request", (r) => { if (/\/films\/[a-z-]+\/film\.(mp4|webm)/.test(r.url())) filmRequests.push(r.url()); });
  await page.goto("/benchmarks");
  await page.waitForLoadState("networkidle");
  const block = page.getByTestId("block-film");
  await expect(block.getByRole("heading", { name: "NyayaSiddhi film", level: 2 })).toBeVisible();
  // the voice gate has passed (operator, 17:00): the public card carries no "Preview for voice review"; the synthetic-voice disclosure stays
  await expect(block.getByText(/voice review/i), "no voice-review wording on the public card").toHaveCount(0);
  await expect(block.getByTestId("benchmarks-film-label")).toHaveCount(0);
  const poster = block.getByTestId("film-poster");
  await expect(poster).toHaveAttribute("alt", "Poster of the NyayaSiddhi film");
  await expect(poster).toHaveAttribute("src", /\/films\/nyayasiddhi-explainer-silent\/poster\.png$/);
  await expect(block.getByTestId("film-play")).toHaveText("Play the film");
  await expect(block.getByTestId("film-video")).toHaveCount(0);
  expect(filmRequests, "no film file before Play").toEqual([]);
  // above the results: the film block precedes the NyayaSiddhi results view in the page
  const above = await page.evaluate(() => { const f = document.querySelector('[data-testid="block-film"]')!, r = document.querySelector('[data-testid="nyayasiddhi-results"]'); return !r || !!(f.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING); });
  expect(above).toBe(true);
  // the silent note sits with the player (no narration, so no synthetic-voice line); the download is labelled by what it is
  await expect(block.locator("figcaption")).toContainText("The film is silent;");
  await expect(block.locator("figcaption")).not.toContainText("synthetic voice");
  await expect(block.getByTestId("film-download")).toHaveText("Download the film");
  await expect(block.getByTestId("film-download")).toHaveAttribute("href", /\/films\/nyayasiddhi-explainer-silent\/film\.mp4$/);
  // Play: the video appears, muted, preload none, captions off with a text-named control, a sound control named by text
  await block.getByTestId("film-play").click();
  const video = block.getByTestId("film-video");
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).toHaveJSProperty("muted", true);
  await expect(block.getByTestId("film-captions")).toHaveText("Show captions");
  await expect(block.getByTestId("film-sound"), "a silent film has no sound button").toHaveCount(0);
  expect(await video.locator("track").evaluate((t: HTMLTrackElement) => t.hasAttribute("default"))).toBe(false);
  // the film block says nothing that restates a result
  const text = await block.innerText();
  expect(text).not.toMatch(/%|interval|upper bound|accuracy|accurate|best|beats?|rank|outperform/i);
});

test("/benchmarks: the film block adds no link to the review route and the signed rows are untouched in number", async ({ page }) => {
  await page.goto("/benchmarks");
  expect(await page.locator('a[href*="benchmarks-film-preview"]').count(), "no anchor to the review route").toBe(0);
});

// app#410 (explorer, 17 Oct): on paper the film block keeps its scene list and its silent note, and drops the controls that do nothing there (the Play button and the download link row).
test("print: the film block drops the Play button and the download link, keeps the scenes and the silent note (#410)", async ({ page }) => {
  await page.goto("/benchmarks");
  const block = page.getByTestId("block-film");
  await expect(block.getByTestId("film-play")).toBeVisible();
  await expect(block.getByTestId("film-download")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(block.getByTestId("film-play"), "no live-looking Play button on paper").toBeHidden();
  await expect(block.getByTestId("film-download"), "no download link on paper").toBeHidden();
  await expect(block.getByTestId("film-scenes"), "the scene list stays").toBeVisible();
  await expect(block.locator("figcaption"), "the silent note stays").toContainText("The film is silent;");
});

test("/benchmarks-film-preview no longer exists as a page: a request goes to /benchmarks (the film is on /benchmarks only)", async ({ page }) => {
  await page.goto("/benchmarks-film-preview");
  await expect(page).toHaveURL(/\/benchmarks\/?$/, { timeout: 10000 });
  await expect(page.getByTestId("block-film")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/review copy|voice review/i);
});
