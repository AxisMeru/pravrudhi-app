// Writes frontend/public/build.json = {"sha": "<40 hex>", "flags": {booleans}} so a deployed build says which commit it is and which flags it was built with (the pre-deploy gate reads /build.json on the deployment and on the alias and requires both
// to equal the gated sha). The sha is BUILD_SHA (passed with `vercel deploy --prod --build-env BUILD_SHA=<sha>`), else VERCEL_GIT_COMMIT_SHA, else "unknown"; anything that is not exactly 40
// lowercase hex characters is "unknown". Nothing else is written: no timestamp, no secrets, no other env. Wired as the "prebuild" step in package.json; the file is generated and gitignored.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function buildSha(env) {
  const raw = [env.BUILD_SHA, env.VERCEL_GIT_COMMIT_SHA].find((v) => typeof v === "string" && v.trim() !== "");
  const v = typeof raw === "string" ? raw.trim() : "";
  return /^[0-9a-f]{40}$/.test(v) ? v : "unknown";
}

// The flags the build used, read back by the pre-deploy gate from the live alias and compared with the gated record (a remote `vercel deploy --prod` builds with the Vercel project's
// Production env vars, not the ones the gate ran with). Booleans only: each is true only if the build env is EXACTLY "1"; no other env and no value but these booleans is written.
export const FLAG_ENV = {
  assistant_entry: "NEXT_PUBLIC_ASSISTANT_ENTRY",
  delete_confirmed: "NEXT_PUBLIC_ASSISTANT_DELETE_CONFIRMED",
  intake: "NEXT_PUBLIC_INTAKE",
  citation_nav: "NEXT_PUBLIC_CITATION_NAV",
  citation_existence_only: "NEXT_PUBLIC_CITATION_EXISTENCE_ONLY", // the Screening citations panel needs BOTH this and citation_nav (#190)
  look_tonal: "NEXT_PUBLIC_LOOK_TONAL", // the tonal look-and-feel patch (spec 3e0b13c4bdc8): html[data-look="tonal"]; unset = no look rule applies
  layout_matter_b: "NEXT_PUBLIC_LAYOUT_MATTER_B", // layout B "matter-b" (#144): html[data-layout="matter-b"]; unset = the live layout, unchanged
  workflows_v2: "NEXT_PUBLIC_WORKFLOWS_V2", // the workflows front door (Advisor Q6): the registry cards on /workflows and Workflows in the work nav; unset = /workflows and the nav as they were
};

export function buildFlags(env) {
  return Object.fromEntries(Object.entries(FLAG_ENV).map(([key, name]) => [key, env[name] === "1"]));
}

export function buildJson(env) {
  return JSON.stringify({ sha: buildSha(env), flags: buildFlags(env) }) + "\n";
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(here, "..", "public", "build.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildJson(process.env));
  console.log(`build.json: ${buildSha(process.env)}`);
}
