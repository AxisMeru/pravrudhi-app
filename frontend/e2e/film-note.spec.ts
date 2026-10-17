import { expect, test } from "./support/engineTest";
import { isLayoutB } from "./support/layout";

// app#417 (R1, 17 Oct): the guide film's scene list still says "The live Matter workspace: ..." (it describes the recorded frames; the text and the film files are frozen). On layout B ONE line under the list says the film was recorded on the earlier layout; the live layout has no such line.
const SCENE = "The live Matter workspace: the complaint split into numbered facts, the offence ticked.";
test("the film's scene text is byte-unchanged; the earlier-layout line is on layout B only (#417)", async ({ page }) => {
  await page.goto("/guide");
  const scenes = page.getByTestId("film-scenes").first();
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
