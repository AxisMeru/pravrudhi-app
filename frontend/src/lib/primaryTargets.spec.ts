import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// #143 (canvas C1-C3, 44 px primary targets): every accent-filled primary button on the product pages carries min-h-11 on every width.
// Static source scan: the class is on the element that has the accent fill, so no build is needed to see a miss.
const root = join(__dirname, "..", "..");
const PAGES = ["src/app/matters/page.tsx", "src/app/citations/page.tsx", "src/app/demo/page.tsx", "src/app/settings/page.tsx", "src/app/screening/page.tsx"];

test("accent-filled primary buttons and links on the product pages are at least 44 px tall (min-h-11)", () => {
  for (const f of PAGES) {
    const src = readFileSync(join(root, f), "utf8");
    const filled = [...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2]).filter((c) => /\bbg-\[var\(--color-accent\)\]/.test(c) && /\btext-\[var\(--color-on-accent\)\]/.test(c));
    assert.ok(filled.length > 0, `${f}: expected at least one accent-filled control`);
    for (const c of filled) assert.match(c, /(^|\s)min-h-11(\s|$)/, `${f}: ${c.slice(0, 80)}`);
  }
});
