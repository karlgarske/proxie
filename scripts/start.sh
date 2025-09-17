#!/usr/bin/env sh
set -eu

: "${PORT:=8080}"

echo "Starting API on 3001 and NGINX on ${PORT}"

# Render nginx config with only PORT substituted, preserving nginx $vars
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start API (background)
node /app/api/dist/index.js &

# Start NGINX (foreground)
exec nginx -g 'daemon off;'
