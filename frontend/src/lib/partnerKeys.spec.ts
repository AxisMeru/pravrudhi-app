import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { viewFor } from "./partnerKeys";

const key = (id: string, revoked = false) => ({
  key_id: id, org_id: "acme", label: id, created: "2026-10-01", revoked, revoked_at: null, rate_limit_per_minute: 60,
});

test("non-admin answers read as not-found, never as an error page", () => {
  for (const s of [401, 403, 404]) assert.deepEqual(viewFor(s, [], []), { kind: "not-found" });
});

test("other failures are an error; no keys is empty", () => {
  assert.deepEqual(viewFor(500, [], []), { kind: "error" });
  assert.deepEqual(viewFor(null, [], []), { kind: "empty" });
});

test("rows sum usage per key and keep revoked keys with their history", () => {
  const v = viewFor(null, [key("k1"), key("k2", true), key("k3")], [
    { key_id: "k1", label: "k1", revoked: false, days: [{ day: "2026-10-01", calls: 3, failed: 1 }, { day: "2026-10-02", calls: 2, failed: 0 }] },
    { key_id: "k2", label: "k2", revoked: true, days: [{ day: "2026-09-30", calls: 5, failed: 2 }] },
  ]);
  assert.equal(v.kind, "rows");
  if (v.kind !== "rows") return;
  assert.deepEqual(v.rows.map((r) => [r.keyId, r.total, r.failed, r.revoked]), [
    ["k1", 5, 1, false], ["k2", 5, 2, true], ["k3", 0, 0, false],
  ]);
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("no provisioning secret or header exists in the app source", () => {
  const files = walk(join(__dirname, "..")).filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".spec.ts"));
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    assert.ok(!/PROVISION_SECRET|x-pravrudhi-tenancy-secret/i.test(text), f);
  }
});

test("copySecret reports a copy, and reports a missing or refusing clipboard as a failure", async () => {
  const { copySecret } = await import("./partnerKeys");
  const written: string[] = [];
  assert.equal(await copySecret({ writeText: async (t) => void written.push(t) }, "sk-test-secret"), "copied");
  assert.deepEqual(written, ["sk-test-secret"]);
  assert.equal(await copySecret(undefined, "x"), "failed");
  assert.equal(await copySecret(null, "x"), "failed");
  assert.equal(await copySecret({}, "x"), "failed");
  assert.equal(await copySecret({ writeText: async () => { throw new Error("NotAllowedError"); } }, "x"), "failed");
  assert.equal(await copySecret({ writeText: () => Promise.reject(new Error("denied")) }, "x"), "failed");
});

test("the one-time secret has a finite lifetime", async () => {
  const { SECRET_TTL_MS } = await import("./partnerKeys");
  assert.ok(SECRET_TTL_MS > 0 && SECRET_TTL_MS <= 120_000);
});
