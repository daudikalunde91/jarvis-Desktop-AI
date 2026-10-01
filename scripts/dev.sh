#!/usr/bin/env bash
# Convenience script: bootstrap the project then start frontend + backend
# dev servers together. Equivalent to `npm dev`.
set -euo pipefail
cd "$(dirname "$0")/.."

npm bootstrap
npm run dev
