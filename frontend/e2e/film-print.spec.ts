import { expect, test } from "./support/engineTest";

// app#414 (Track B's #412 probe): on paper a <video> prints as a blank box with the browser's native controls, so a played film (and the video-first pages) print the film's poster instead.
for (const path of ["/guide", "/how-it-was-built", "/technical-film"]) {
  test(`print: ${path} shows the film's poster, not a video box`, async ({ page }) => {
    await page.goto(path);
    const video = page.getByTestId("film-video");
    await expect(video).toBeVisible();
    await expect(page.getByTestId("film-poster-print"), "the poster is not on screen").toBeHidden();
    const title = await video.getAttribute("aria-label");
    await expect(page.getByRole("img", { name: title ?? "" }), "no second, image-named copy of the film title on screen (the print poster is display:none, so it is not in the accessibility tree)").toHaveCount(0);
    await page.emulateMedia({ media: "print" });
    await expect(video, "no video box on paper").toBeHidden();
    const poster = page.getByTestId("film-poster-print");
    await expect(poster).toBeVisible();
    await expect(poster).toHaveAttribute("src", /\/poster\.png$/);
    await expect(poster, "decorative: the title is in the figcaption").toHaveAttribute("alt", "");
    await expect(page.locator("figure figcaption").first(), "the figcaption still carries the film's title in print").toContainText(title ?? "x");
    await page.emulateMedia({ media: "screen" });
    await expect(video).toBeVisible();
  });
}

test("print: a started film on /benchmarks prints its poster too (after Play)", async ({ page }) => {
  await page.goto("/benchmarks");
  await page.getByTestId("film-play").click();
  const video = page.getByTestId("film-video");
  await expect(video).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(video).toBeHidden();
  await expect(page.getByTestId("film-poster-print")).toBeVisible();
  await expect(page.getByTestId("film-play")).toHaveCount(0);
});

// app#403 item 10 (Track B): the hidden print poster is lazy, so the screen load makes no second poster request; printing still loads it (Chromium loads lazy images when it prints).
test("the print poster is lazy: one poster request on screen, and it still loads for print (#403 item 10)", async ({ page }) => {
  const posters: string[] = [];
  page.on("request", (r) => { if (/\/films\/[a-z-]+\/poster\.png/.test(r.url())) posters.push(r.url()); });
  await page.goto("/how-it-was-built");
  await page.waitForLoadState("networkidle");
  const img = page.getByTestId("film-poster-print");
  await expect(img).toHaveAttribute("loading", "lazy");
  expect(posters.length, "at most one poster request at load (the video's own poster; the print copy adds none)").toBeLessThanOrEqual(1);
  await page.pdf(); // printing loads lazy images
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), { message: "the print poster loaded for print" }).toBe(true);
});
