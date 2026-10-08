import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// O8 (8 Oct): the member-visible strings of the product pages make no claim the house-judge path cannot back. The signed strings and the engine's
// reason table are listed in AUDIT-overclaim-strings-2026-10-08.md and are changed only through R1's wording review; they are excluded from the
// "quoted words" rule here until then (see KNOWN_PENDING).
const ROOT = join(__dirname, "..");
const FILES = [
  "app/matters/page.tsx", "app/citations/page.tsx", "app/safety/page.tsx", "app/demo/page.tsx", "app/benchmarks/page.tsx",
  "lib/surfaceCopy.ts", "lib/memo.ts", "lib/demo/steps.ts", "lib/demo/safety.ts", "lib/citedFact.ts", "lib/benchmarks.ts", "lib/citationCheck.ts",
];
const code = (f: string): string =>
  readFileSync(join(ROOT, f), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

const BANNED: [string, RegExp][] = [
  ["a verbatim span", /verbatim span/i],
  ["a highlighted passage", /highlighted passage/i],
  ["quoted words claimed of the judge", /quote-checked|quoted words from your facts|judge'?s quoted words/i],
  ["a bare accuracy claim", /\b(is|are|very|highly|fully) accurate\b|\baccuracy of \d|≤ ?2 ?%|<= ?2 ?%/i],
  ["coverage as a capability", /\bfull coverage\b|\bcovers (every|all)\b|\bwide coverage\b|\bbroad coverage\b/i],
  ["proving as the usual outcome", /proves? (reliably|most|every|all)|\balways proves?\b/i],
];

test("no member-visible product string makes an overclaim (O8)", () => {
  for (const f of FILES) {
    const text = code(f);
    for (const [what, re] of BANNED) assert.doesNotMatch(text, re, `${f}: ${what}`);
  }
});

test("the matters page says the judge cites the supporting fact, and that an untrained contract refers instead of answering", () => {
  const text = code("app/matters/page.tsx");
  assert.match(text, /cites the supporting fact/);
  assert.match(text, /gives no answer here and refers\s+instead/);
  assert.doesNotMatch(text, /gap in coverage/);
});

test("planted: the guard does catch each banned phrase", () => {
  const samples = ["a verbatim span of the facts", "a highlighted passage", "quote-checked against the facts", "The judge's quoted words appear", "it is accurate", "error ≤2%", "full coverage of the code", "it always proves"];
  for (const s of samples) assert.ok(BANNED.some(([, re]) => re.test(s)), s);
});
