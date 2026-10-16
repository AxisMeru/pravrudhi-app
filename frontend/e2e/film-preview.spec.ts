import { expect, test } from "./support/engineTest";

// The unlisted NyayaSiddhi film review route (#948): noindex, linked from nowhere, phone width, the player with its captions track.
test("/benchmarks-film-preview: noindex, the player and its captions track, no horizontal scroll at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/benchmarks-film-preview");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByTestId("film-nyayasiddhi")).toBeVisible();
  await expect(page.getByTestId("film-video")).toHaveAttribute("poster", /\/films\/nyayasiddhi\/poster\.png$/);
  await expect(page.locator('[data-testid="film-video"] track')).toHaveAttribute("src", /\/films\/nyayasiddhi\/captions\.vtt$/);
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
  // captions ON from the start; the button offers to hide them; muted
  await expect(page.getByTestId("film-captions")).toHaveText("Hide captions");
  await expect(page.getByTestId("film-video")).toHaveJSProperty("muted", true);
  for (const b of await page.locator("main button, main a").all()) expect((await b.boundingBox())!.height, await b.innerText()).toBeGreaterThanOrEqual(24);
});

test("no page of the site links to the review route", async ({ page }) => {
  for (const path of ["/benchmarks", "/guide", "/demo", "/technical-film"]) {
    await page.goto(path);
    await expect(page.locator('a[href*="benchmarks-film-preview"]')).toHaveCount(0);
  }
});
