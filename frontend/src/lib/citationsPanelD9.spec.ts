import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Explorer gap review of live deploy 9 (#279, #281): source pins, so the structure cannot drift back.
const src = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");
const panel = src("components/citations/CitationsPanel.tsx");

test("#279: the coverage fallback line is returned only when some row was answered by the engine", () => {
  assert.match(panel, /return rows\.some\(\(r\) => r\.state\.phase === "result"\) \? COVERAGE_NOT_REPORTED : null;/);
  assert.match(panel, /export function panelCoverage\(rows: readonly PanelRow\[\]\): string \| null/);
});

test("#279: a row inside the panel's live region does not announce again (no nested role=alert)", () => {
  assert.match(panel, /<CitationCheckResult state=\{r\.state\} announce=\{false\} \/>/);
  const check = src("components/citations/CitationCheck.tsx");
  assert.match(check, /role=\{announce \? "alert" : undefined\}/);
});

test("#281: the textarea has a short visible label, and the long helper sentence is its description, not its name", () => {
  assert.match(panel, /<label htmlFor="citations-panel-input"[^>]*>Citations, one per line<\/label>/);
  assert.match(panel, /<p id="citations-panel-help"/);
  assert.match(panel, /id="citations-panel-input"\s+aria-describedby="citations-panel-help"/);
});
