import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Lead-2 (14 Oct): a merge to main must NOT deploy production. Vercel deployed fa68ce92 on a git trigger at 20:08, ungated. Production deploys only through the gated script (post_pro_deploy.py,
// which refuses a SHA without the full-suite record). This fails if anyone turns git deployments back on for main or for any other branch, or drops the ignoreCommand.
const vercel = JSON.parse(readFileSync(join(__dirname, "..", "..", "vercel.json"), "utf8")) as { git?: { deploymentEnabled?: Record<string, unknown> }; ignoreCommand?: string };

test("vercel.json: git deployments are OFF for main and for every other branch", () => {
  const d = vercel.git?.deploymentEnabled;
  assert.ok(d, "git.deploymentEnabled is present");
  assert.strictEqual(d.main, false, "main must be false: a merge to main must not deploy production");
  assert.strictEqual(d["*"], false, "every other branch must be false");
  for (const [branch, on] of Object.entries(d)) assert.strictEqual(on, false, `${branch} must not deploy on a git push`);
});

test("vercel.json keeps its ignoreCommand", () => {
  assert.equal(vercel.ignoreCommand, "bash scripts/vercel-ignore-build.sh");
});

// The build marker (L2A / R2, 14 Oct): the gate reads /build.json on the deployment and on the alias and requires both to equal the gated sha.
const SHA = "0123456789abcdef0123456789abcdef01234567";

test("build.json: a valid 40-hex BUILD_SHA is written; BUILD_SHA wins over VERCEL_GIT_COMMIT_SHA; the latter is the fallback", async () => {
  const { buildSha, buildJson } = await import("../../scripts/write-build-json.mjs");
  assert.equal(buildSha({ BUILD_SHA: SHA }), SHA);
  assert.equal(buildSha({ BUILD_SHA: SHA, VERCEL_GIT_COMMIT_SHA: "f".repeat(40) }), SHA);
  assert.equal(buildSha({ VERCEL_GIT_COMMIT_SHA: "f".repeat(40) }), "f".repeat(40));
  assert.equal(buildSha({ BUILD_SHA: "", VERCEL_GIT_COMMIT_SHA: "f".repeat(40) }), "f".repeat(40));
  assert.deepEqual(Object.keys(JSON.parse(buildJson({ BUILD_SHA: SHA }))).sort(), ["flags", "sha"], "exactly two top-level keys: nothing else is written");
});

test("build.json: a missing or malformed sha is 'unknown', never anything else", async () => {
  const { buildSha, buildJson } = await import("../../scripts/write-build-json.mjs");
  for (const env of [{}, { BUILD_SHA: "" }, { BUILD_SHA: "abc" }, { BUILD_SHA: SHA.toUpperCase() }, { BUILD_SHA: SHA + "0" }, { BUILD_SHA: `${SHA}\n; echo` }, { BUILD_SHA: "main" }, { BUILD_SHA: "g".repeat(40) }]) {
    assert.equal(buildSha(env as Record<string, string>), "unknown", JSON.stringify(env));
  }
  assert.equal(JSON.parse(buildJson({})).sha, "unknown");
});

test("build.json is wired as the prebuild step and the generated file is gitignored", () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts.prebuild, "node scripts/write-build-json.mjs");
  const ignore = readFileSync(join(__dirname, "..", "..", "..", ".gitignore"), "utf8").split("\n").map((l) => l.trim());
  assert.ok(ignore.includes("frontend/public/build.json"), "public/build.json is generated, not committed");
});

// A2/A3 (R2, gate v6): the flags the build used, as booleans, true only for the exact string "1".
const FLAGS_ENV_NAMES = { a: "NEXT_PUBLIC_ASSISTANT_ENTRY", d: "NEXT_PUBLIC_ASSISTANT_DELETE_CONFIRMED", i: "NEXT_PUBLIC_INTAKE", c: "NEXT_PUBLIC_CITATION_NAV", e: "NEXT_PUBLIC_CITATION_EXISTENCE_ONLY", l: "NEXT_PUBLIC_LOOK_TONAL", m: "NEXT_PUBLIC_LAYOUT_MATTER_B" };
const FLAGS_ENV = { NEXT_PUBLIC_ASSISTANT_ENTRY: "1", NEXT_PUBLIC_ASSISTANT_DELETE_CONFIRMED: "1", NEXT_PUBLIC_INTAKE: "1", NEXT_PUBLIC_CITATION_NAV: "1", NEXT_PUBLIC_CITATION_EXISTENCE_ONLY: "1", NEXT_PUBLIC_LOOK_TONAL: "1", NEXT_PUBLIC_LAYOUT_MATTER_B: "1" };

test("build.json flags: all seven set to '1' are all true; all unset are all false; exactly two top-level keys and exactly seven flag keys", async () => {
  const { buildJson } = await import("../../scripts/write-build-json.mjs");
  const on = JSON.parse(buildJson({ BUILD_SHA: SHA, ...FLAGS_ENV }));
  assert.deepEqual(on.flags, { assistant_entry: true, delete_confirmed: true, intake: true, citation_nav: true, citation_existence_only: true, look_tonal: true, layout_matter_b: true });
  const off = JSON.parse(buildJson({ BUILD_SHA: SHA }));
  assert.deepEqual(off.flags, { assistant_entry: false, delete_confirmed: false, intake: false, citation_nav: false, citation_existence_only: false, look_tonal: false, layout_matter_b: false });
  for (const j of [on, off]) {
    assert.deepEqual(Object.keys(j).sort(), ["flags", "sha"]);
    assert.deepEqual(Object.keys(j.flags).sort(), ["assistant_entry", "citation_existence_only", "citation_nav", "delete_confirmed", "intake", "layout_matter_b", "look_tonal"]);
    assert.ok(Object.values(j.flags).every((v) => typeof v === "boolean"));
  }
  assert.equal(on.sha, SHA, "the sha rule is unchanged");
});

