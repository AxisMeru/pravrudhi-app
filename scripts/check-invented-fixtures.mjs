// CI guard (#101): this repository is public, so no tracked text file may carry a real person's name or a real case/crime
// number. Fixtures are INVENTED; a recorded one has leaked before. The WHOLE repository is scanned (src, e2e, fixtures, docs, public,
// desktop, engine, scripts, README ...), except this guard, its test and its exception list.
//  1. Shape patterns (always on): Cr.No, Crl.O.P., FIR No., C.C. No., CNR, "No. N of YYYY", dotted/slashed numeric dates.
//  2. Real names, NEVER spelled or hashed in this repository: a PRIVATE file read at run time, from INVENTED_FIXTURE_NAMES_FILE or
//     else ~/.config/pravrudhi/fixture-names.txt (one name per line, matched as a phrase, case-insensitively; "~word" matches one
//     word; "#" starts a comment). CI writes it from the INVENTED_FIXTURE_NAMES secret.
//    No private file: the name check is SKIPPED with a message locally, and FAILS the job in CI (CI=true) or with --require-names.
// A deliberate exception is a line in scripts/invented-fixture-allow.json: {file, id, line_sha256, reason}. The key is file + shape id + sha256 of the exact trimmed
// line + a reason; the line NUMBER is not in the key, so the same line repeated in that file is excused too.
// Prints `path:line: pattern`, never the matched value. Usage: node scripts/check-invented-fixtures.mjs [--root DIR] [--require-names | --names-optional]
// --names-optional is for CI until the INVENTED_FIXTURE_NAMES secret exists: the name check is skipped with a visible warning instead of failing.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF = new Set(["scripts/check-invented-fixtures.mjs", "scripts/test/check-invented-fixtures.test.mjs", "scripts/invented-fixture-allow.json"]);
// Exclusions: lockfiles and vendored third-party text. Everything else tracked is scanned (README, CHANGELOG, runbooks, scripts, .github, desktop, engine ...).
const EXCLUDE_NAMES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "Cargo.lock", "poetry.lock", "uv.lock", "VENDORED.txt"]);
const EXCLUDE_DIRS = ["node_modules/", "vendor/", "third_party/"];

