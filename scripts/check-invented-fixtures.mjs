// CI guard (#101): this repository is public, so no tracked text file may carry a real person's name or a real case/crime
// number. Fixtures are INVENTED; a recorded one has leaked before. The WHOLE repository is scanned (src, e2e, fixtures, docs, public,
// desktop, engine, scripts, README ...), except this guard, its test and its exception list.
//  1. Shape patterns (always on): Cr.No, Crl.O.P., FIR No., C.C. No., CNR, "No. N of YYYY", dotted/slashed numeric dates.
//  2. Real names, NEVER spelled or hashed in this repository: a PRIVATE file read at run time, from INVENTED_FIXTURE_NAMES_FILE or
//     else ~/.config/pravrudhi/fixture-names.txt (one name per line, matched as a phrase, case-insensitively; "~word" matches one
//     word; "#" starts a comment). CI writes it from the INVENTED_FIXTURE_NAMES secret.
//    No private file: the name check is SKIPPED with a message locally, and FAILS the job in CI (CI=true) or with --require-names.
// A deliberate exception is a line in scripts/invented-fixture-allow.json: {file, id, line_sha256, reason}, matched on the exact line.
// Prints `path:line: pattern`, never the matched value. Usage: node scripts/check-invented-fixtures.mjs [--root DIR] [--require-names]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEXT = new Set([".js", ".mjs", ".ts", ".tsx", ".json", ".jsonl", ".md", ".txt", ".yaml", ".yml", ".csv", ".html", ".svg", ".py", ".sh", ".toml", ".css", ".cjs", ".rs", ".ini", ".cfg", ".xml", ".plist", ".ipynb", ".rst"]);
const SELF = new Set(["scripts/check-invented-fixtures.mjs", "scripts/test/check-invented-fixtures.test.mjs", "scripts/invented-fixture-allow.json"]);
const SKIP_NAMES = new Set(["package-lock.json"]);

// A label alone ("Crl.O.P.", "CNR" in a sentence or in a guard's own regex) is not a leak; a label FOLLOWED BY A NUMBER or code is.
const NUM = String.raw`\s*[:.#-]?\s*(?:\([A-Za-z]+\)\s*)?\d`;
export const SHAPES = [
  ["Cr.No <number> (crime number)", new RegExp(String.raw`\bCr\.?\s*No\.?${NUM}`, "i")],
  ["Crl.O.P. <number> (criminal original petition number)", new RegExp(String.raw`\bCrl\.?\s*O\.?\s*P\.?(?:\s*No\.?)?${NUM}`, "i")],
  ["FIR No. <number>", new RegExp(String.raw`\bFIR\s+No\.?${NUM}`, "i")],
  ["C.C. No. <number> (calendar case number)", new RegExp(String.raw`\bC\.\s?C\.\s*No\.?${NUM}`)],
  ["CNR <code> (case number record)", /\bCNR\b\s*[:#-]?\s*[A-Z]{4}\d{2}\d{6}\d{4}\b|\bCNR\b\s*[:#-]?\s*[A-Z0-9]{12,}\b/],
  ["CNR-shaped code (4 letters + 12 digits)", /\b[A-Z]{4}\d{12}\b/],
  ["court case-number form 'No. N of YYYY'", /\bNo\.?\s*\d+\s+of\s+(?:19|20)\d{2}\b/i],
  ["numeric date (dd.mm.yyyy, dd/mm/yyyy or dd-mm-yyyy)", /\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b/],
];

export function inScope(rel) {
  const p = rel.split(path.sep).join("/");
  return !SELF.has(p) && !SKIP_NAMES.has(path.basename(p));
}
const sha = (s) => createHash("sha256").update(s).digest("hex");

/** Parse the private names file into matchers. */
export function nameMatchers(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (!l || l.startsWith("#")) continue;
    const word = l.startsWith("~");
    const esc = (word ? l.slice(1) : l).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    if (esc) out.push(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "iu"));
  }
  return out;
}
export function check(root, { namesText = null, allow = [] } = {}) {
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const matchers = namesText === null ? [] : nameMatchers(namesText);
  const out = [];
  for (const rel of files) {
    if (!TEXT.has(path.extname(rel)) || !inScope(rel)) continue;
    let text;
    try { text = readFileSync(path.join(root, rel), "utf8"); } catch { continue; }
    text.split("\n").forEach((line, i) => {
      const lsha = sha(line.trim());
      const excused = (id) => allow.some((a) => a.file === rel && a.id === id && a.line_sha256 === lsha && a.reason);
      for (const [id, re] of SHAPES) if (re.test(line) && !excused(id)) out.push(`${rel}:${i + 1}: ${id} -- use an invented value`);
      if (matchers.some((m) => m.test(line)) && !excused("name")) out.push(`${rel}:${i + 1}: a real name from the deny list (value not shown) -- use an invented name`);
    });
  }
  return out;
}

export function loadConfig(root, env, requireNames) {
  const notes = [];
  let namesText = null;
  const nf = env.INVENTED_FIXTURE_NAMES_FILE || path.join(env.HOME || os.homedir(), ".config/pravrudhi/fixture-names.txt");
  const required = requireNames || Boolean(env.CI);
  if (existsSync(nf)) namesText = readFileSync(nf, "utf8");
  else if (required) return { error: "the real-name check is REQUIRED here (CI or --require-names) but the private names file is missing (INVENTED_FIXTURE_NAMES_FILE, default ~/.config/pravrudhi/fixture-names.txt); in CI it comes from the INVENTED_FIXTURE_NAMES secret" };
  else notes.push("SKIPPED the real-name check: no private names file (INVENTED_FIXTURE_NAMES_FILE, default ~/.config/pravrudhi/fixture-names.txt). CI requires it. Shape patterns still ran.");
  const af = path.join(root, "scripts/invented-fixture-allow.json");
  const allow = existsSync(af) ? JSON.parse(readFileSync(af, "utf8")) : [];
  return { namesText, allow, notes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--root");
  const root = i > 0 ? path.resolve(process.argv[i + 1]) : path.resolve(HERE, "..");
  const cfg = loadConfig(root, process.env, process.argv.includes("--require-names"));
  if (cfg.error) { console.error(`check-invented-fixtures: ${cfg.error}`); process.exit(1); }
  for (const n of cfg.notes) console.log(`check-invented-fixtures: ${n}`);
  const violations = check(root, cfg);
  if (violations.length) {
    console.error(violations.join("\n"));
    console.error(`\ncheck-invented-fixtures: ${violations.length} hit(s). Fixtures must be invented: no real name, no real case or crime number, no real case date.`);
    process.exit(1);
  }
  console.log("check-invented-fixtures: ok");
}
