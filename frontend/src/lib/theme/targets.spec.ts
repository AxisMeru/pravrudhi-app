import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// WCAG 2.2 target size (24 px) for the standalone controls the 14 Oct sweep (#138) measured under 24 px. A source pin: the class that sets the minimum must stay on each control.
const src = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");

test("the facts file input carries a 24 px minimum on Screening and Matters", () => {
  for (const f of ["app/screening/page.tsx", "app/matters/page.tsx"]) {
    assert.match(src(f), /data-testid="facts-file"\s+className="min-h-6 /, `${f}: facts-file input lost min-h-6`);
  }
});

test("the standalone Data handling links carry a 24 px minimum", () => {
  assert.match(src("components/RetentionBefore.tsx"), /href="\/data-handling" className="inline-flex min-h-6 /);
  assert.match(src("components/screening/AssistantRun.tsx"), /className="inline-flex min-h-6 [^"]*"\s+data-testid="assistant-data-link"/);
});

test("the Create an account switch and the fact-row Remove button carry a 24 px minimum", () => {
  assert.match(src("app/signin/page.tsx"), /className="min-h-6 py-1 font-medium/);
  assert.match(src("app/screening/page.tsx"), /className="mt-1 inline-flex min-h-6 min-w-6 /);
});
