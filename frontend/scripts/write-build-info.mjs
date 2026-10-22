// Writes frontend/.build-info.json = {"sha": "<40 hex | unknown>", "builtAt": "<ISO UTC>"} for the About page and the footer (app#519). Read by next.config.ts and inlined as NEXT_PUBLIC_APP_SHA / NEXT_PUBLIC_BUILD_TIME, so every
// page and the client bundle of ONE build carry the same two values (taken once here, not per build worker). The sha follows write-build-json.mjs exactly (BUILD_SHA, else VERCEL_GIT_COMMIT_SHA, 40 lowercase hex or "unknown").
// public/build.json is NOT changed (the pre-deploy gate reads sha + flags there). Nothing else is written: no env, no secret. Wired as part of the "prebuild" step; the file is generated and gitignored.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSha } from "./write-build-json.mjs";

export function buildInfoJson(env, now = new Date()) {
  return JSON.stringify({ sha: buildSha(env), builtAt: now.toISOString() }) + "\n";
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(here, "..", ".build-info.json"), buildInfoJson(process.env));
  console.log("build-info.json written");
}
