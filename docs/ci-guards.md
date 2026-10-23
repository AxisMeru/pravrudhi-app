# CI checks and guards

What runs on every pull request and push to `main` (`.github/workflows/ci.yml`), and what each check protects. A change merges only with these green and the reviews it needs.

## Jobs

| Job | What it runs | Protects |
|---|---|---|
| `private-data` | The guard tests (`node --test scripts/test/*.test.mjs`), `scripts/check-no-private-data.mjs`, `scripts/check-invented-fixtures.mjs` | That this public repository carries no real identifiers or personal data. |
| `frontend` | The benchmark-results data gate, `tsc --noEmit`, `eslint . --max-warnings=0`, the unit tests, a production build | Types, lint, logic, and that the page still builds. |
| `docs` | `npm run docs` in `frontend/` (TypeDoc) | That the library reference still builds. Build-only: the HTML is kept as a run artifact for 7 days and is not committed. |
| `desktop` | `node --test test/` in `desktop/` | The Electron shell's logic. |
| `e2e` (three shards: `e2e-shard (1..3)`) | Builds the interface, installs the engine release pinned in `engine/ENGINE_VERSION`, serves the built pages from a product engine and runs the whole Playwright suite split in three | That the pages work against the real engine, with the engine's answers mocked where a test must not need a model. `e2e` is the aggregate and fails if any shard fails. |
| `e2e-shipped` (three shards) | The same suite built with the flag set the deployed build uses | That the flag set the deployed build uses is also run through the whole suite. |

## The guards

**Private data (`scripts/check-no-private-data.mjs`).** Fixtures and e2e specs must not contain anything that looks like a recorded identifier: session, thread or response ids, UUIDs, emails, host home paths, account or plan fields, tokens. A test UUID must have the invented shape `00000000-0000-4000-8000-` followed by twelve digits. It prints `path:line: pattern`, never the value. It is a pattern scan: an identifier with no recognisable shape is not caught, so review still matters.

**Invented fixtures (`scripts/check-invented-fixtures.mjs`).** The whole repository is scanned for real names and for the shapes that identify a real case or complaint (the registration and docket numbers courts and police assign, and dated numeric forms) and for contact-detail shapes. The exact patterns are in the guard's own header and are deliberately not repeated in the docs. The shape patterns always run. The list of real names is never kept in the repository: CI reads it from a repository secret at run time, and a pull request from a fork, which cannot read secrets, skips only the name check and says so. A deliberate exception is one line in `scripts/invented-fixture-allow.json` keyed by file, pattern id, a hash of the exact line and a reason; the line number is not part of the key.

**Flag specs ran (`scripts/check-flag-specs-ran.mjs`).** Playwright exits 0 when specs are skipped, so if the production flags stopped reaching the test process the flagged specs would skip and the job would stay green. This guard reads the JSON report of the shipped job and fails unless each required spec file ran: at least the stated number of tests passed and no more than the allowed number were skipped.

**Benchmark results gate (`scripts/benchmarks/validate_page_data.py`).** A vendored validator for `frontend/public/benchmark_results.json`: it fails on a number that has not been reviewed, a banned word, or a result sentence that the page templates would not produce.

**Pinned strings.** Text a customer reads is reviewed word by word. Specs pin such strings exactly, or by the first eight hex characters of their sha256, so changing a sentence changes a spec and shows up as a deliberate diff. `src/lib/noTrainingPromise.spec.ts` guards the model and training sentences in particular. If a pin fails after you edited wording, the wording needs its reviewer, not a new pin.

**Engine code coverage (`src/lib/engineEnumCoverage*.spec.ts`).** The engine's error codes, reasons and statuses are copied into `src/lib/fixtures/`; specs fail when the engine adds a code the page does not handle.

## Running them locally

```bash
node --test scripts/test/*.test.mjs
node scripts/check-no-private-data.mjs
node scripts/check-invented-fixtures.mjs --names-optional   # no name list locally
cd frontend && npm test && npx eslint . --max-warnings=0 && npx tsc --noEmit
```

The end-to-end commands are in [`../frontend/README.md`](../frontend/README.md#testing). A local run of the default build does not enable the flags the shipped build uses, so a few flag-gated specs skip or differ; CI is the authority.
