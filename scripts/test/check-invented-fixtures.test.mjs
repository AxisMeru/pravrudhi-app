// All names and numbers here are INVENTED for these tests (the guard's job is to catch the real ones, which are never spelled in the repo).
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { check, loadConfig, SHAPES, LONG_DIGITS_ID } from "../check-invented-fixtures.mjs";

const SCRIPT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "check-invented-fixtures.mjs");
const INVENTED_NAME = "Zzyqx Wvutsrq";
const sha = (s) => createHash("sha256").update(s).digest("hex");

const bad0 = () => repo({ "frontend/src/a.ts": "Crl.O.P. 4321 of 2099" });
function repo(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "cif-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
}

test("planted failure: every case/crime-number shape in a fixture fails, and the value is never printed", () => {
  const planted = {
    "Cr.No": "registered as Cr.No.777 of 2099",
    "Crl.O.P.": "Crl.O.P. 8888",
    "FIR No.": "FIR No. 55/2099",
    "C.C. No.": "C.C. No. 12",
    "CNR": "CNR: ABCD010012342099",
    "No. N of YYYY": "No. 31 of 2099",
    "numeric date": "order dated 07.11.2099",
  };
  for (const [name, line] of Object.entries(planted)) {
    const dir = repo({ [`frontend/src/lib/fixtures/${name.replace(/\W/g, "")}.json`]: JSON.stringify({ text: line }) });
    const v = check(dir);
    assert.ok(v.length >= 1, `${name} must fail`);
    for (const x of v) assert.ok(!/777|8888|55\/2099|010012342099|31 of 2099|07\.11\.2099/.test(x), `${name}: value printed: ${x}`);
  }
  assert.ok(SHAPES.length >= 20);
  assert.ok(!existsSync(path.join(path.dirname(SCRIPT), "invented-fixture-name-tokens.sha256")), "no hash list in the repository");
});

test("a label without a number, an ISO date and prose mentioning the words are not leaks", () => {
  const dir = repo({
    "frontend/e2e/guard.spec.ts": 'assert.doesNotMatch(text, /Crl\\.O\\.P|CNR|Cr\\.No/); // the CNR is not shown\nconst d = "2026-10-12";\nconst n = "section 420 of the IPC";',
    "docs/note.md": "A C.C. is a calendar case; the FIR is read first.",
  });
  assert.deepEqual(check(dir), []);
});

test("scope: the whole repository is scanned (src, e2e, public, docs, desktop, engine, scripts, README); only the guard, its test and its exception list are not", () => {
  const leak = "Cr.No.777 of 2099 dated 07.11.2099";
  for (const rel of ["frontend/src/a.ts", "frontend/e2e/a.spec.ts", "frontend/public/a.json", "docs/a.md", "frontend/src/lib/fixtures/a.json", "desktop/a.js", "engine/a.py", "scripts/a.mjs", "README.md"]) assert.equal(check(repo({ [rel]: leak })).length >= 2, true, rel);
  for (const rel of ["scripts/check-invented-fixtures.mjs", "scripts/test/check-invented-fixtures.test.mjs", "scripts/invented-fixture-allow.json"]) assert.deepEqual(check(repo({ [rel]: leak })), [], rel);
});

test("planted failure: an invented name from the private file fails (phrase and single-word forms), case-insensitively, and is never printed", () => {
  const dir = repo({ "frontend/src/lib/fixtures/p.json": JSON.stringify({ party: INVENTED_NAME.toUpperCase() }), "docs/b.md": "the petitioner Wvutsrq-less is fine", "frontend/e2e/c.ts": "const x = 'quuxplugh was here';" });
  const v = check(dir, { namesText: `# private list\n${INVENTED_NAME}\n~quuxplugh\n` });
  assert.equal(v.length, 2);
  assert.ok(v.some((x) => x.includes("p.json:1")) && v.some((x) => x.includes("c.ts:1")));
  for (const x of v) assert.ok(!/zzyqx|wvutsrq|quuxplugh/i.test(x), x);
  assert.deepEqual(check(dir, { namesText: "" }), []);
});

test("an exception counts only with the exact line hash, the file, the shape id and a reason", () => {
  const line = "see Cr.No.777 of 2099";
  const dir = repo({ "frontend/src/a.ts": line });
  const id = "Cr.No <number> (crime number)";
  const ok = { file: "frontend/src/a.ts", id, line_sha256: sha(line), reason: "invented example, decided by Lead-2" };
  const base = check(dir);
  assert.ok(base.length >= 1);
  assert.equal(check(dir, { allow: [ok] }).filter((x) => x.includes("Cr.No")).length, 0);
  for (const bad of [{ ...ok, line_sha256: sha("other") }, { ...ok, file: "frontend/src/b.ts" }, { ...ok, id: "FIR No. <number>" }, { ...ok, reason: "" }]) {
    assert.ok(check(dir, { allow: [bad] }).some((x) => x.includes("Cr.No")), JSON.stringify(bad).slice(0, 40));
  }
});

