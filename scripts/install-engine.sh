#!/usr/bin/env bash
set -euo pipefail

# Install the Pravrudhi engine from a GitHub release
# Usage: ./scripts/install-engine.sh

# Read the engine version from ENGINE_VERSION
ENGINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_VERSION=$(cat "$ENGINE_DIR/engine/ENGINE_VERSION")

# Set installation directory
PRAVRUDHI_APP_HOME="${PRAVRUDHI_APP_HOME:-$HOME/.pravrudhi-app}"
VENV_DIR="$PRAVRUDHI_APP_HOME/engine/.venv"

echo "Installing Pravrudhi engine v$ENGINE_VERSION to $VENV_DIR"

# Query GitHub API to find release assets
RELEASE_URL="https://api.github.com/repos/AxisMeru/pravrudhi/releases/tags/v$ENGINE_VERSION"
echo "Fetching release information from $RELEASE_URL"

# GitHub allows 60 unauthenticated API calls an hour per address, and a CI runner shares its address with
# everyone else's runners, so a token is used whenever one is in the environment (GITHUB_TOKEN in Actions).
AUTH=()
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -n "$TOKEN" ]; then AUTH=(-H "Authorization: Bearer $TOKEN"); fi
RELEASE_DATA=$(curl -sS "${AUTH[@]}" "$RELEASE_URL")

# The API answers a JSON "message" for anything that is not a release: not found, rate limited, bad token.
if ! echo "$RELEASE_DATA" | grep -q '"tag_name"'; then
  echo "ERROR: GitHub did not return release v$ENGINE_VERSION:" >&2
  echo "$RELEASE_DATA" | grep -o '"message": *"[^"]*"' | head -1 >&2
  exit 1
fi

# The asset list comes from the release's own assets_url, not the by-tag view above: the by-tag view has
# been seen listing zero assets for ~40 minutes after a release publishes (both v0.5.25's engine-image
# build, pravrudhi 93ef1be, and this script against the same release hit it), while assets_url and
# /releases/latest listed all of them immediately. RELEASE_DATA above is still used for the "release not
# found" check and the diagnostic asset-name listing below; only the wheel search itself reads from here.
ASSETS_URL=$(echo "$RELEASE_DATA" | grep -o '"assets_url": *"[^"]*"' | head -1 | sed 's/.*"\(https[^"]*\)"/\1/' || true)
if [ -z "$ASSETS_URL" ]; then
  echo "ERROR: release v$ENGINE_VERSION has no assets_url in its API response" >&2
  exit 1
fi
ASSET_DATA=$(curl -sS "${AUTH[@]}" "${ASSETS_URL}?per_page=100")

# Extract wheel download URLs. A grep with no match exits 1, which with pipefail would end the script without
# a word, so each pipeline is allowed to come back empty and the emptiness is reported below.
KERNEL_WHEEL=$(echo "$ASSET_DATA" | grep -o '"browser_download_url": *"[^"]*pravrudhi[_-]kernel[^"]*\.whl"' | head -1 | sed 's/.*"\(https[^"]*\)"/\1/' || true)
ENGINE_WHEEL=$(echo "$ASSET_DATA" | grep -o '"browser_download_url": *"[^"]*pravrudhi-[0-9][^"]*\.whl"' | head -1 | sed 's/.*"\(https[^"]*\)"/\1/' || true)

if [ -z "$KERNEL_WHEEL" ] || [ -z "$ENGINE_WHEEL" ]; then
  echo "ERROR: Could not find both wheels in release v$ENGINE_VERSION" >&2
  echo "Expected files: pravrudhi_kernel-*.whl and pravrudhi-$ENGINE_VERSION-*.whl; the release carries:" >&2
  echo "$ASSET_DATA" | grep -o '"name": *"[^"]*"' | head -20 >&2
  exit 1
fi

echo "Found wheels:"
echo "  Kernel: $KERNEL_WHEEL"
echo "  Engine: $ENGINE_WHEEL"

# Create venv directory
mkdir -p "$PRAVRUDHI_APP_HOME/engine"

# Create or use existing venv
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtual environment at $VENV_DIR"
  if command -v uv &> /dev/null; then
    echo "Using uv to create venv"
    uv venv "$VENV_DIR"
  else
    echo "Using python3 -m venv"
    python3 -m venv "$VENV_DIR"
  fi
fi

# A Windows venv (uv's or the stdlib's) lays out its binaries in Scripts/ with a .exe suffix; a POSIX one uses
# bin/ with none. Detected from what the venv actually created rather than assumed from $OSTYPE, since that is
# what determines where the binaries this script is about to call actually landed.
if [ -d "$VENV_DIR/Scripts" ]; then
  BIN_DIR="$VENV_DIR/Scripts"
  EXE=".exe"
else
  BIN_DIR="$VENV_DIR/bin"
  EXE=""
fi

# Install both wheels into the venv. A venv uv makes has no pip, so the installer is uv itself when uv is
# present and the venv's own pip otherwise; either way the wheels land in $VENV_DIR, and nothing is activated.
if command -v uv &> /dev/null; then
  install() { uv pip install --python "$BIN_DIR/python$EXE" "$@"; }
else
  install() { "$BIN_DIR/python$EXE" -m pip install --quiet "$@"; }
fi

echo "Installing kernel wheel"
install "$KERNEL_WHEEL"

echo "Installing engine wheel"
install "$ENGINE_WHEEL"

echo "Installation complete!"
echo "Engine is installed at: $VENV_DIR"
echo "Run it as: $BIN_DIR/pravrudhi$EXE"
