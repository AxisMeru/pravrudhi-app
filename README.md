# Pravrudhi-Nyaya (app)

The web app, and the desktop shell around it, for **Pravrudhi-Nyaya**: a screening aid for Indian criminal-law matters. A person states the facts of a matter, picks the offences to screen for, and gets a checklist of the ingredients of each offence, with the facts that appear to carry each one cited, and the ones that do not referred back to a lawyer. It is a screening aid; it is not legal advice and it does not decide anything.

This repository is the **product** altitude of a three-altitude system (see [ADR-0049](https://github.com/AxisMeru/pravrudhi/blob/main/docs/decisions/ADR-0049-three-altitudes-studio-product-artifact.md)):

| Altitude | Role | Code |
|---|---|---|
| **Studio** | Improves the engine itself | `AxisMeru/pravrudhi` |
| **Product** (this repository) | The screening app: web UI, desktop shell, install scripts | `AxisMeru/pravrudhi-app` |
| **Artifact** | The trained models behind the screening (4B and 32B judges) | `AxisMeru` |

## What is in this repository

| Path | What it is |
|---|---|
| [`frontend/`](frontend/README.md) | The Next.js static-export UI (no SSR): screening, Your matters, workflows, citation check, guide, benchmarks, admin access page. Served on the web and by the engine inside the desktop shell. |
| `desktop/` | Electron shell: engine discovery and launch, a local loopback engine, packaging. See [`desktop/README.md`](desktop/README.md). |
| `engine/` and `scripts/install-engine.sh` | The engine version this app is tested against, and the installer that fetches that release. |
| [`docs/engine-calls.md`](docs/engine-calls.md) | Every engine and Edge Function call the app makes, and how each error is shown. |
| [`docs/ci-guards.md`](docs/ci-guards.md) | The CI checks and guards, and what each one protects. |
| `docs/decisions/` | Decision records and requests (ADR-0001 to ADR-0005). |
| `docs/demo-runbook.md` | How the public demo path is rehearsed. |
| `scripts/` | Repository guards (private data, invented fixtures, flag specs ran) and the benchmark-page validator. |
| `.github/workflows/` | CI and release. |

## The two doors

- **Web.** The `pravrudhi-app` project on Vercel serves `frontend/` (static export). The page talks to a hosted engine named at build time by `NEXT_PUBLIC_API_BASE`, and signs people in through Supabase (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`). There is no self-service sign-up: an administrator invites each person by email, from the Access page. The engine requires a signed-in token on every call except the health check.
- **Desktop.** An Electron shell that launches a local engine on `127.0.0.1` and opens the same UI. It never talks to the hosted engine (`desktop/lib/connection.js` refuses any non-loopback origin).

The analysis models are switched off when nobody is using them. A screening that finds them off asks the engine to start them (a "wake"), shows progress, and sends the screening when they are ready. See [`docs/engine-calls.md`](docs/engine-calls.md#cold-start-wake) for the contract.

## Install the desktop app

### 1. Install the engine

```bash
bash scripts/install-engine.sh
```

This downloads and installs Pravrudhi's engine (version pinned in `engine/ENGINE_VERSION`) from the GitHub release into `~/.pravrudhi-app/engine/.venv`.

### 2. Install the desktop application

Download the latest installer for your platform from [Releases](https://github.com/AxisMeru/pravrudhi-app/releases):
- **Linux**: `pravrudhi-*.AppImage`
- **macOS**: `pravrudhi-*.dmg`
- **Windows**: `pravrudhi-*.exe`

### 3. Launch Pravrudhi

Run the installed application. It will:
1. Discover the engine installed by `install-engine.sh`
2. Start the engine in your workspace
3. Open the Pravrudhi interface

## Engine versioning

The engine version is pinned in `engine/ENGINE_VERSION`. To upgrade:

1. Update `engine/ENGINE_VERSION` with the new version
2. Run `bash scripts/install-engine.sh` again

The desktop application will use the newly installed engine on next launch.

## Development

### Frontend

```bash
cd frontend
npm ci           # Install dependencies
npm run build    # Build static export (required for desktop packaging)
npm test         # Run tests
npm run dev      # Development server
```

### Desktop

```bash
cd desktop
npm ci            # Install dependencies
npm test          # Run tests
npm run start     # Launch dev app
npm run dist      # Build installer for your platform
```

### Building the release

```bash
# Frontend build is done by CI; the desktop shell packages the product edition on each platform
npm run dist:linux   # Linux
npm run dist:mac     # macOS
npm run dist:win     # Windows
```

## The web door

The same interface is served on the web at the `pravrudhi-app` Vercel project (team `axismeru`), deployed by
Vercel's git integration on every push to `main`, root directory `frontend`. It talks to the engine named by
`NEXT_PUBLIC_API_BASE` in the project's environment and signs users in through Supabase when
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set; without an engine it shows the
connection banner rather than a recording. The desktop shell is the other door to the same account, with what
a browser cannot offer: a local engine, the file system and local models.

Since 2026-09-11 the engine behind the web door is a hosted one: `NEXT_PUBLIC_API_BASE` names
`https://pravrudhi-app.axismeru.workers.dev`, a Cloudflare Worker that proxies to the product's engine
container wherever it currently runs (the gateway recipe is `deploy/gateway/` in `AxisMeru/pravrudhi`). The
engine runs with identity required: every `/api` call but the health check carries the signed-in user's token.

## Development

```bash
cd frontend
npm ci
npm run dev        # development server
npm test           # unit tests (tsx --test "src/**/*.spec.ts")
npx tsc --noEmit
npx eslint . --max-warnings=0
npm run build      # static export into frontend/out
```

End-to-end tests (Playwright) need a product engine serving the built pages; the exact commands, the build flags and the test projects are in [`frontend/README.md`](frontend/README.md#testing). Desktop:

```bash
cd desktop
npm ci
npm test
npm run start      # launch the dev app
npm run dist       # build an installer for your platform
```

## Releases and deploys

`main` is protected: a change merges through a pull request with CI green and the reviews it needs. The web app deploys from `main` through Vercel's git integration (root directory `frontend`). Releases of the desktop shell are built by `.github/workflows/release.yml`.

## Public repository

This repository is public. Fixtures and examples are invented, or are allegations recited in a public court order and labelled as such. No real name, case or crime number, email, phone number or identity number may be committed; CI refuses them (see [`docs/ci-guards.md`](docs/ci-guards.md)). Secrets and account details never belong here.

## See also

- [Pravrudhi Studio](https://github.com/AxisMeru/pravrudhi): the engine and its improvement loop.
- [ADR-0049](https://github.com/AxisMeru/pravrudhi/blob/main/docs/decisions/ADR-0049-three-altitudes-studio-product-artifact.md): the three altitudes.
