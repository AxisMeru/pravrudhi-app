# Pravrudhi

A clean-slate platform for recursive self-improvement: install Pravrudhi, state one objective, get one artifact.

Pravrudhi is the progenitor in a three-altitude architecture described in [ADR-0049](https://github.com/AxisMeru/pravrudhi/blob/main/docs/decisions/ADR-0049-three-altitudes-studio-product-artifact.md):

| Altitude | Role | Code |
|---|---|---|
| **Studio** (the architect) | Improves the engine itself | `AxisMeru/pravrudhi` |
| **Product** (this repository) | A clean-slate platform: takes one objective, produces one artifact | `AxisMeru/pravrudhi-app` |
| **Artifact** (e.g., prabhasa-nyaya) | The outcome of one ask: code, corpus, gates, evidence | User's GitHub account or `AxisMeru` |

## What this is

A desktop application that:
- Installs Pravrudhi's engine (pinned to a specific version)
- Provides a minimal, clean-slate interface
- Takes a single objective as input
- Produces a repository as output—the artifact

## What this is not

- **Not the Pravrudhi Studio.** Studio is where the engine itself improves; the product is where users deploy engines to solve their own problems. Studio stays in `AxisMeru/pravrudhi` and is not installable by users outside the operator's team.
- **Not a holder of multiple artifacts.** Each user objective gets its own repository. The product is ephemeral—you install it, use it, and can uninstall it once the artifact is created and pushed to GitHub.
- **Not a standalone artifact such as prabhasa-nyaya.** Pravrudhi's first artifact—the reference implementation—is shipped as the engine's built-in Nyaya surface, but it is not the product itself.

## Installation

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

## The nightlies

Two scheduled checks run on the operator's own box (`pravrudhi-e2e-nightly.timer`, `deploy/e2e-nightly/` in
`AxisMeru/pravrudhi`), signed in as a real, dedicated, non-admin Supabase account (`gateway-probe@axismeru.com`):

- **The web nightly** (`frontend/e2e/live.spec.ts`, project `live-chromium`) signs in against the real hosted
  door (`https://pravrudhi-app.vercel.app`) and clicks through every offered page, plus one written-and-removed
  memory note. This is what proves the hosted engine and the deployed frontend.
- **The desktop nightly** (`desktop/nightly-dist.js`) fetches the latest *released* Linux AppImage, verifies it
  against the release's own `SHA256SUMS`, installs the engine version that release was pinned to, and drives a
  real sign-in / default-workspace / one-run scenario against it via `desktop/lib/nightly-scenario.js`, executed
  inside the packaged shell's own loaded page (the same technique `PRAVRUDHI_DESKTOP_SHOT` already used for a
  screenshot, extended into a full scripted scenario). Its report lands beside the web nightly's, under
  `~/.local/share/pravrudhi-hosted/e2e/`.

**The desktop nightly's exact claim, because it is easy to overstate: real account, real auth, released shell,
fresh local root — not the hosted engine's data.** The desktop shell cannot reach the hosted product engine at
all: `desktop/lib/connection.js`'s `loopbackOrigin` refuses any origin that is not `127.0.0.1`/`localhost`, by
design (the product is a shell over the user's own hardware, ADR-0051 and the operator's bring-your-own-key
rule — not a client for a remote engine). So the desktop nightly starts a *local* engine, with
`PRAVRUDHI_AUTH=required` and the real Supabase project's URL (never a service key — only `SUPABASE_URL`;
`identity.py`'s token verification needs nothing else), and gateway-probe signs into *that* — a real account,
validated by real Supabase auth, running a released shell — but the workspace and run it creates live in a
throwaway local root, never the hosted engine's own data. The web nightly above is what proves the hosted
engine; the desktop nightly proves the shell.

## Testing

Unit tests and the type-check run with `npm test` and `npx tsc --noEmit` in `frontend/`. The end-to-end suite
needs a running product engine serving this repository's built pages:

```bash
cd frontend && npm run build
PRAVRUDHI_EDITION=product PRAVRUDHI_FRONTEND_DIR=$PWD/out pravrudhi app --root <a root made by pravrudhi init> --no-browser --port 8301
LOCAL_ENGINE_URL=http://127.0.0.1:8301 npx playwright test
```

CI does exactly this against the release pinned in `engine/ENGINE_VERSION`, from a fresh `pravrudhi init` root.

## Architecture

- **`desktop/`** — Electron shell, platform-native lifecycle, engine discovery and launching
- **`frontend/`** — Next.js static-export UI (no SSR), consumed by the desktop app
- **`engine/`** — Engine versioning and installation scripts
- **`.github/workflows/`** — CI (frontend, desktop tests) and release workflows

The desktop app launches the engine (a Python subprocess) and points it to the built frontend via `PRAVRUDHI_FRONTEND_DIR`.

## See also

- [Pravrudhi Studio](https://github.com/AxisMeru/pravrudhi) — The engine and its improvement loop
- [ADR-0049](https://github.com/AxisMeru/pravrudhi/blob/main/docs/decisions/ADR-0049-three-altitudes-studio-product-artifact.md) — The three-altitude architecture
