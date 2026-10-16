import { expect, test } from "./support/engineTest";

// Deploy-26 a11y fixes (Track B's live read of d25, LIVE_D25_STATES_390): (1) tabbing through the /benchmarks radio groups must not scroll the WINDOW (the sr-only inputs sat outside main's scrolling box), and
// the focused label must be inside main's visible area; (2) the focus ring inside the dark navy "Start a screening" panel must reach 3:1 against the panel in the light theme (it was the light-theme accent, 1.82:1).
const luminance = (rgb: string): number => {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string): number => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`/benchmarks at ${viewport.width} px: Tab through the radio groups never scrolls the window, and the focused label is inside main's visible area`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/benchmarks");
    const radios = page.locator('main input[type="radio"]');
    const n = await radios.count();
    test.skip(n === 0, "no signed rows on this build: no radio groups");
    let seen = 0;
    for (let i = 0; i < 120 && seen < n; i++) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const a = document.activeElement as HTMLInputElement | null;
        if (!a || a.type !== "radio") return null;
        const label = a.closest("label")!.getBoundingClientRect();
        const main = document.getElementById("main")!.getBoundingClientRect();
        return { scrollY: window.scrollY, inside: label.top >= main.top - 1 && label.bottom <= main.bottom + 1 && label.height > 0 };
      });
      if (!state) continue;
      seen += 1;
      expect(state.scrollY, "the window did not scroll").toBe(0);
      expect(state.inside, "the focused label is inside main's visible area").toBe(true);
    }
    expect(seen, "Tab reached the radios").toBeGreaterThan(0);
  });
}

test("the dark start panel's focus ring reaches 3:1 against the panel in the light theme", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => { try { localStorage.setItem("pravrudhi-theme", "light"); } catch { /* storage unavailable */ } });
  await page.goto("/screening");
  const panel = page.getByTestId("start-panel");
  await expect(panel).toBeVisible();
  const bg = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
  for (const target of [panel.getByTestId("start-panel-example"), panel.getByTestId("start-panel-own"), panel.getByRole("button", { name: "Close this panel" }), panel.getByTestId("start-panel-data-link")]) {
    await target.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab"); // keyboard modality, so :focus-visible applies
    const ring = await target.evaluate((el) => ({ color: getComputedStyle(el).outlineColor, width: getComputedStyle(el).outlineWidth, style: getComputedStyle(el).outlineStyle }));
    expect(ring.style).toBe("solid");
    expect(ring.width).toBe("2px");
    expect(ratio(ring.color, bg), `ring ${ring.color} on panel ${bg}`).toBeGreaterThanOrEqual(3);
  }
});
