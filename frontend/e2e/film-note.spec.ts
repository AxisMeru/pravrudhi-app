import { expect, test } from "./support/engineTest";
import { isLayoutB } from "./support/layout";
import guideV2 from "../public/films/guide-v2/manifest.json";
import guideV3 from "../public/films/guide-v3/manifest.json";

// With the narrated guide film on /guide (build flag NEXT_PUBLIC_GUIDE_FILM_V2=1, e2e marker GUIDE_FILM_V2_BUILD=1) the scene list is the guide-v2 film's, not the earlier film's: this spec then checks that list
// (each scene holds its signed strings verbatim) and keeps the earlier film's checks for the OFF arm.
const GUIDE_V2 = process.env.GUIDE_FILM_V2_BUILD === "1";

// app#417 (R1, 17 Oct): the guide film's scene list still says "The live Matter workspace: ..." (it describes the recorded frames; the text and the film files are frozen). On layout B ONE line under the list says the film was recorded on the earlier layout; the live layout has no such line.
const SCENE = "The live Matter workspace: the complaint split into numbered facts, the offence ticked.";
test("the film's scene text is byte-unchanged; the earlier-layout line is on layout B only (#417)", async ({ page }) => {
  await page.goto("/guide");
  const scenes = page.getByTestId("film-scenes").first();
  if (GUIDE_V2) {
    await expect(scenes).not.toContainText(SCENE);
    for (const sc of (process.env.GUIDE_FILM_V3_BUILD === "1" ? guideV3 : guideV2).scenes) await expect(scenes).toContainText(sc.text.split("\n")[0]);
    return;
  }
  await expect(scenes).toContainText(SCENE);
  const note = page.getByTestId("film-earlier-layout");
  if (await isLayoutB(page)) {
    await expect(note).toHaveCount(1);
    await expect(note).toHaveText("The film was recorded on the earlier layout, where this page was called Matter workspace.");
    const below = await page.evaluate(() => { const l = document.querySelector('[data-testid="film-scenes"] ol')!, n = document.querySelector('[data-testid="film-earlier-layout"]')!; return !!(l.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING); });
    expect(below, "the line follows the scene list").toBe(true);
  } else {
    await expect(note).toHaveCount(0);
  }
});
