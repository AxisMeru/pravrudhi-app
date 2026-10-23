# frontend

The Pravrudhi-Nyaya interface: a Next.js static export (`output: "export"`, no server rendering), React 19, Tailwind 4, TypeScript. It is served on the web by Vercel and, inside the desktop shell, by the local engine. All data comes from the engine over HTTPS; the app holds no model and no case data of its own.

## Layout

| Path | What |
|---|---|
| `src/app/` | Pages (App Router): `/` (Home), `/screening`, `/matters`, `/workflows`, `/matter-tools`, `/citations`, `/settings`, `/guide`, `/demo`, `/technical-film`, `/data-handling`, `/safety`, `/benchmarks`, `/how-it-was-built`, `/about`, `/admin/access`, `/signin`. The remaining routes (`/chat`, `/memory`, `/models`, `/objectives`, ...) belong to the Studio edition and are never offered to the product edition. |
| `src/components/` | Shared UI, grouped by page area. |
| `src/lib/` | Everything that is not markup: engine client (`api.ts`), error classification (`serviceStatus.ts`), the cold-start client (`wake/`), the edition gate (`edition.ts`, `demoPath.ts`), screening models and copy. Unit specs sit beside the code as `*.spec.ts`. |
| `src/data/` | Static data (release notes). |
| `public/` | Static assets and the benchmark-results data file. |
| `e2e/` | Playwright specs. |
| `typedoc.json` | The library reference: entry points are the engine client, error classification, edition gate, wake client, facts limits, offences and the admin access client. Add a module to `entryPoints` to document it. |
| `scripts/` | Build-time scripts (`write-build-json.mjs`, `write-build-info.mjs`) and tooling. |

## Scripts

```bash
npm ci
npm run dev       # next dev
npm run build     # prebuild writes build.json and build info, then next build (static export to out/)
npm test          # unit tests: tsx --test "src/**/*.spec.ts"
npm run lint      # eslint .
npx tsc --noEmit
npm run e2e       # playwright test
npm run docs      # TypeDoc library reference into ../docs/reference (git-ignored; CI builds it as a check)
```

CI runs the type-check, `eslint --max-warnings=0`, the unit tests and a build on every pull request; see [`../docs/ci-guards.md`](../docs/ci-guards.md).

## Build-time configuration

