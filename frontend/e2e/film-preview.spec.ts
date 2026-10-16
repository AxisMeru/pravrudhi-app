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
    await expect(film.getByTestId("film-captions")).toHaveText("Show captions"); // captions are OFF until asked
    await expect(film.getByTestId("film-video")).toHaveJSProperty("muted", true);
    expect(await film.locator("track").evaluate((t: HTMLTrackElement) => t.hasAttribute("default"))).toBe(false);
    // a silent cut has no sound button and says it is silent (R1's line, above the player)
    await expect(film.getByTestId("film-sound")).toHaveCount(0);
    await expect(page.getByTestId(`film-${id}`).locator("xpath=preceding-sibling::p[@data-testid='silent-label']")).toHaveText("Silent cut: no voice. While it plays, press Show captions to see the scene titles.");
  }
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
  for (const b of await page.locator("main button, main a").all()) expect((await b.boundingBox())!.height, await b.innerText()).toBeGreaterThanOrEqual(24);
});

test("the two narrated previews are on the route, each labelled Preview for voice review, poster first, captions on, the sound button turns the voice on", async ({ page }) => {
  await page.goto("/benchmarks-film-preview");
  for (const id of ["nyayasiddhi-narrated", "nyayasiddhi-firm-narrated"]) {
    const sec = page.getByTestId(`voice-${id}`);
    await expect(sec.getByTestId("voice-preview-label")).toHaveText("Preview for voice review");
    await expect(sec.locator("track")).toHaveAttribute("src", new RegExp(`/films/${id}/captions\\.vtt$`));
    await expect(sec.getByTestId("film-sound")).toHaveText("Turn on sound");
    await expect(sec.getByTestId("film-video")).toHaveJSProperty("autoplay", false);
    await expect(sec.getByTestId("film-captions")).toHaveText("Show captions");
    await expect(sec.getByTestId("silent-label")).toHaveCount(0);
    // ONE click: muted off, volume up, and the film plays (a paused film is started in the same click)
    await sec.getByTestId("film-sound").click();
    const video = sec.getByTestId("film-video");
    await expect(video).toHaveJSProperty("muted", false);
    await expect(video).toHaveJSProperty("volume", 1);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
    await expect(sec.getByTestId("film-sound")).toHaveText("Turn off sound");
    // the native control's speaker (simulated by the element's own muted flag) moves the label with it
    await video.evaluate((v: HTMLVideoElement) => { v.muted = true; });
    await expect(sec.getByTestId("film-sound")).toHaveText("Turn on sound");
    await video.evaluate((v: HTMLVideoElement) => { v.muted = false; });
    await expect(sec.getByTestId("film-sound")).toHaveText("Turn off sound");
    await video.evaluate((v: HTMLVideoElement) => v.pause());
  }
});

test("no page of the site links to the review route", async ({ page }) => {
  for (const path of ["/benchmarks", "/guide", "/demo", "/technical-film"]) {
    await page.goto(path);
    await expect(page.locator('a[href*="benchmarks-film-preview"]')).toHaveCount(0);
  }
});
