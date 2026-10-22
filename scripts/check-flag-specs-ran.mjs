// CI guard for the e2e-shipped job: a Playwright run exits 0 when specs SKIP, so if the production flags stopped reaching the test process the flag-gated specs would skip and the job would stay
// green. This reads Playwright's JSON report and fails unless each required spec file RAN: at least `minExpected` tests passed ("expected"), and no more than `maxSkipped` skipped (null = any).
// The groups match the pre-deploy gate's required-ran groups. assistant-tier skips one test on purpose in a flags-ON build, so it is checked on expected only.
// Usage: node scripts/check-flag-specs-ran.mjs <playwright-report.json>
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export const REQUIRED = {
  "assistant-run": { minExpected: 1, maxSkipped: 0 },
  "assistant-tier": { minExpected: 1, maxSkipped: null },
  "intake": { minExpected: 1, maxSkipped: 0 },
  "anonymous-assistant": { minExpected: 1, maxSkipped: 0 },
  // "Your matters" (cut 2): in the flag-ON build the two ON tests run and the one flag-OFF test skips on purpose, so two passes and at most one skip.
  "your-matters": { minExpected: 2, maxSkipped: 1 },
};

/** Walks the report's suites and counts, per spec file (name without .spec.ts), the tests by final status. */
export function countByFile(report) {
  const counts = {};
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const file = basename(spec.file ?? suite.file ?? "").replace(/\.spec\.ts$/, "");
      const c = (counts[file] ??= { expected: 0, skipped: 0, unexpected: 0, flaky: 0 });
      for (const t of spec.tests ?? []) {
        const status = t.status ?? "unexpected";
        if (status in c) c[status] += 1;
      }
    }
    for (const s of suite.suites ?? []) walk(s);
  };
  for (const s of report.suites ?? []) walk(s);
  return counts;
}

/** Returns the list of failures (empty = every required spec file ran). */
export function check(report, required = REQUIRED) {
  const counts = countByFile(report);
  const failures = [];
  for (const [file, rule] of Object.entries(required)) {
    const c = counts[file] ?? { expected: 0, skipped: 0, unexpected: 0, flaky: 0 };
    if (c.expected < rule.minExpected) failures.push(`${file}: ${c.expected} passed, need at least ${rule.minExpected} (skipped ${c.skipped}, failed ${c.unexpected})`);
    if (rule.maxSkipped !== null && c.skipped > rule.maxSkipped) failures.push(`${file}: ${c.skipped} skipped, at most ${rule.maxSkipped} allowed`);
  }
  return failures;
}

if (process.argv[1] && basename(process.argv[1]) === "check-flag-specs-ran.mjs") {
  const path = process.argv[2];
  if (!path) { console.error("usage: node scripts/check-flag-specs-ran.mjs <playwright-report.json>"); process.exit(2); }
  const report = JSON.parse(readFileSync(path, "utf8"));
  const counts = countByFile(report);
  for (const file of Object.keys(REQUIRED)) console.log(`${file}: ${JSON.stringify(counts[file] ?? { expected: 0, skipped: 0, unexpected: 0, flaky: 0 })}`);
  const failures = check(report);
  if (failures.length > 0) { console.error("the flag-gated specs did not run:\n  " + failures.join("\n  ")); process.exit(1); }
  console.log("every required flag-gated spec ran");
}