test("build.json flags: only the exact string '1' is true ('true', '0', '', ' 1', '1 ', 'yes', 'TRUE' are false), each flag independently", async () => {
  const { buildFlags } = await import("../../scripts/write-build-json.mjs");
  for (const v of ["true", "0", "", " 1", "1 ", "yes", "TRUE", "on", "11", "1\n"]) {
    for (const name of Object.values(FLAGS_ENV_NAMES)) assert.equal(Object.values(buildFlags({ [name]: v })).some(Boolean), false, `${name}=${JSON.stringify(v)}`);
  }
  assert.deepEqual(buildFlags({ NEXT_PUBLIC_INTAKE: "1" }), { assistant_entry: false, delete_confirmed: false, intake: true, citation_nav: false, citation_existence_only: false, look_tonal: false, layout_matter_b: false });
  assert.deepEqual(buildFlags({ NEXT_PUBLIC_ASSISTANT_ENTRY: "1", NEXT_PUBLIC_ASSISTANT_DELETE_CONFIRMED: "true" }), { assistant_entry: true, delete_confirmed: false, intake: false, citation_nav: false, citation_existence_only: false, look_tonal: false, layout_matter_b: false });
});

test("build.json carries no other env: unrelated variables, including secret-looking ones, never appear", async () => {
  const { buildJson } = await import("../../scripts/write-build-json.mjs");
  const out = buildJson({ BUILD_SHA: SHA, ...FLAGS_ENV, SUPABASE_SERVICE_KEY: "secret-value", NEXT_PUBLIC_SUPABASE_URL: "https://x.example", NEXT_PUBLIC_API_BASE: "https://api.example" });
  assert.doesNotMatch(out, /secret-value|x\.example|api\.example|SUPABASE|API_BASE/);
});

// A3 (R2, 15 Oct): the Screening citations panel needs BOTH citation flags, so the marker records the existence-only flag too, independently of the nav flag.
test("build.json flags: citation_existence_only is its own flag, independent of citation_nav", async () => {
  const { buildFlags } = await import("../../scripts/write-build-json.mjs");
  assert.deepEqual(buildFlags({ NEXT_PUBLIC_CITATION_EXISTENCE_ONLY: "1" }), { assistant_entry: false, delete_confirmed: false, intake: false, citation_nav: false, citation_existence_only: true, look_tonal: false, layout_matter_b: false });
  assert.deepEqual(buildFlags({ NEXT_PUBLIC_CITATION_NAV: "1" }), { assistant_entry: false, delete_confirmed: false, intake: false, citation_nav: true, citation_existence_only: false, look_tonal: false, layout_matter_b: false });
});

// The look patch flag is its own key and, like every flag, true only for the exact string "1".
test("build.json flags: look_tonal is its own flag, independent of the others", async () => {
  const { buildFlags } = await import("../../scripts/write-build-json.mjs");
  assert.deepEqual(buildFlags({ NEXT_PUBLIC_LOOK_TONAL: "1" }), { assistant_entry: false, delete_confirmed: false, intake: false, citation_nav: false, citation_existence_only: false, look_tonal: true, layout_matter_b: false });
  assert.equal(buildFlags({ NEXT_PUBLIC_LOOK_TONAL: "tonal" }).look_tonal, false);
  assert.equal(buildFlags({ NEXT_PUBLIC_INTAKE: "1" }).look_tonal, false);
});

// The layout B ON switch (#144): its own flag, NEXT_PUBLIC_LAYOUT_MATTER_B, true only for the exact string "1", independent of look_tonal.
test("build.json flags: layout_matter_b is its own flag, independent of look_tonal", async () => {
  const { buildFlags } = await import("../../scripts/write-build-json.mjs");
  assert.deepEqual(buildFlags({ NEXT_PUBLIC_LAYOUT_MATTER_B: "1" }), { assistant_entry: false, delete_confirmed: false, intake: false, citation_nav: false, citation_existence_only: false, look_tonal: false, layout_matter_b: true });
  for (const v of ["true", "0", "", " 1", "1 ", "yes", "TRUE", "matter-b"]) assert.equal(buildFlags({ NEXT_PUBLIC_LAYOUT_MATTER_B: v }).layout_matter_b, false, JSON.stringify(v));
  assert.equal(buildFlags({ NEXT_PUBLIC_LOOK_TONAL: "1" }).layout_matter_b, false);
});

// R2's LOW on the ON switch: the key ORDER of build.json's flags is part of the contract (the gate harness and Track A's cut read it), so it is pinned, not just the set.
test("build.json flags: the seven keys come in this exact order, look_tonal before layout_matter_b", async () => {
  const { buildJson } = await import("../../scripts/write-build-json.mjs");
  assert.deepEqual(Object.keys(JSON.parse(buildJson({ BUILD_SHA: SHA })).flags), ["assistant_entry", "delete_confirmed", "intake", "citation_nav", "citation_existence_only", "look_tonal", "layout_matter_b"]);
});
