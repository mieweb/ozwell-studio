#!/bin/bash
# Build the Ozzy extension VSIX from vendor/ozzy (patched Cline).
# Patches are tracked in the submodule's "ozwell" branch — this script only builds.
# Usage: scripts/build-ozzy.sh [output_dir]
#   output_dir  Where to write ozzy.vsix (default: dist/)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/vendor/ozzy"
OUTPUT_DIR="${1:-dist}"

if [[ ! -f "$SOURCE_DIR/package.json" ]]; then
    echo "ERROR: vendor/ozzy not found. Run: git submodule update --init" >&2
    exit 1
fi

cd "$SOURCE_DIR"

echo "==> Installing dependencies"
npm install 2>&1 | tail -5
(cd webview-ui && npm install 2>&1 | tail -5)

echo "==> Packaging VSIX (runs protos + type-check + webview + lint + esbuild via prepublish)"
mkdir -p "$REPO_ROOT/$OUTPUT_DIR"
npx @vscode/vsce package --no-dependencies --allow-missing-repository -o "$REPO_ROOT/$OUTPUT_DIR/ozzy.vsix"
echo "==> Built: $OUTPUT_DIR/ozzy.vsix"
echo ""
echo "    The VSIX is tracked via Git LFS. To update the committed copy:"
echo "      git add dist/ozzy.vsix && git commit -m 'Update ozzy.vsix'"
