import { expect, test } from "./support/engineTest";

// app#414 (Track B's #412 probe): on paper a <video> prints as a blank box with the browser's native controls, so a played film (and the video-first pages) print the film's poster instead.
for (const path of ["/guide", "/how-it-was-built", "/technical-film"]) {
  test(`print: ${path} shows the film's poster, not a video box`, async ({ page }) => {
    await page.goto(path);
    const video = page.getByTestId("film-video");
    await expect(video).toBeVisible();
    await expect(page.getByTestId("film-poster-print"), "the poster is not on screen").toBeHidden();
    await page.emulateMedia({ media: "print" });
    await expect(video, "no video box on paper").toBeHidden();
    const poster = page.getByTestId("film-poster-print");
    await expect(poster).toBeVisible();
    await expect(poster).toHaveAttribute("src", /\/poster\.png$/);
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
