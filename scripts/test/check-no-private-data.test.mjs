// All values here are constructed for these tests.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { check } from "../check-no-private-data.mjs";

const REAL_SHAPED = "3f2b8c1e-5d4a-4b7e-9c10-8a6f2d9e7b34";
const UUID7 = "01a0fcb0-974b-7080-a4fe-f8bf6f3a4e23";
const CONSTRUCTED = "00000000-0000-4000-8000-000000000001";

function repo(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "cnpd-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return check(dir);
}

test("known positive: real-shaped session_id in a fixture fails and the value is not printed", () => {
  const v = repo({ "frontend/fixtures/claude_0.json": JSON.stringify({ session_id: REAL_SHAPED }) });
  assert.equal(v.length, 1);
  assert.match(v[0], /claude_0\.json:1/);
  assert.ok(!v[0].includes(REAL_SHAPED));
});
test("uuid7 thread id fails", () => assert.equal(repo({ "desktop/test/a.json": `{"thread_id":"${UUID7}"}` }).length, 1));
test("constructed uuid passes", () => assert.deepEqual(repo({ "desktop/test/a.json": `{"thread_id":"${CONSTRUCTED}"}` }), []));
test("response id", () => {
  assert.equal(repo({ "frontend/e2e/a.ts": 'x = "resp_03d7d84f7dc71633016abfaa55a5d887d2b529e5"' }).length, 1);
  assert.deepEqual(repo({ "frontend/e2e/a.ts": 'x = "resp_constructed_01"' }), []);
});
test("emails: real fails, example and single-letter test domains pass", () => {
  assert.equal(repo({ "frontend/e2e/a.ts": "someone@gmail.com" }).length, 1);
  assert.deepEqual(repo({ "frontend/e2e/a.ts": "a@example.com a@b.c" }), []);
});
test("home paths", () => {
  assert.equal(repo({ "desktop/test/a.js": "/home/ss/projects" }).length, 1);
  assert.deepEqual(repo({ "desktop/test/a.js": "/home/user/projects /home/x/y" }), []);
});
test("account fields", () => {
  assert.equal(repo({ "frontend/fixtures/a.json": '{"plan_type": "plus"}' }).length, 1);
  assert.deepEqual(repo({ "frontend/fixtures/a.json": '{"plan_type": "example-plan", "email": ""}' }), []);
});
test("token shapes: real fails, sk-test- placeholder passes", () => {
  assert.equal(repo({ "frontend/e2e/a.ts": "k = 'hf_" + "a".repeat(34) + "'" }).length, 1);
  assert.deepEqual(repo({ "frontend/e2e/a.ts": "k = 'sk-test-key-" + "a".repeat(20) + "'" }), []);
});
test("same values outside scope and non-text files are not flagged", () => {
  assert.deepEqual(repo({ "docs/a.md": `${REAL_SHAPED} a@gmail.com /home/ss/x`, "desktop/test/a.bin": REAL_SHAPED }), []);
});