Everything the page needs at run time is decided when it is built. All flags are the exact string `"1"` to turn on; with a flag unset the page behaves as it did before the feature, so rollback is "unset and rebuild". The flags that were on in the build are recorded in `build.json` (served at `/build.json` with the commit sha).

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_API_BASE` | Origin of the hosted engine. Empty on a build served by the engine itself, which then uses its own origin. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The Supabase project used for sign-in (publishable values only). Without them the sign-in form is not rendered. |
| `NEXT_PUBLIC_BASE_PATH` | Sub-path the export is served under, if any. |
| `NEXT_PUBLIC_DEMO` | Forces the recorded-demo mode for local run of the public site. No production build sets it. |
| Feature flags: `NEXT_PUBLIC_INTAKE`, `NEXT_PUBLIC_CITATION_NAV`, `NEXT_PUBLIC_CITATION_EXISTENCE_ONLY`, `NEXT_PUBLIC_LAYOUT_MATTER_B`, `NEXT_PUBLIC_LOOK_TONAL`, `NEXT_PUBLIC_WORKFLOWS_V2`, `NEXT_PUBLIC_DRAFTING_CARDS`, `NEXT_PUBLIC_SCANNED_INTAKE`, `NEXT_PUBLIC_ASSISTANT_ENTRY`, `NEXT_PUBLIC_ASSISTANT_DELETE_CONFIRMED`, and the others in `src/lib` | Turn one feature on. Several have a matching `*_BUILD` variable that the build scripts read. `vercel.json` and `src/lib/vercelConfig.spec.ts` pin which flags the deployed build sets. |
| `NEXT_PUBLIC_APP_SHA`, `NEXT_PUBLIC_BUILD_TIME` | Written by the build scripts; shown in the page footer. |

## Which engine, and which edition

`src/lib/api.ts` decides the engine origin: `NEXT_PUBLIC_API_BASE` when set, otherwise the page's own origin. Every engine call goes through `engineFetch`, which attaches the signed-in user's token and renews it once on a 401. `GET /api/me` says who is asking (`access` is `admin`, `member` or `none`) and which edition the engine is (`src/lib/edition.ts`). The product edition shows Home, Screening, Your matters and the workflows; the Studio edition keeps its own pages, which the product never shows. The route allow-lists are in `src/lib/demoPath.ts`.

## Cold start (wake) client

The analysis models are normally switched off. The screening page handles that without a spinner that hides what is happening:

1. It sends `POST /api/v1/analyse-facts`. If the engine answers `503 {"error":"judges_offline"}`, the page asks the engine to start the models: `POST /api/v1/analyse-facts/wake` (no body).
2. It polls `GET /api/v1/analyse-facts/wake/status` at the engine's own cadence (2 to 10 s, default 5 s) and shows one row per model: waiting, starting, ready or failed. It never shows a percentage or a time it was not told.
3. The client stops waiting at `DEFAULT_MAX_MS` = **600 s**, or the engine's `deadline_s` plus a 30 s margin, whichever is smaller (`src/lib/wake/wakeRun.ts`). Three failed status reads in a row also stop it.
4. When the wake is ready (or partial, with a one-time ticket), the **page** sends the screening itself, with the ticket in the `x-wake-ticket` header. The engine does not run it for the user.
5. A screening that is refused right after a ready wake, because the models are up but not serving yet (`503 agent_unavailable`, or `503 judge_unavailable` with reason `judges_warming`), is sent again with the same body and ticket, up to 5 retries. Between tries the page waits 45 s, or the engine's `retry_after_s` for `judges_warming` (kept between 5 and 120 s). The waits add up to at most 540 s, so the last try cannot meet an expired ticket. While it waits, the page says so, keeps the elapsed counter and keeps Cancel. Any other answer ends the screening at once; after the last try the page shows the ordinary refusal. No further wake is ever started by a retry.

## Screening limits enforced in the page

Facts: 1 to 8, each at most 4000 characters. Offences: one offence can carry several of the engine's contract ids, and the engine accepts 1 to 5 ids per request; above that the Screen button is disabled with a reason line tied to it by `aria-describedby`. These limits mirror the engine's; the page refuses before sending so no request is wasted.

## Testing

Unit tests need nothing running. The end-to-end suite needs a product engine serving the built pages:

```bash
npm run build
PRAVRUDHI_EDITION=product PRAVRUDHI_FRONTEND_DIR=$PWD/out pravrudhi app --root <a root made by pravrudhi init> --no-browser --port 8301
LOCAL_ENGINE_URL=http://127.0.0.1:8301 npx playwright test --project=product-chromium
```

Projects (`playwright.config.ts`):

- `product-chromium`: every spec in `e2e/` against the local product engine. Most specs mock the engine routes with `page.route`, so no judge is needed. The cold-start specs use `page.clock` to move time.
- `studio-chromium`: the Studio-edition pages, against a second engine (`STUDIO_ENGINE_URL`).
- `live-chromium`, `live-api`: opt-in checks against the deployed site; they exist only when the operator sets an explicit go flag, so CI and agent sessions never run them.

CI splits the product suite into three shards and, separately, runs the "shipped" job with the production flag set (`e2e-shipped`); see [`../docs/ci-guards.md`](../docs/ci-guards.md).

## Conventions

- **Words are reviewed.** Strings a customer reads are pinned in specs, usually by a short sha256 prefix, so a wording change is a visible diff for the reviewer. Do not paraphrase a pinned string.
- **No numbers the page cannot source.** No counts, rates or intervals appear without their source and label.
- **Invented fixtures only.** Test data is invented; real names, case numbers and contact details are refused by CI.
- **A flag that is off must change nothing.** Specs for a flagged feature also assert the flag-off page.
