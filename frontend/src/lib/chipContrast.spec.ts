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

// the first :root block is the dark theme; the second plain block with --color-bg #f7f6f2 is the light theme
function theme(startMarker: RegExp): Record<string, string> {
  const m = startMarker.exec(css)!;
  const block = css.slice(m.index, css.indexOf("}", m.index));
  const out: Record<string, string> = {};
  for (const t of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) out[t[1]] = t[2];
  return out;
}
const THEMES: Record<string, Record<string, string>> = {
  dark: theme(/--color-bg:\s*#0f1114/),
  light: theme(/--color-bg:\s*#f7f6f2/),
};

test("each status chip's text on its own derived fill meets AA in both themes", () => {
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
