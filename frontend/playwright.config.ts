import { defineConfig, devices } from "@playwright/test";

// The product's own interface, served by a running engine (LOCAL_ENGINE_URL; see README "Testing"). This
// repository ships one edition and one interface, so one project: every product page renders on a live engine
// and nothing here reaches for a Studio surface.
const engineURL: string = (process.env.LOCAL_ENGINE_URL ?? "http://127.0.0.1:8301").replace(/\/+$/, "");

// The nightly's target: the real hosted door (deploy/gateway/README.md's Worker in front of the real engine),
// not a local one — the one project in this repository that runs against production, signed in as a real
// account. LIVE_URL overrides for a rehearsal against a preview deployment.
const liveURL: string = (process.env.LIVE_URL ?? "https://pravrudhi-app.vercel.app").replace(/\/+$/, "");

// The Worker in front of the real engine, reached DIRECTLY (never through the Vercel origin above, which has
// no /api/* rewrite of its own — the browser app reaches it only via a build-time NEXT_PUBLIC_API_BASE baked
// into the Vercel deployment, never a relative path). Partner-API specs have no frontend page to click
// through at all (no /orgs UI exists), so they use Playwright's own `request` fixture directly against this
// origin rather than a browser. LIVE_ENGINE_URL overrides for a rehearsal against a different Worker/stage.
const liveEngineURL: string = (process.env.LIVE_ENGINE_URL ?? "https://pravrudhi-app.axismeru.workers.dev").replace(/\/+$/, "");

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  reporter: "line",
  use: { baseURL: engineURL, ...devices["Desktop Chrome"] },
  projects: [
    {
      name: "product-chromium",
      testMatch: [
        "product.spec.ts", "signin-guards.spec.ts", "settings-byok.spec.ts", "models-providers.spec.ts",
        "run-plain-language.spec.ts", "matters.spec.ts", "matters-pdf-upload.spec.ts",
      ],
    },
    // The nightly's project only exists when the nightly's account is in the environment
    // (pravrudhi-e2e-nightly.service's EnvironmentFile): CI runs every project it can see and has no such
    // account, and a live door is not something a pull request should be able to fail on.
    ...(process.env.E2E_EMAIL
      ? [
          {
            name: "live-chromium",
            testMatch: ["live.spec.ts", "matters-live.spec.ts", "nyaya-live.spec.ts"],
            // A little more patience than the local-engine default: real network latency to a real, cold
            // hosted engine, not a process on localhost.
            timeout: 60_000,
            use: { baseURL: liveURL, ...devices["Desktop Chrome"] },
          },
          // Pure API specs, no browser: partner-api-live.spec.ts hits the Worker directly with Playwright's
          // own `request` fixture (see liveEngineURL's own comment for why this can't share live-chromium's
          // baseURL).
          {
            name: "live-api",
            testMatch: ["partner-api-live.spec.ts"],
            timeout: 30_000,
            use: { baseURL: liveEngineURL },
          },
        ]
      : []),
  ],
});
