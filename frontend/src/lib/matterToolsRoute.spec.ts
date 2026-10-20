import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { SURFACE_ROUTES } from "./demoPath";
import { REGISTRY, REGISTRY_BASE_PATH, registryHref } from "./workflowRegistry";

const root = join(__dirname, "..", "..");

test("the matter-workflow page lives at /matter-tools; /preview is no page, only an edge 308 to /matter-tools (the operator: nothing is a preview)", () => {
  assert.equal(existsSync(join(root, "src", "app", "preview")), false, "no /preview page");
  assert.equal(existsSync(join(root, "src", "app", "matter-tools", "page.tsx")), true);
  const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as { redirects?: { source: string; destination: string; statusCode?: number }[] };
  assert.deepEqual((vercel.redirects ?? []).filter((r) => r.source.startsWith("/preview")), [{ source: "/preview/:path*", destination: "/matter-tools", statusCode: 308 }]);
  assert.ok(SURFACE_ROUTES.includes("/matter-tools"));
  assert.ok(!SURFACE_ROUTES.includes("/preview"));
  assert.equal(REGISTRY_BASE_PATH, "/matter-tools");
  for (const e of REGISTRY) assert.ok(registryHref(e).startsWith("/matter-tools#pv-"), e.key);
  const layout = readFileSync(join(root, "src", "app", "matter-tools", "layout.tsx"), "utf8");
  assert.match(layout, /pageTitle\("matterTools"\)/);
});
