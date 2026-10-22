import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

// The About page and the footer (app#519): the commit and the build time of THIS build, written once by the prebuild step (scripts/write-build-info.mjs) so all workers see the same values. Without the file
// (a dev server, a unit run) the sha is "unknown" and there is no build time: nothing is invented.
let appSha = "unknown";
let buildTime = "";
try {
  const f = join(process.cwd(), ".build-info.json");
  if (existsSync(f)) {
    const j = JSON.parse(readFileSync(f, "utf8")) as { sha?: unknown; builtAt?: unknown };
    if (typeof j.sha === "string" && /^[0-9a-f]{40}$/.test(j.sha)) appSha = j.sha;
    if (typeof j.builtAt === "string" && !Number.isNaN(Date.parse(j.builtAt))) buildTime = j.builtAt;
  }
} catch {
  /* keep the defaults */
}

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath,
  env: { NEXT_PUBLIC_APP_SHA: appSha, NEXT_PUBLIC_BUILD_TIME: buildTime },
};

export default nextConfig;
