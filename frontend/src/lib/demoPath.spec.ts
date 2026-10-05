import { strict as assert } from "node:assert";
import test from "node:test";

import { DEMO_HOME, DEMO_PATH_HREFS, offeredInDemoPath } from "./demoPath";
import { PALETTE_PAGES, pagesFor } from "./palette";

test("with the flag off every page is offered", () => {
  for (const p of PALETTE_PAGES) assert.equal(offeredInDemoPath(p.href, false), true, p.href);
});

test("with the flag on, only the demo path is offered, and the demo home is on it", () => {
  assert.ok(DEMO_PATH_HREFS.includes(DEMO_HOME));
  for (const p of PALETTE_PAGES) assert.equal(offeredInDemoPath(p.href, true), DEMO_PATH_HREFS.includes(p.href), p.href);
});

test("the US-case Nyaya page is absent from the demo navigation and the palette", () => {
  assert.equal(offeredInDemoPath("/nyaya", true), false);
  const hrefs = pagesFor(false, true).map((p) => p.href);
  assert.ok(!hrefs.includes("/nyaya"));
  assert.ok(hrefs.includes("/matters"));
});

test("the palette is unchanged with the flag off", () => {
  assert.deepEqual(pagesFor(false, false).map((p) => p.id), PALETTE_PAGES.map((p) => p.id));
});
