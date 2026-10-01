#!/usr/bin/env bash
# Convenience script: type-check and build both frontend and backend
# for production. Equivalent to `npm build`.
set -euo pipefail
cd "$(dirname "$0")/.."

npm typecheck
npm build:frontend
npm build:backend
echo "Build complete. Run 'npm package' to produce distributable binaries."
