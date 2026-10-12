// Prints every user-visible string under src/ that says proof / established / verbatim / word-for-word / passage / quote outside the frontier files.
// Usage: npx tsx scripts/wording-audit.ts [--json]. Exit 1 when there is any hit (nothing is allow-listed yet).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { scanSource, violations } from "../src/lib/wordingAudit";

const root = join(__dirname, "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.spec\.ts$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}
const hits = walk(join(root, "src")).flatMap((p) => scanSource(relative(root, p), readFileSync(p, "utf8")));
const bad = violations(hits);
if (process.argv.includes("--json")) console.log(JSON.stringify(bad, null, 1));
else for (const h of bad) console.log(`${h.file}:${h.line}: ${h.text}`);
console.log(`${bad.length} hit(s) outside the frontier files`);
process.exit(bad.length === 0 ? 0 : 1);
