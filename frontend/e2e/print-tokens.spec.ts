import { expect, test } from "./support/engineTest";

// #286: a printed page always uses the print tokens, whatever the screen theme: dark, light, and System (no stored choice) with an OS that is light or dark.
const CASES: Array<[string, "light" | "dark", string | null]> = [
  ["theme dark, OS dark", "dark", "dark"], ["theme light, OS dark", "dark", "light"], ["System, OS light", "light", null], ["System, OS dark", "dark", null],
];
for (const [name, scheme, theme] of CASES) {
  test(`print tokens in print media: ${name}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript((t) => { try { if (t) window.localStorage.setItem("pravrudhi-theme", t); else window.localStorage.removeItem("pravrudhi-theme"); } catch { /* storage unavailable */ } }, theme);
    await page.goto("/workflows");
    await page.emulateMedia({ colorScheme: scheme, media: "print" });
    const vals = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return { bg: s.getPropertyValue("--color-bg").trim(), text: s.getPropertyValue("--color-text").trim(), accent: s.getPropertyValue("--color-accent").trim(), warn: s.getPropertyValue("--color-warn").trim(), scheme: s.colorScheme }; });
    expect(vals.scheme).toBe("light");
    // the browser may hand back the minified form of a colour (#fff for #ffffff): compare the expanded value
    const full = (c: string) => (/^#[0-9a-f]{3}$/i.test(c) ? "#" + c.slice(1).split("").map((x) => x + x).join("") : c).toLowerCase();
    expect({ bg: full(vals.bg), text: full(vals.text), accent: full(vals.accent), warn: full(vals.warn) }).toEqual({ bg: "#ffffff", text: "#000000", accent: "#1f4e79", warn: "#7a4b00" });
  });
}
