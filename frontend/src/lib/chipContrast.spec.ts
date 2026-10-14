import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// P14: the status chips' own fill/text pairs. A chip is the token colour on a 12% mix of itself over the surface (globals.css), so the pair is derived, not a token; this
// computes the WCAG contrast of each derived pair in both themes and holds it at AA (4.5:1) for text.
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (rgb: number[]) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg: number[], bg: number[], pct: number) => fg.map((c, i) => c * pct + bg[i] * (1 - pct));

// EVERY colour block of globals.css that defines the full token set is a theme (dark base, light, the "System" light under prefers-color-scheme, the high-contrast block): all of them are held to AA,
// not just the first two (R2, 14 Oct). The dark and the light themes must also be distinct, so swapping a marker can never leave the test green by checking the same block twice.
const NEED = ["bg", "surface", "text-dim", "ok", "warn", "info", "note", "danger"];
function allThemes(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let n = 0;
  for (const m of css.matchAll(/\{([^{}]*)\}/g)) {
    const t: Record<string, string> = {};
    for (const x of m[1].matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) t[x[1]] = x[2];
    if (NEED.every((k) => t[k])) out[`block${++n} (bg ${t.bg}, surface ${t.surface})`] = t;
  }
  return out;
}
const THEMES = allThemes();

test("globals.css defines at least the dark theme and a light theme, with different surfaces", () => {
  const surfaces = new Set(Object.values(THEMES).map((t) => t.surface.toLowerCase()));
  assert.ok(Object.keys(THEMES).length >= 3, `found ${Object.keys(THEMES).length} theme blocks`);
  assert.ok(surfaces.size >= 2, "dark and light surfaces must differ");
  assert.ok(Object.values(THEMES).some((t) => t.bg.toLowerCase() === "#0f1114"), "the dark theme block is present");
  assert.ok(Object.values(THEMES).some((t) => t.bg.toLowerCase() === "#f7f6f2"), "the light theme block is present");
});

test("each status chip's text on its own derived fill meets AA in every theme block", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    for (const tone of ["ok", "warn", "info", "note", "danger"]) {
      const text = hex(t[tone]);
      const fill = mix(text, hex(t.surface), 0.12);
      assert.ok(ratio(text, fill) >= 4.5, `${name} ${tone}: ${ratio(text, fill).toFixed(2)}:1`);
    }
    // the danger tone (error lines) is plain text on the surface and on the page background, not a derived fill: held at AA too (Studio and R2, 14 Oct)
    for (const ground of ["surface", "bg"]) assert.ok(ratio(hex(t.danger), hex(t[ground])) >= 4.5, `${name} danger on ${ground}: ${ratio(hex(t.danger), hex(t[ground])).toFixed(2)}:1`);
    // dim text on the plain surface (the neutral chip and the row notes)
    assert.ok(ratio(hex(t["text-dim"]), hex(t.surface)) >= 4.5, `${name} dim on surface`);
  }
});
