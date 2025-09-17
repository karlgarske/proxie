#!/usr/bin/env zsh
set -euo pipefail

echo "Installing workspace dependencies with npm..."
npm install

cat <<'INFO'

Setup complete.

Run API (port 3001):
  npm run dev:api

Run Client (port 5173):
  npm run dev:client

Run both concurrently:
  npm run dev

Configure API host for client (optional):
  echo 'VITE_API_BASE_URL=""' > client/.env.local
  # empty = same origin; or set e.g. http://localhost:8080 when using proxy

Build and run NGINX proxy (serves client/dist, proxies /api):
  npm run build && npm run proxy

INFO

