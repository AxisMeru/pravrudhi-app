import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// AA for both themes, computed from the colour values in globals.css itself (no copy of the numbers here): text pairs need 4.5:1, the borders of controls need 3:1 against
// the page. The derived tints are mixed here the same way the CSS mixes them (color-mix in srgb), so a status text on its own tint is checked too.
const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

type Tokens = Record<string, string>;
function block(open: string): Tokens {
  const start = css.indexOf(open);
  assert.ok(start >= 0, `block ${open} not found`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Tokens = {};
  for (const m of body.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}
const DARK = block("@theme {");
const LIGHT = block(':root[data-theme="light"] {');
const SYSTEM_LIGHT = block(":root:not([data-theme]) {");

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export function ratio(a: string, b: string): number { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
function mix(fg: string, pct: number, bg: string): string {
  const a = rgb(fg), b = rgb(bg);
  return "#" + a.map((v, i) => Math.round((v * pct + b[i] * (100 - pct)) / 100).toString(16).padStart(2, "0")).join("");
}

const TEXT_ON_PAGE = ["text", "text-dim", "accent", "warn", "danger", "ok", "info", "note"];
const GROUNDS = ["bg", "surface", "surface-raised"];
const STATUS = ["warn", "danger", "ok", "info", "note"];

for (const [name, t] of [["dark", DARK], ["light", LIGHT]] as const) {
  test(`${name}: every text token reaches 4.5:1 on the page, the card and the raised card`, () => {
    for (const fg of TEXT_ON_PAGE) for (const bg of GROUNDS) {
      const r = ratio(t[fg], t[bg]);
      assert.ok(r >= 4.5, `${name}: ${fg} ${t[fg]} on ${bg} ${t[bg]} is ${r.toFixed(2)}:1`);
    }
  });
  test(`${name}: a status text on its own tint (12% over the card) reaches 4.5:1`, () => {
    for (const s of STATUS) {
      const tint = mix(t[s], 12, t.surface);
      const r = ratio(t[s], tint);
      assert.ok(r >= 4.5, `${name}: ${s} on its tint ${tint} is ${r.toFixed(2)}:1`);
    }
  });
  test(`${name}: the text on an accent-filled button reaches 4.5:1 (the old mint button with white text was 1.6:1)`, () => {
    const r = ratio(t["on-accent"], t.accent);
    assert.ok(r >= 4.5, `${name}: on-accent ${t["on-accent"]} on accent ${t.accent} is ${r.toFixed(2)}:1`);
  });
  test(`${name}: the border of a control reaches 3:1 against the page`, () => {
    const r = ratio(t["control-border"], t.bg);
    assert.ok(r >= 3, `${name}: control-border ${t["control-border"]} on bg ${t.bg} is ${r.toFixed(2)}:1`);
  });
}

test('"system" follows the light set exactly: the prefers-color-scheme block carries the same values as data-theme="light"', () => {
  assert.deepEqual(SYSTEM_LIGHT, LIGHT);
});

test("every token the dark theme defines is defined in the light theme too (and the reverse)", () => {
  assert.deepEqual(Object.keys(LIGHT).sort(), Object.keys(DARK).sort());
});
