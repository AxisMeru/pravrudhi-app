import { defineConfig, devices } from "@playwright/test";
// Local rehearsal of the live specs against a local engine with recorded invented answers (SCREENING_LIVE_REHEARSAL=1 for the Screening spec, DEMO_LIVE_REHEARSAL=1 for the demo spec). Not part of CI.
export default defineConfig({ testDir: "./e2e", testMatch: ["screening-live.spec.ts", "demo-live.spec.ts"], timeout: 60000, reporter: "line", use: { baseURL: "http://127.0.0.1:8301", ...devices["Desktop Chrome"] } });
