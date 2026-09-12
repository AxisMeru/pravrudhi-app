import { defineConfig, devices } from "@playwright/test";

// The product's own interface, served by a running engine (LOCAL_ENGINE_URL; see README "Testing"). This
// repository ships one edition and one interface, so one project: every product page renders on a live engine
// and nothing here reaches for a Studio surface.
const engineURL: string = (process.env.LOCAL_ENGINE_URL ?? "http://127.0.0.1:8301").replace(/\/+$/, "");

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  reporter: "line",
  use: { baseURL: engineURL, ...devices["Desktop Chrome"] },
  projects: [{ name: "product-chromium", testMatch: ["product.spec.ts", "signin-guards.spec.ts"] }],
});
