// This is the product edition of Pravrudhi. The interface offers only product-facing pages;
// the engine refuses all studio-improvement surfaces entirely (src/pravrudhi/api/roles.py::gate).

import { strict as assert } from "node:assert";
import test from "node:test";

import { PALETTE_PAGES, STUDIO_ONLY_PAGES, pagesFor } from "./palette";

test("the product serves all its configured pages", () => {
  const all = pagesFor(false);
  assert.equal(all.length, PALETTE_PAGES.length);
});

test("studio-only pages are not defined in this build", () => {
  // STUDIO_ONLY_PAGES should be empty because this is the product edition.
  assert.equal(STUDIO_ONLY_PAGES.size, 0);
});

test("the product keeps what belongs to its own user", () => {
  // All pages in a product-only build should be user-facing, not self-improvement surfaces.
  const ids = new Set(PALETTE_PAGES.map((p) => p.id));
  for (const kept of ["start", "objectives", "progress", "memory", "chat", "nyaya", "runs", "models", "catalogue", "settings", "install"]) {
    assert.ok(ids.has(kept), `${kept} vanished from the product pages`);
  }
});