test("without the private names file the name check is SKIPPED with a message locally; in CI or with --require-names it FAILS; the default path is ~/.config/pravrudhi/fixture-names.txt", () => {
  const dir = repo({ "frontend/src/a.ts": "const a = 1;" });
  const home = mkdtempSync(path.join(tmpdir(), "cif-home-"));
  const skipped = loadConfig(dir, { HOME: home }, false);
  assert.equal(skipped.namesText, null);
  assert.match(skipped.notes.join(" "), /SKIPPED the real-name check/);
  assert.match(loadConfig(dir, { HOME: home }, true).error, /REQUIRED/);
  assert.match(loadConfig(dir, { HOME: home, CI: "true" }, false).error, /REQUIRED/);
  assert.match(loadConfig(dir, { HOME: home, INVENTED_FIXTURE_NAMES_FILE: path.join(dir, "missing.txt") }, true).error, /REQUIRED/);
  const f = path.join(dir, "names.txt");
  writeFileSync(f, `${INVENTED_NAME}\n`);
  assert.equal(loadConfig(dir, { HOME: home, INVENTED_FIXTURE_NAMES_FILE: f }, true).namesText.trim(), INVENTED_NAME);
  mkdirSync(path.join(home, ".config/pravrudhi"), { recursive: true });
  writeFileSync(path.join(home, ".config/pravrudhi/fixture-names.txt"), `${INVENTED_NAME}\n`);
  assert.equal(loadConfig(dir, { HOME: home, CI: "true" }, false).namesText.trim(), INVENTED_NAME);
});

test("planted failure: each added label+number shape, with an invented number", () => {
  const planted = ["Crime No. 555/2099", "Crime Number 555", "FIR Number 88/99", "W.P.(C) 4321", "W.P. No. 4321", "SLP (Crl.) No. 777", "Crl.M.P. No. 91", "Cr.M.P. 91", "Crl.A. No. 12", "Crl.R.C. No. 12", "Crl.Rev. No. 12", "O.S. No. 33", "S.C. No. 45", "Case No. 67"];
  for (const line of planted) {
    const v = check(repo({ "frontend/src/a.ts": `const t = "${line}";` }));
    assert.ok(v.length >= 1, `${line} must fail`);
    for (const x of v) assert.ok(!/555|88\/99|4321|777|\b91\b|\b12\b|\b33\b|\b45\b|\b67\b/.test(x), `value printed for ${line}: ${x}`);
  }
  assert.deepEqual(check(repo({ "frontend/src/a.ts": 'const t = "a Case No label, W.P. in a sentence, Crime Number and S.C. No are named";' })), []);
});

test("planted failure: personal data: an email, an Indian mobile, a PAN and an Aadhaar-like number fail; example domains, UUIDs and hashes do not", () => {
  const bad = { email: "write to someone@mail-invented.in", mobile: "call 9876543210", mobile91: "call +91 98765 43210".replace(/ /g, ""), pan: "pan ABCDE1234F", aadhaar: "id 1234 5678 9012", aadhaar2: "id 123456789012" };
  for (const [k, line] of Object.entries(bad)) assert.ok(check(repo({ "docs/a.md": line })).length >= 1, `${k} must fail`);
  const ok = ["write to a@example.com or b@example.org", "x@y.invalid", "00000000-0000-4000-8000-000000000001", "sha " + "a1b2c3d4".repeat(8), "call 1234567890 or 5432167890", "pan ABCDE12345", "version 1.2.3, 2026-10-12, port 8008"];
  for (const line of ok) assert.deepEqual(check(repo({ "frontend/src/lib/a.ts": line })), [], line); // outside the settings/config/docs paths, where the 9-10 digit rule applies
});

test("--require-names fails when the names file holds NO names (empty, whitespace, comments only): the check must not pass having checked nothing", () => {
  const dir = repo({ "frontend/src/a.ts": "const a = 1;" });
  const home = mkdtempSync(path.join(tmpdir(), "cif-home-"));
  for (const body of ["", "   \n\t\n", "# only a comment\n  # another\n", "~\n"]) {
    const f = path.join(dir, "n.txt");
    writeFileSync(f, body);
    assert.match(loadConfig(dir, { HOME: home, INVENTED_FIXTURE_NAMES_FILE: f }, true).error, /NO names/, JSON.stringify(body));
    assert.equal(loadConfig(dir, { HOME: home, INVENTED_FIXTURE_NAMES_FILE: f, CI: "true" }, false).error?.includes("NO names"), true);
    assert.match(loadConfig(dir, { HOME: home, INVENTED_FIXTURE_NAMES_FILE: f }, false).notes.join(" "), /holds no names/);
    const r = spawnSync("node", [SCRIPT, "--root", dir, "--require-names"], { encoding: "utf8", env: { ...process.env, HOME: home, CI: "", INVENTED_FIXTURE_NAMES_FILE: f } });
    assert.equal(r.status, 1, JSON.stringify(body));
  }
});

