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
  const hrefs = pagesFor(true, true).map((p) => p.href);
  assert.ok(!hrefs.includes("/nyaya"));
  assert.ok(hrefs.includes("/matters"));
});

test("the palette is unchanged for Studio with the flag off", () => {
  assert.deepEqual(pagesFor(true, false).map((p) => p.id), PALETTE_PAGES.map((p) => p.id));
});

import { SURFACE_ROUTES, routeAllowedOnSurface } from "./demoPath";
import { buildCatalogue, EMPTY_INDEX } from "./palette";
import { canSeeApiKeys } from "./runsAccess";

test("with the flag off every route is allowed", () => {
  for (const path of ["/runs", "/objectives", "/nyaya", "/models", "/anything"]) assert.equal(routeAllowedOnSurface(path, false), true);
});

test("on the law-firm surface a typed URL to the loop's pages is stopped, and sign-in still works", () => {
  for (const blocked of ["/start", "/objectives", "/objectives/detail", "/progress", "/memory", "/catalogue", "/chat", "/nyaya", "/runs", "/runs/abc", "/models", "/install"]) {
    assert.equal(routeAllowedOnSurface(blocked, true), false, blocked);
  }
  for (const ok of ["/", "/matters", "/matters/", "/settings", "/signin", "/partner-keys", "/citations"]) {
    assert.equal(routeAllowedOnSurface(ok, true), true, ok);
  }
  assert.ok(SURFACE_ROUTES.includes("/signin"));
});

test("the palette on the surface lists pages only: no actions, no objectives, runs, models or recipes", () => {
  const index = {
    ...EMPTY_INDEX,
    objectives: [{ id: "o1", track: "lora", domain: "d", intent: "i" }] as never,
    runs: [{ id: "r1" }] as never,
    models: [{ id: "m1", track: "t", night: 1 }] as never,
    recipes: [{ id: "x", title: "T", capability: "c", available: true }] as never,
  };
  const surface = buildCatalogue(index, false, false, true);
  assert.ok(surface.length > 0 && surface.every((r) => r.group === "Pages"));
  assert.deepEqual(surface.map((r) => r.href).sort(), ["/matters", "/settings"]);
  const normal = buildCatalogue(index, false, false, false);
  assert.ok(normal.some((r) => r.group === "Actions") && normal.some((r) => r.group === "Objectives"));
});

test("API keys and usage are offered to an admin only", () => {
  assert.equal(canSeeApiKeys("admin"), true);
  for (const other of ["member", "none", "", undefined, "Admin"]) assert.equal(canSeeApiKeys(other), false);
});

import { gateDecision } from "./demoPath";
import { studioOnlyPath } from "./palette";

test("the gate closes the loop's pages for anyone not known to be Studio, and waits while the edition is unknown", () => {
  for (const path of ["/runs", "/objectives/detail", "/nyaya", "/start", "/models"]) {
    const loop = studioOnlyPath(path);
    assert.equal(gateDecision(path, "product", loop, false), "block", path);
    assert.equal(gateDecision(path, null, loop, false), "wait", path);
    assert.equal(gateDecision(path, "studio", loop, false), "allow", path);
  }
});

test("the home page of a non-Studio user goes to Matters; Studio keeps it", () => {
  assert.equal(gateDecision("/", "product", true, false), "redirect-home");
  assert.equal(gateDecision("/", null, true, false), "wait");
  assert.equal(gateDecision("/", "studio", true, false), "allow");
});

test("kept pages are open to everyone, whatever the edition says", () => {
  for (const ed of ["studio", "product", null] as const) {
    for (const path of ["/matters", "/settings", "/signin", "/partner-keys"]) assert.equal(gateDecision(path, ed, studioOnlyPath(path), false), "allow", path);
  }
});

test("a law-firm build blocks every route it does not offer, even for Studio", () => {
  assert.equal(gateDecision("/runs", "studio", true, true), "block");
  assert.equal(gateDecision("/matters", "product", false, true), "allow");
});

test("the recorded public demo (no engine, no account) is shown as it always was", () => {
  assert.equal(gateDecision("/progress", "product", true, false, true), "allow");
  assert.equal(gateDecision("/progress", null, true, false, true), "allow");
});
