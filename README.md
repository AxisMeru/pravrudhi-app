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