test("the exception key is file + shape id + exact-line hash + reason (a repeated identical line is excused too, a different line is not)", () => {
  const line = "see Cr.No.777 of 2099";
  const dir = repo({ "frontend/src/a.ts": `${line}\nother\n${line}\nsee Cr.No.778 of 2099` });
  const id = "Cr.No <number> (crime number)";
  const v = check(dir, { allow: [{ file: "frontend/src/a.ts", id, line_sha256: sha(line), reason: "invented" }] });
  assert.ok(!v.some((x) => /a\.ts:(1|3):.*Cr\.No/.test(x)));
  assert.ok(v.some((x) => /a\.ts:4:.*Cr\.No/.test(x)));
});

test("planted failure: a 9-10 digit literal in a settings, config, .github or docs file fails (value never printed); the same digits elsewhere, in a UUID or a decimal do not; an allow entry excuses it", () => {
  const planted = { "frontend/src/app/settings/page.tsx": 'placeholder="4455667788"', "frontend/src/config/app.ts": "export const CHAT = 445566778;", "config/prod.yaml": "chat_id: 4455667788", "frontend/.env.example": "CHAT_ID=4455667788", ".github/workflows/x.yml": "id: 4455667788", "docs/runbook.md": "send to 4455667788" };
  for (const [rel, line] of Object.entries(planted)) {
    const v = check(repo({ [rel]: line }));
    assert.ok(v.some((x) => x.includes(LONG_DIGITS_ID)), `${rel} must fail`);
    for (const x of v) assert.ok(!/4455667788|445566778/.test(x), `value printed for ${rel}`);
  }
  for (const [rel, line] of Object.entries({ "frontend/src/lib/a.ts": "const t = 4455667788;", "docs/a.md": "uuid 00000000-0000-4000-8000-000000000001 and 12.4455667788 and v1234567890x and 12345678", "frontend/src/app/settings/b.ts": "const n = 1234567;" })) {
    assert.ok(!check(repo({ [rel]: line })).some((x) => x.includes(LONG_DIGITS_ID)), rel);
  }
  const line = 'placeholder="4455667788"';
  const dir = repo({ "frontend/src/app/settings/page.tsx": line });
  assert.equal(check(dir, { allow: [{ file: "frontend/src/app/settings/page.tsx", id: LONG_DIGITS_ID, line_sha256: sha(line), reason: "invented" }] }).filter((x) => x.includes(LONG_DIGITS_ID)).length, 0);
  assert.equal(check(dir, { allow: [{ file: "frontend/src/app/settings/page.tsx", id: LONG_DIGITS_ID, line_sha256: sha("x"), reason: "invented" }] }).length, 1);
});

test("CLI: exits 1 on a planted case number and on a planted name, 0 on a clean tree (names skipped), 1 when names are required but absent", () => {
  const run = (dir, args = [], env = {}) => spawnSync("node", [SCRIPT, "--root", dir, ...args], { encoding: "utf8", env: { ...process.env, CI: "", INVENTED_FIXTURE_NAMES_FILE: "", HOME: mkdtempSync(path.join(tmpdir(), "cif-home-")), ...env } });
  const clean = repo({ "frontend/src/a.ts": "const a = 1;" });
  const ok = run(clean);
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /SKIPPED the real-name check/);
  assert.equal(run(clean, ["--require-names"]).status, 1);
  assert.equal(run(clean, [], { CI: "true" }).status, 1); // a skipped name guard fails the job in CI
  const opt = run(clean, ["--names-optional"], { CI: "true" }); // until the secret exists: skipped, loudly
  assert.equal(opt.status, 0);
  assert.match(opt.stdout, /WARNING \(--names-optional\): SKIPPED/);
  assert.equal(run(bad0(), ["--names-optional"], { CI: "true" }).status, 1); // shapes still fail
  const bad = repo({ "frontend/src/a.ts": "Crl.O.P. 4321 of 2099" });
  const r = run(bad);
  assert.equal(r.status, 1);
  assert.ok(!r.stderr.includes("4321"));
  const named = repo({ "frontend/src/a.ts": `owner ${INVENTED_NAME}` });
  const nf = path.join(named, "n.txt");
  writeFileSync(nf, INVENTED_NAME);
  const r2 = run(named, ["--require-names"], { INVENTED_FIXTURE_NAMES_FILE: nf });
  assert.equal(r2.status, 1);
  assert.ok(!r2.stderr.toLowerCase().includes("zzyqx"));
});
