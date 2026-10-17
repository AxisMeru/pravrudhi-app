import { expect, test } from "./support/engineTest";

// app#404 (forced colours) and app#405 (reduced motion): media-query emulation against the live pages. Runs on both layouts (the nav's current item and the drawer exist in both; layout B adds the Reference chevron).
const CURRENT = '#primary-navigation nav a[aria-current]';

test("forced colours: the current nav item is marked by an outline and an underline, not by its tint alone (#404)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/guide");
  const marks = () => page.locator(CURRENT).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, underline: s.textDecorationLine.includes("underline") };
  });
  await page.emulateMedia({ forcedColors: "none" });
  expect(await marks(), "no extra marker outside forced colours").toMatchObject({ outlineStyle: "none", underline: false });
  await page.emulateMedia({ forcedColors: "active" });
  expect(await marks(), "forced colours: a 2 px system-colour outline and an underline on the current item").toMatchObject({ outlineStyle: "solid", outlineWidth: "2px", underline: true });
  const idle = await page.locator('#primary-navigation nav a:not([aria-current])').first().evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(idle, "an inactive item stays plain").not.toContain("underline");
});

test("reduced motion: the drawer slide, the nav links' fade and (layout B) the Reference chevron do not animate (#405)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/guide");
  const durations = () => page.evaluate(() => {
    const d = (el: Element | null) => (el ? getComputedStyle(el).transitionDuration : null);
    return { drawer: d(document.querySelector("#primary-navigation")), link: d(document.querySelector("#primary-navigation nav a")), chevron: d(document.querySelector('[data-testid="mb-reference-chevron"]')) };
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const before = await durations();
  expect(before.drawer, "the drawer slides (0.2 s) when motion is allowed").toBe("0.2s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const after = await durations();
  expect(after.drawer, "no drawer transition").toBe("0s");
  expect(after.link, "no link fade").toBe("0s");
  if (before.chevron !== null) {
    expect(before.chevron, "the chevron turns (0.15 s) when motion is allowed").toBe("0.15s");
    expect(after.chevron, "no chevron transition").toBe("0s");
  }
});
