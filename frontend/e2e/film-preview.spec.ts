import { expect, test } from "./support/engineTest";

// The unlisted NyayaSiddhi film review route (#948): noindex, linked from nowhere, phone width, the player with its captions track.
test("/benchmarks-film-preview: noindex, the three silent cuts with their captions tracks, muted, captions on, no horizontal scroll at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/benchmarks-film-preview");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  for (const id of ["nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm"]) {
    const film = page.getByTestId(`film-${id}`);
    await expect(film).toBeVisible();
    await expect(film.getByTestId("film-video")).toHaveAttribute("poster", new RegExp(`/films/${id}/poster\\.png$`));
    await expect(film.locator("track")).toHaveAttribute("src", new RegExp(`/films/${id}/captions\\.vtt$`));
    await expect(film.getByTestId("film-captions")).toHaveText("Hide captions");
    await expect(film.getByTestId("film-video")).toHaveJSProperty("muted", true);
  }
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
  for (const b of await page.locator("main button, main a").all()) expect((await b.boundingBox())!.height, await b.innerText()).toBeGreaterThanOrEqual(24);
});

test("no page of the site links to the review route", async ({ page }) => {
  for (const path of ["/benchmarks", "/guide", "/demo", "/technical-film"]) {
    await page.goto(path);
    await expect(page.locator('a[href*="benchmarks-film-preview"]')).toHaveCount(0);
  }
});