// A label alone ("Crl.O.P.", "CNR" in a sentence or in a guard's own regex) is not a leak; a label FOLLOWED BY A NUMBER or code is.
const NUM = String.raw`\s*[:.#-]?\s*(?:\([A-Za-z]+\)\s*)?\d`;
const lab = (src, flags = "i") => new RegExp(String.raw`\b${src}${NUM}`, flags);
export const SHAPES = [
  ["Cr.No <number> (crime number)", lab(String.raw`Cr\.?\s*No\.?`)],
  ["Crime No./Crime Number <number>", lab(String.raw`Crime\s+(?:No\.?|Number)`)],
  ["Crl.O.P. <number> (criminal original petition number)", lab(String.raw`Crl\.?\s*O\.?\s*P\.?(?:\s*No\.?)?`)],
  ["FIR No./FIR Number <number>", lab(String.raw`FIR\s+(?:No\.?|Number)`)],
  ["C.C. No. <number> (calendar case number)", lab(String.raw`C\.\s?C\.\s*No\.?`, "")],
  ["W.P. / W.P.(C) <number> (writ petition)", lab(String.raw`W\.\s?P\.?(?:\s*\([A-Za-z]+\))?(?:\s*No\.?)?`, "")],
  ["SLP (Crl.) No. <number>", lab(String.raw`SLP(?:\s*\([A-Za-z.]+\))?\s*(?:No\.?)?`, "")],
  ["Cr.M.P./Crl.M.P. <number>", lab(String.raw`Cr(?:l)?\.?\s*M\.\s?P\.?(?:\s*No\.?)?`)],
  ["Crl.A./Crl.R.C./Crl.Rev. <number>", lab(String.raw`Crl\.?\s*(?:A|R\.?\s?C|Rev)\.?(?:\s*No\.?)?`)],
  ["O.S. No. <number>", lab(String.raw`O\.\s?S\.\s*No\.?`, "")],
  ["S.C. No. <number>", lab(String.raw`S\.\s?C\.\s*No\.?`, "")],
  ["Case No. <number>", lab(String.raw`Case\s+No\.?`)],
  ["CNR <code> (case number record)", /\bCNR\b\s*[:#-]?\s*[A-Z]{4}\d{2}\d{6}\d{4}\b|\bCNR\b\s*[:#-]?\s*[A-Z0-9]{12,}\b/],
  ["CNR-shaped code (4 letters + 12 digits)", /\b[A-Z]{4}\d{12}\b/],
  ["court case-number form 'No. N of YYYY'", /\bNo\.?\s*\d+\s+of\s+(?:19|20)\d{2}\b/i],
  ["numeric date (dd.mm.yyyy, dd/mm/yyyy or dd-mm-yyyy)", /\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b/],
  // personal data (public repo): an email, an Indian mobile number, a PAN, an Aadhaar-like 12-digit number
  ["email address (use @example.com)", /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/, (m) => !EMAIL_OK.test(m[0])],
  ["Indian mobile number (10 digits starting 6-9, optional +91)", /(?<![\w.+-])(?:\+?91[ -]?)?[6-9]\d{9}(?![\w.-]|,\d)/],
  ["PAN (5 letters, 4 digits, 1 letter)", /\b[A-Z]{5}\d{4}[A-Z]\b/],
  ["Aadhaar-like 12-digit number", /(?<![\d-])\d{4}[ -]?\d{4}[ -]?\d{4}(?![\d-])/],
];
// Path-scoped shape: a 9-10 digit literal in a settings or config file or an example (a chat id, an account number, a phone number) is how a real
// identifier leaks as a "placeholder". Allowed only with an allow.json entry (file + id + exact-line hash + reason).
export const LONG_DIGITS_ID = "9-10 digit literal in a settings/config/docs file (use an obviously invented value such as 123456789)";
export const LONG_DIGITS = /(?<![\w.+-])\d{9,10}(?![\w.-]|,\d)/;
export const CONFIG_PATHS = /^(?:frontend\/src\/app\/settings\/|\.github\/|docs\/)|(?:^|\/)config\/[^/]*\.(?:ts|tsx|js|mjs|json|ya?ml|toml)$|(?:^|\/)\.?env\.example$|\.env\.example$/;
const EMAIL_OK = /@example\.(?:com|org|net)$|@[A-Za-z0-9.-]+\.(?:invalid|test|example)$|@[a-z]\.[a-z]$|@[A-Za-z0-9.-]+\.local$/i;
// UUIDs and long hex digests contain digit runs that are not identifiers.
const strip = (line) => line.replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, " ").replace(/\b[0-9a-fA-F]{24,}\b/g, " ");

export function inScope(rel) {
  const p = rel.split(path.sep).join("/");
  return !SELF.has(p) && !EXCLUDE_NAMES.has(path.basename(p)) && !EXCLUDE_DIRS.some((d) => p.startsWith(d) || p.includes(`/${d}`));
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
    if (!inScope(rel)) continue;
    let text;
    try { const buf = readFileSync(path.join(root, rel)); if (buf.includes(0)) continue; text = buf.toString("utf8"); } catch { continue; } // a NUL byte = binary: skipped
    text.split("\n").forEach((line, i) => {
      const lsha = sha(line.trim());
      const excused = (id) => allow.some((a) => a.file === rel && a.id === id && a.line_sha256 === lsha && a.reason);
      const clean = strip(line);
      if (CONFIG_PATHS.test(rel.split(path.sep).join("/")) && LONG_DIGITS.test(clean) && !excused(LONG_DIGITS_ID)) out.push(`${rel}:${i + 1}: ${LONG_DIGITS_ID}`);
      for (const [id, re, pred] of SHAPES) { const m = clean.match(re); if (m && (!pred || pred(m)) && !excused(id)) out.push(`${rel}:${i + 1}: ${id} -- use an invented value`); }
      if (matchers.some((m) => m.test(line)) && !excused("name")) out.push(`${rel}:${i + 1}: a real name from the deny list (value not shown) -- use an invented name`);
    });
  }
  return out;
}

export function loadConfig(root, env, requireNames, namesOptional = false) {
  const notes = [];
  let namesText = null;
  const nf = env.INVENTED_FIXTURE_NAMES_FILE || path.join(env.HOME || os.homedir(), ".config/pravrudhi/fixture-names.txt");
  const required = requireNames || (Boolean(env.CI) && !namesOptional);
  if (existsSync(nf)) {
    namesText = readFileSync(nf, "utf8");
    if (nameMatchers(namesText).length === 0) {
      if (required) return { error: "the private names file holds NO names (empty, whitespace or comments only): the name check would check nothing, so it FAILS here" };
      notes.push("SKIPPED the real-name check: the private names file holds no names.");
    }
  }
  else if (required) return { error: "the real-name check is REQUIRED here (CI or --require-names) but the private names file is missing (INVENTED_FIXTURE_NAMES_FILE, default ~/.config/pravrudhi/fixture-names.txt); in CI it comes from the INVENTED_FIXTURE_NAMES secret" };
  else notes.push((namesOptional ? "WARNING (--names-optional): " : "") + "SKIPPED the real-name check: no private names file (INVENTED_FIXTURE_NAMES_FILE, default ~/.config/pravrudhi/fixture-names.txt). CI requires it. Shape patterns still ran.");
  const af = path.join(root, "scripts/invented-fixture-allow.json");
  const allow = existsSync(af) ? JSON.parse(readFileSync(af, "utf8")) : [];
  return { namesText, allow, notes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--root");
  const root = i > 0 ? path.resolve(process.argv[i + 1]) : path.resolve(HERE, "..");
  const cfg = loadConfig(root, process.env, process.argv.includes("--require-names"), process.argv.includes("--names-optional"));
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
