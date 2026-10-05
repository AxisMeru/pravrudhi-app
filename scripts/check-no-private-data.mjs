// CI guard: this repository is public, so test fixtures and e2e specs must not carry recorded-looking
// identifiers (session/thread/response ids, UUIDs, emails, host home paths, account/plan fields, tokens).
// Ported from pravrudhi's scripts/check_no_private_data.py (2026-10-02, after two public PRs there carried
// recorded ids). Prints `path:line: pattern`, never the value. A pattern scan only: an id with no
// recognisable shape is not caught. Usage: node scripts/check-no-private-data.mjs [--root DIR]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEXT = new Set([".js", ".mjs", ".ts", ".tsx", ".json", ".jsonl", ".md", ".txt", ".yaml", ".yml", ".csv", ".html"]);
const SCOPE_DIRS = ["desktop/test/", "frontend/e2e/", "research/"];
const UUID = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
const UUID_OK = /^(00000000-0000-4000-8000-\d{12}|00000000-0000-0000-0000-000000000000)$/;
const RESP = /\bresp_[0-9a-zA-Z]{20,}\b/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const EMAIL_OK = /@example\.(?:com|org|net)$|@[A-Za-z0-9.-]+\.(?:invalid|test)$|@[a-z]\.[a-z]$/i;
const HOME = /\/home\/([A-Za-z_][A-Za-z0-9_-]*)\//g;
const HOME_OK = new Set(["user", "example", "runner", "me", "x"]);
const ACCOUNT = /["'](plan_type|account_id|organization_id|org_id|user_id|email)["']\s*:\s*["']([^"']+)["']/g;
const ACCOUNT_OK = /example|constructed/i;
const TOKEN = /\b(?:sk-[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{30,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g;
const TOKEN_OK = /^sk-test-/;

export function inScope(rel) {
  const p = rel.split(path.sep).join("/");
  const parts = p.split("/").slice(0, -1);
  return SCOPE_DIRS.some((d) => p.startsWith(d)) || parts.some((s) => s === "fixtures" || s === "__fixtures__" || s.endsWith("_fixtures"));
}

export function identifierHits(line) {
  const hits = [];
  if ((line.match(UUID) ?? []).some((m) => !UUID_OK.test(m))) hits.push("uuid that is not the constructed 00000000-0000-4000-8000-<12 digits> form");
  if (RESP.test(line)) hits.push("recorded-looking response id (use resp_constructed_NN)");
  if ((line.match(EMAIL) ?? []).some((m) => !EMAIL_OK.test(m))) hits.push("email address (use @example.com)");
  if ([...line.matchAll(HOME)].some((m) => !HOME_OK.has(m[1]))) hits.push("host home path (use /home/user/)");
  if ([...line.matchAll(ACCOUNT)].some((m) => !ACCOUNT_OK.test(m[2]))) hits.push("account/plan field with a non-constructed value (use an example-* value)");
  if ((line.match(TOKEN) ?? []).some((m) => !TOKEN_OK.test(m))) hits.push("token-shaped string (placeholders start sk-test-)");
  return hits;
}

export function check(root) {
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const out = [];
  for (const rel of files) {
    if (!TEXT.has(path.extname(rel)) || !inScope(rel)) continue;
    let text;
    try {
      text = readFileSync(path.join(root, rel), "utf8");
    } catch {
      continue;
    }
    text.split("\n").forEach((line, i) => {
      for (const h of identifierHits(line)) out.push(`${rel}:${i + 1}: ${h} -- replace with a constructed value`);
    });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--root");
  const violations = check(path.resolve(i > 0 ? process.argv[i + 1] : "."));
  for (const v of violations) console.log(v);
  process.exit(violations.length ? 1 : 0);
}
