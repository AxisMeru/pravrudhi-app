import { expect, test } from "./support/engineTest";

// The user-guide film on /guide (Studio's guide-v2, prabhasa-nyaya#1025/#1026; R1 signed the words c586e4d433d0). Built in only with NEXT_PUBLIC_GUIDE_FILM_V2=1, set at the deploy after app #480 (its sample matter button) is live in production.
// The marker GUIDE_FILM_V2_BUILD says which arm this build is: OFF keeps the earlier film, ON shows the narrated default.
const ON = process.env.GUIDE_FILM_V2_BUILD === "1";

test("/guide: without the flag the page keeps the earlier film (client), poster first", async ({ page }) => {
  test.skip(ON, "flag-ON build");
  await page.goto("/guide");
  await expect(page.getByTestId("film-client")).toBeVisible();
  await expect(page.locator('[data-testid^="film-guide-v2"]')).toHaveCount(0);
});

test("/guide: with the flag the narrated guide-v2 film is the default: poster first, no film request at load, then plays with sound on and a visible Mute", async ({ page }) => {
  test.skip(!ON, "flag-OFF build");
  const filmRequests: string[] = [];
  page.on("request", (r) => { if (/\/films\/[a-z0-9-]+\/film\.(mp4|webm)/.test(r.url())) filmRequests.push(r.url()); });
  await page.goto("/guide");
  await page.waitForLoadState("networkidle");
  const fig = page.getByTestId("film-guide-v2");
  await expect(fig).toBeVisible();
  await expect(fig.getByTestId("film-poster")).toHaveAttribute("src", /\/films\/guide-v2\/poster\.png$/);
  await expect(fig.getByTestId("film-video")).toHaveCount(0);
  expect(filmRequests, "no film file before Play").toEqual([]);
  await expect(fig.getByTestId("film-download")).toHaveAttribute("href", /\/films\/guide-v2\/film\.mp4$/);
  await fig.getByTestId("film-play").click();
  const video = fig.getByTestId("film-video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("preload", "none");
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted), "sound on at Play").toBe(false);
  await expect(fig.getByTestId("film-mute")).toHaveText("Mute");
  expect(await video.evaluate((v: HTMLVideoElement) => v.textTracks[0]?.mode), "captions off until asked").toBe("disabled");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow, "no sideways scroll").toBe(false);
});
