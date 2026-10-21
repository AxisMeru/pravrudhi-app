import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

// The public app and repository carry no real case, crime or FIR number (Lead-2, 12 Oct 2026; the same rule as for party names). This scans the example
// text and every served or tested source file, the fixtures, the docs and the public text files.
const ID = /Cr\.?\s*No\.?\s*\d+|\d+ of \d{4}|Crl\.?\s*O\.?\s*P|FIR\s*No|C\.?C\.?\s*No|CNR/i;
const root = join(__dirname, "..", "..", "..");
const repo = join(root, "..");
// Files that state the pattern itself or list what is not shown.
const SELF = new Set(["frontend/src/lib/demo/caseIdentifiers.spec.ts", "frontend/src/lib/demo/example.spec.ts", "frontend/src/lib/demo/liveCheck.spec.ts", "frontend/src/lib/demo/factsGuard.ts"]);
// Lead-2 14 Oct (deliberate loosening of the 12 Oct guard): each example is identified exactly as the court publishes it, and that is its CITATION: a separate pinned field in example.ts, checked by
// example.spec.ts against the only allowed shapes. Those `citation:` lines alone are exempt here; everything else in the repository still carries no real case, crime or FIR number.
const CITATION_FILE = "frontend/src/lib/demo/example.ts";
// The invented SAMPLE matter (Lead-2 P0, 20 Oct): four invented papers (an FIR, a chargesheet extract, a bail order, a cheque memo) that look like real papers ON PURPOSE so the tools can be run; every one opens with "INVENTED SAMPLE PAPER FOR TESTING. Every name, number, date and place below is made up."
// They are pinned byte for byte by sampleMatter.spec.ts, read by R1 and R2 as fixtures, and carry no real party (CI names check). This directory alone is exempt from the case-number scan.
const SAMPLE_DIR = "frontend/src/lib/fixtures/sample/";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "out", ".next", ".git", "test-results"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|json|md|txt|mjs|yml|yaml)$/.test(name)) out.push(p);
  }
  return out;
}

test("the example text carries no case, crime or FIR number: the one crime number is redacted", async () => {
  const { EXAMPLES, EXAMPLE_LABEL, exampleFactsText } = await import("./example");
  assert.doesNotMatch(EXAMPLES.map((e) => exampleFactsText(e) + "\n" + e.id).join("\n") + "\n" + EXAMPLE_LABEL, ID);
});

test("no source, test, fixture or doc file of the app carries a case, crime or FIR number", () => {
  const hits: string[] = [];
  for (const dir of [join(root, "src"), join(root, "e2e"), join(repo, "docs")]) {
    let files: string[] = [];
    try { files = walk(dir); } catch { continue; }
    for (const f of files) {
      const rel = relative(repo, f);
      if (SELF.has(rel) || rel.startsWith(SAMPLE_DIR)) continue;
      readFileSync(f, "utf8").split("\n").forEach((line, i) => { if (rel === CITATION_FILE && /^\s*citation:/.test(line)) return; if (ID.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`); });
    }
  }
  assert.deepEqual(hits, [], "real-looking case numbers in the public repository");
});
