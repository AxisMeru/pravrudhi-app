import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

// AxisMeru/pravrudhi-app#113 (Lead-2, 13 Oct): the screening result is rendered only from the decide tool result. The result surfaces (Screening, Matters, the
// screening components, the memo and run-record builders) have no path to chat or agent text: they import nothing from the chat components, the chat/memory libraries or
// attachments, and read no field named for an agent's words.
const src = join(__dirname, "..");
const SURFACE = ["app/screening/page.tsx", "app/matters/page.tsx", "lib/screening", "components/screening", "lib/memo.ts", "components/IngredientChecklist.tsx"];
function files(rel: string): string[] {
  const p = join(src, rel);
  try { statSync(p); } catch { return []; }
  if (!statSync(p).isDirectory()) return [p];
  return readdirSync(p).flatMap((n) => (n.endsWith(".spec.ts") ? [] : files(join(rel, n))));
}

test("the result surfaces import nothing from the chat components, chat memory or attachments", () => {
  const bad: string[] = [];
  for (const f of SURFACE.flatMap(files)) {
    const code = readFileSync(f, "utf8");
    for (const m of code.matchAll(/from\s+["']([^"']+)["']/g)) if (/components\/chat|\/chat\b|lib\/memory|lib\/attachments|\/ChatSurface/.test(m[1])) bad.push(`${relative(src, f)} imports ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});

test("the result surfaces read no field that carries an agent's own words", () => {
  const bad: string[] = [];
  for (const f of SURFACE.flatMap(files)) {
    const code = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of code.matchAll(/\b(?:result|res|answer|response|wire)\??\.(display_text|agent_message|agent_text|reply|message|summary|narrative|answer|content|text)\b/g)) bad.push(`${relative(src, f)}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});
