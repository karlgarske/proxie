# Proxie Monorepo

- `api/`: Backend Node REST API server
- `client/`: Frontend React app
- `data/`: Dataset (currently static, deploy via /scripts/content.js)
- `infra/`: Infrastructure definition for Kubernetes deploy
- `proxy/`: NGINX config for ingress to client and api
- `scripts/`: Helper zsh scripts (GCP setup, deploy, content)

## Prereqs

- Node 18+
- npm 9+
- Docker (for proxy and deploy)
- gcloud CLI (for GCP scripts)

## Install

```sh
npm install
```

This installs workspace dependencies for `client`, `api`, and `proxy`.

## Run (local dev)

- API (port 3001):
  ```sh
  npm run dev:api
  ```
- Client (port 5173 by default):
  ```sh
  npm run dev:client
  ```
- Client + API concurrently:
  ```sh
  npm run dev
  ```

The client fetches from `/api/hello`. Configure backend host via `VITE_API_BASE_URL` in `client/.env.local`.

## Reverse Proxy (NGINX)

- Build client and start API:
  ```sh
  npm run build && npm run dev:api
  ```
- Start NGINX proxy (Docker):
  ```sh
  npm run proxy
  ```

NGINX serves `client/dist` and proxies `/api` to `http://localhost:3001`. It listens on `$PORT`.

## VS Code Debug

- API and Client launch configs live in `.vscode/launch.json`.

## Build & Deploy

- Build Docker image (multi-stage):
  ```sh
  docker build -t simple-web-app:local .
  ```
- Run locally (front on `$PORT`, api on `3001`):
  ```sh
  docker run --rm -p 8080:8080 -e PORT=8080 simple-web-app:local
  ```
- Deploy to Cloud Run (stage|prod):
  ```sh
  ./scripts/deploy.zsh stage
  ```

Deploy script verifies tests before deployment and injects secrets via Secret Manager.

## GCP Setup

Authenticate, set project, create service account, and grant Secret Manager access:

```sh
./scripts/gcp-setup.zsh --project <PROJECT_ID>
```

## Notes

- This repo includes scaffolding for shadcn/ui usage. Install specific components with the `shadcn` CLI as needed.
- Sensitive config should use GCP Secret Manager. See `env/stage.yaml` and `env/prod.yaml` for examples.
