import { expect, test } from "./support/engineTest";

// #251 (#253, #254, #256): the two motion films play INSIDE the app with the browser's own <video>: narrated but starting MUTED with a visible Turn on sound button, controls, captions OFF by default with a visible Show captions toggle, a Download the film link, nothing fetched until the visitor presses play, the poster first;
// under reduced motion the poster waits for the visitor's button. At 400 px and on a desktop the page does not scroll sideways. The only committed source is the H.264 MP4 (Interim lead, 15 Oct). Playwright's own Chromium cannot decode H.264, so the play step runs only where the browser says it can; the rest (source, poster, captions, preload, no fetch before play, layout) is checked everywhere.
const PAGES = [["/guide", "client"], ["/technical-film", "technical"]] as const;
const VIEWPORTS = [{ width: 400, height: 800 }, { width: 1280, height: 800 }];

for (const [path, id] of PAGES) for (const viewport of VIEWPORTS) {
  test(`${path} at ${viewport.width} px: the ${id} film plays in the page, starts muted, captions off until asked, downloadable, nothing fetched before play, no sideways scroll`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const filmRequests: string[] = [];
    page.on("request", (r) => { if (/\/films\/[a-z]+\/film\.mp4/.test(r.url())) filmRequests.push(r.url()); });
    await page.goto(path);
    const video = page.getByTestId(`film-${id}`).getByTestId("film-video");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("preload", "none");
    expect(await video.evaluate((v: HTMLVideoElement) => ({ controls: v.controls, muted: v.muted, hasAudioTrackInfo: v.defaultMuted }))).toMatchObject({ controls: true, muted: true });
    const poster = await video.getAttribute("poster");
    expect(poster, "a poster").toMatch(new RegExp(`/films/${id}/poster\\.png$`));
    expect((await page.request.get(poster!)).ok(), "the poster file is served").toBe(true);
    const track = await video.evaluate((v: HTMLVideoElement) => ({ n: v.textTracks.length, kind: v.textTracks[0]?.kind, mode: v.textTracks[0]?.mode }));
    expect(track, "captions are OFF by default").toMatchObject({ n: 1, kind: "captions", mode: "disabled" });
    expect(await video.locator("track").evaluate((t) => t.hasAttribute("default")), "the track carries no default attribute").toBe(false);
    const fig = page.getByTestId(`film-${id}`);
    await expect(fig.getByTestId("film-captions")).toHaveText("Show captions");
    await fig.getByTestId("film-captions").click();
    await expect(fig.getByTestId("film-captions")).toHaveText("Hide captions");
    expect(await video.evaluate((v: HTMLVideoElement) => v.textTracks[0].mode)).toBe("showing");
    await fig.getByTestId("film-captions").click();
    expect(await video.evaluate((v: HTMLVideoElement) => v.textTracks[0].mode)).toBe("disabled");
    // the sound: muted at the start (autoplay-safe), one visible button turns it on and off
    await expect(fig.getByTestId("film-sound")).toHaveText("Turn on sound");
    await fig.getByTestId("film-sound").click();
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
    await expect(fig.getByTestId("film-sound")).toHaveText("Turn off sound");
    await fig.getByTestId("film-sound").click();
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    // the same-origin MP4 can be downloaded
    const dl = fig.getByTestId("film-download");
    await expect(dl).toHaveText("Download the film");
    await expect(dl).toHaveAttribute("href", new RegExp(`/films/${id}/film\\.mp4$`));
    await expect(dl).toHaveAttribute("download", "");
    expect((await page.request.get((await dl.getAttribute("href"))!)).ok(), "the film file is served").toBe(true);
    expect(filmRequests, "no film bytes before the visitor presses play").toEqual([]);
    expect(await video.locator("source").evaluateAll((els) => els.map((e) => `${(e as HTMLSourceElement).type} ${(e as HTMLSourceElement).getAttribute("src")?.split("/").pop()}`))).toEqual(["video/mp4 film.mp4"]);
    // plays (muted, so a script may start it) wherever the browser decodes H.264
    const canPlay = await video.evaluate((v: HTMLVideoElement) => v.canPlayType('video/mp4; codecs="avc1.42E01E"') !== "");
    test.info().annotations.push({ type: "h264", description: canPlay ? "played" : "this Chromium cannot decode H.264: play step skipped" });
    if (canPlay) {
      await video.evaluate(async (v: HTMLVideoElement) => { await v.play(); });
      await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15000 }).toBeGreaterThan(0.4);
      await video.evaluate((v: HTMLVideoElement) => v.pause());
    }
    // the scene text is on the page as text
    await expect(page.getByTestId(`film-${id}`).getByTestId("film-scenes").locator("li").first()).toContainText("0:00");
    const over = await page.evaluate(() => { const m = document.querySelector("main")!; return { main: m.scrollWidth - m.clientWidth, doc: document.documentElement.scrollWidth - window.innerWidth }; });
    expect(over).toEqual({ main: 0, doc: 0 });
  });
}

test("reduced motion: the poster and a button, no video until the visitor asks; then the film is there", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/technical-film");
  await expect(page.getByTestId("film-poster")).toBeVisible();
  await expect(page.getByTestId("film-video")).toHaveCount(0);
  await page.getByTestId("film-play").click();
  await expect(page.getByTestId("film-video")).toBeVisible();
});

test("/demo links to the technical film page and to the film in the guide", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByTestId("demo-technical-film")).toHaveAttribute("href", /\/technical-film\/?$/);
  await expect(page.getByTestId("demo-guide-film")).toHaveAttribute("href", /\/guide\/?#film$/);
});

// #307/#308 (R1): the unsupported-browser text is readable on the black frame (it inherited the page's dark text: 1.32:1); the sound and captions buttons say their state in their label only (no aria-pressed, which would say it twice); under reduced motion the focus stays at the film.
test("#307: the video's fallback text has at least 4.5:1 contrast against the black frame", async ({ page }) => {
  await page.goto("/technical-film");
  const colour = await page.getByTestId("film-video").evaluate((v) => getComputedStyle(v).color);
  const [r, g, b] = colour.match(/\d+/g)!.map(Number);
  const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  expect((L + 0.05) / 0.05, `fallback text ${colour} on black`).toBeGreaterThanOrEqual(4.5);
});

test("#308: the sound and captions buttons flip their label and carry no aria-pressed", async ({ page }) => {
  await page.goto("/technical-film");
  const fig = page.getByTestId("film-technical");
  for (const id of ["film-sound", "film-captions"]) {
    await expect(fig.getByTestId(id)).not.toHaveAttribute("aria-pressed", /.*/);
    const before = await fig.getByTestId(id).innerText();
    await fig.getByTestId(id).click();
    await expect(fig.getByTestId(id)).not.toHaveAttribute("aria-pressed", /.*/);
    expect(await fig.getByTestId(id).innerText()).not.toBe(before);
  }
});

test("#308: under reduced motion, after Play the film the focus is on the film", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/technical-film");
  await page.getByTestId("film-play").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("film-video")).toBeFocused();
});
