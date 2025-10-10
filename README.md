# Proxie

Proxie is your personal AI agent. Publish your content, and your Proxie handles inbound communication on your behalf.

## Folder Structure

Monorepo using npm Workspaces:

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

## Config

The client fetches from `/api/*`. Configure backend host via `VITE_API_BASE_URL` in `client/.env.local`.

## Run (local dev)

- API standalone (port 3001):
  ```sh
  npm run dev:api
  ```
- Client standalone (port 5173 by default):
  ```sh
  npm run dev:client
  ```
- Client + API concurrently:
  ```sh
  npm run dev
  ```

### VSCode Debug (Optional)

- API and Client launch configs live in `.vscode/launch.json`.

### Reverse Proxy (Optional)

NGINX is used primarily for deployment to handle ingress for `client/dist` and `/api` to `http://localhost:3001`.

- Build client and start API:
  ```sh
  npm run build && npm run dev:api
  ```
- Start NGINX proxy (Docker):
  ```sh
  npm run proxy
  ```

## Build & Deploy

Build and deploy is handled by `./scripts/deploy.zsh` to create a Docker image and release to GCP as a knative `services.yaml`

Note: Sensitive config should use GCP Secret Manager. See `.env.stage.yaml` and `.env.prod.yaml` for examples.

### GCP Setup

Need to run setup at least once:

```sh
./scripts/gcp-setup.zsh --project <PROJECT_ID>
```

### Deploy Script

```sh
npm run deploy <stage|prod>
```
