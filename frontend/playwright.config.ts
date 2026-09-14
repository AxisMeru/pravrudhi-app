import { defineConfig, devices } from "@playwright/test";

// The product's own interface, served by a running engine (LOCAL_ENGINE_URL; see README "Testing"). This
// repository ships one edition and one interface, so one project: every product page renders on a live engine
// and nothing here reaches for a Studio surface.
const engineURL: string = (process.env.LOCAL_ENGINE_URL ?? "http://127.0.0.1:8301").replace(/\/+$/, "");

// The nightly's target: the real hosted door (deploy/gateway/README.md's Worker in front of the real engine),
// not a local one — the one project in this repository that runs against production, signed in as a real
// account. LIVE_URL overrides for a rehearsal against a preview deployment.
const liveURL: string = (process.env.LIVE_URL ?? "https://pravrudhi-app.vercel.app").replace(/\/+$/, "");

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  reporter: "line",
  use: { baseURL: engineURL, ...devices["Desktop Chrome"] },
  projects: [
    {
      name: "product-chromium",
      testMatch: ["product.spec.ts", "signin-guards.spec.ts", "settings-byok.spec.ts", "models-providers.spec.ts"],
    },
    // The nightly's project only exists when the nightly's account is in the environment
    // (pravrudhi-e2e-nightly.service's EnvironmentFile): CI runs every project it can see and has no such
    // account, and a live door is not something a pull request should be able to fail on.
    ...(process.env.E2E_EMAIL
      ? [
          {
            name: "live-chromium",
            testMatch: "live.spec.ts",
            // A little more patience than the local-engine default: real network latency to a real, cold
            // hosted engine, not a process on localhost.
            timeout: 60_000,
            use: { baseURL: liveURL, ...devices["Desktop Chrome"] },
          },
        ]
      : []),
  ],
});
