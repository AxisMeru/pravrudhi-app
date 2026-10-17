// The product edition shows the law-firm surface only; the improvement loop's pages are Studio's (Lead-2 decision on
// #525, 2026-10-06). The engine refuses the same surfaces (src/pravrudhi/api/roles.py::gate).

import { strict as assert } from "node:assert";
import test from "node:test";

import { EMPTY_INDEX, PALETTE_PAGES, filterResults, STUDIO_ONLY_PAGES, buildCatalogue, isStudioOnlyHref, pagesFor, studioOnlyPath } from "./palette";

test("a non-Studio caller is offered Matters and Settings, nothing of the improvement loop", () => {
  assert.deepEqual(pagesFor(false, false).map((p) => p.id).sort(), ["benchmarks", "data-handling", "demo", "guide", "how-it-was-built", "safety", "screening", "settings", "workflows"]);
  assert.deepEqual(pagesFor(false, false, true, true).map((p) => p.id).sort(), ["benchmarks", "citations", "data-handling", "demo", "guide", "how-it-was-built", "safety", "screening", "settings", "workflows"]);
});

test("Studio is offered every page", () => {
  assert.equal(pagesFor(true, false, true, true).length, PALETTE_PAGES.length);
});

test("the hide list is exactly the loop's pages, and every kept page is absent from it", () => {
  assert.deepEqual([...STUDIO_ONLY_PAGES].sort(), ["catalogue", "chat", "improve", "install", "memory", "models", "nyaya", "objectives", "progress", "runs", "start"]);
  for (const kept of ["matters", "settings"]) assert.ok(!STUDIO_ONLY_PAGES.has(kept), kept);
  for (const p of PALETTE_PAGES) assert.equal(isStudioOnlyHref(p.href), STUDIO_ONLY_PAGES.has(p.id), p.href);
});

test("nested and trailing-slash paths under a hidden page are hidden too; kept pages and sign-in are not", () => {
  for (const hidden of ["/", "/start", "/objectives", "/objectives/detail", "/objectives/detail/", "/runs", "/runs/abc", "/nyaya", "/chat/", "/models", "/install"]) {
    assert.equal(studioOnlyPath(hidden), true, hidden);
  }
  for (const open of ["/matters", "/matters/", "/settings", "/signin", "/partner-keys", "/citations", "/anything-else", null, undefined]) {
    assert.equal(studioOnlyPath(open), false, String(open));
  }
});

test("a caller the engine does not call admin is never offered Runs: not the page, not a run record", () => {
  assert.ok(pagesFor(true, false, true).some((p) => p.href === "/runs"));
  assert.ok(!pagesFor(true, false, false).some((p) => p.href === "/runs"));
  assert.ok(!pagesFor(false, false, true).some((p) => p.href === "/runs"), "and a non-Studio caller never gets the page at all");
  const index = { ...EMPTY_INDEX, runs: [{ id: "run-1", status: "done", target: "model" }] as never };
  const shown = buildCatalogue(index, false, true, true, false);
  const hidden = buildCatalogue(index, false, true, false, false);
  assert.ok(shown.some((r) => r.group === "Runs"));
  assert.ok(!hidden.some((r) => r.group === "Runs" || r.href === "/runs"));
  assert.ok(hidden.length > 0, "the rest of the palette is untouched");
});

// Lead-2, 14 Oct (#177): "Offence rules" (/matters) shows raw contract ids, so it is not offered in the product nav or the palette; the route and its page stay.
test("/matters is not in the palette pages, and the route is still allowed on the surface", async () => {
  const { routeAllowedOnSurface } = await import("./demoPath");
  assert.ok(!PALETTE_PAGES.some((p) => p.href === "/matters" || p.id === "matters"));
  assert.ok(!pagesFor(false, false, true, true).some((p) => p.href === "/matters"));
  assert.equal(routeAllowedOnSurface("/matters"), true);
});

// app#403: a page can carry hidden search keywords (layout B names the page "This screening"; "matter" still finds it).
test("filterResults matches a result's hidden keywords as well as its title and subtitle", () => {
  const r = [{ id: "page:screening", group: "Pages" as const, title: "This screening", href: "/screening", keywords: ["Matter"] }, { id: "page:guide", group: "Pages" as const, title: "User guide", href: "/guide" }];
  assert.deepEqual(filterResults(r, "matter").map((x) => x.id), ["page:screening"]);
  assert.deepEqual(filterResults(r, "guide").map((x) => x.id), ["page:guide"]);
  assert.deepEqual(filterResults(r, "zzz"), []);
});
