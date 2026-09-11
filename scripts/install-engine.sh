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

RELEASE_DATA=$(curl -s "$RELEASE_URL")

# Check if release exists
if echo "$RELEASE_DATA" | grep -q '"message".*"Not Found"'; then
  echo "ERROR: Release v$ENGINE_VERSION not found on GitHub" >&2
  exit 1
fi

# Extract wheel download URLs
KERNEL_WHEEL=$(echo "$RELEASE_DATA" | grep -o '"browser_download_url":"[^"]*pravrudhi[_-]kernel[^"]*\.whl"' | head -1 | cut -d'"' -f4)
ENGINE_WHEEL=$(echo "$RELEASE_DATA" | grep -o '"browser_download_url":"[^"]*pravrudhi[^"]*\.whl"' | grep -v kernel | head -1 | cut -d'"' -f4)

if [ -z "$KERNEL_WHEEL" ] || [ -z "$ENGINE_WHEEL" ]; then
  echo "ERROR: Could not find wheel files in release v$ENGINE_VERSION" >&2
  echo "Expected files: pravrudhi-kernel-*.whl and pravrudhi-*.whl" >&2
  echo "Release data:" >&2
  echo "$RELEASE_DATA" | grep "browser_download_url" | head -5 >&2
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

# Activate venv and install wheels
# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

echo "Upgrading pip"
pip install --upgrade pip setuptools wheel

echo "Installing kernel wheel"
pip install "$KERNEL_WHEEL"

echo "Installing engine wheel"
pip install "$ENGINE_WHEEL"

echo "Installation complete!"
echo "Engine is installed at: $VENV_DIR"
echo "To use it, activate the venv with: source $VENV_DIR/bin/activate"
