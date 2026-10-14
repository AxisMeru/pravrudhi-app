// Writes frontend/public/build.json = {"sha": "<40 hex>"} so a deployed build says which commit it is (the pre-deploy gate reads /build.json on the deployment and on the alias and requires both
// to equal the gated sha). The sha is BUILD_SHA (passed with `vercel deploy --prod --build-env BUILD_SHA=<sha>`), else VERCEL_GIT_COMMIT_SHA, else "unknown"; anything that is not exactly 40
// lowercase hex characters is "unknown". Nothing else is written: no timestamp, no secrets. Wired as the "prebuild" step in package.json; the file is generated and gitignored.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function buildSha(env) {
  const raw = [env.BUILD_SHA, env.VERCEL_GIT_COMMIT_SHA].find((v) => typeof v === "string" && v.trim() !== "");
  const v = typeof raw === "string" ? raw.trim() : "";
  return /^[0-9a-f]{40}$/.test(v) ? v : "unknown";
}

export function buildJson(env) {
  return JSON.stringify({ sha: buildSha(env) }) + "\n";
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(here, "..", "public", "build.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildJson(process.env));
  console.log(`build.json: ${buildSha(process.env)}`);
}
