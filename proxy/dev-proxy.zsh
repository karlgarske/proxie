#!/usr/bin/env zsh
set -euo pipefail

PORT=${PORT:-8080}

if [ ! -d "../client/dist" ]; then
  echo "client/dist not found. Build client first: npm run build:client"
  exit 1
fi

echo "Starting NGINX proxy on port $PORT (serving client/dist, proxying /api to localhost:3001)"
docker run --rm \
  -e PORT=$PORT \
  -p $PORT:8080 \
  -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd)/../client/dist:/usr/share/nginx/html:ro \
  nginx:alpine

