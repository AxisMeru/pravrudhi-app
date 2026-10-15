import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// #214 (a): the Matters page's memo comes from #210's builder (lib/screening/memo.ts). The legacy builder (lib/memo.ts buildMemo) prints "Engine reason code: …" and headings by raw contract id; no page may use it.
test("the Matters page builds its memo with buildScreeningMemo, not the legacy buildMemo", () => {
  const src = readFileSync(new URL("../app/matters/page.tsx", import.meta.url), "utf8");
  assert.match(src, /buildScreeningMemo/);
  assert.doesNotMatch(src, /\bbuildMemo\b/);
});

test("no page or component under src/app or src/components imports the legacy buildMemo", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (d: URL): string[] => readdirSync(d).flatMap((n) => { const u = new URL(`${n}${statSync(new URL(n, d)).isDirectory() ? "/" : ""}`, d); return statSync(u).isDirectory() ? walk(u) : [u.pathname]; });
  const files = [...walk(new URL("../app/", import.meta.url)), ...walk(new URL("../components/", import.meta.url))].filter((f) => /\.tsx?$/.test(f));
  assert.ok(files.length > 20);
  const users = files.filter((f) => /\bbuildMemo\b/.test(readFileSync(f, "utf8")));
  assert.deepEqual(users, []);
});
