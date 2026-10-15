import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Lead-2, 14 Oct (#177): the product nav has no "Offence rules" entry; the page and the route are untouched.
test("the Sidebar's NAV list has no /matters entry, and the matters page file still exists", () => {
  const src = readFileSync(join(__dirname, "..", "components", "Sidebar.tsx"), "utf8");
  const nav = src.slice(src.indexOf("const NAV: NavEntry[] = ["), src.indexOf("];", src.indexOf("const NAV: NavEntry[] = [")));
  assert.doesNotMatch(nav, /href: "\/matters"/);
  assert.match(nav, /href: "\/screening"/);
  assert.ok(readFileSync(join(__dirname, "..", "app", "matters", "page.tsx"), "utf8").length > 0);
});
