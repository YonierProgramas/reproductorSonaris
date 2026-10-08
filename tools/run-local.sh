#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
if [[ -x .tools/bin/node ]]; then
  export PATH="$project_root/.tools/bin:$PATH"
fi
if ! command -v npm >/dev/null 2>&1; then
  echo 'Necesitas instalar Node.js 22 para ejecutar Sonaris.' >&2
  exit 1
fi
exec npm run "${1:-dev}"
