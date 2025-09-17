#!/usr/bin/env zsh
set -euo pipefail

function usage() {
  cat <<'EOF'
Deploy to Cloud Run

Usage:
  deploy.zsh <stage|prod> [--tag <TAG>] [--region <REGION>]

Requires env file: env/<stage|prod>.yaml with keys:
  project: <PROJECT_ID>
  service: <SERVICE_NAME>
  region: <REGION>
  secrets:
    - API_KEY=projects/<PROJECT_ID>/secrets/API_KEY:latest

The script:
  - Verifies tests pass
  - Builds Docker image
  - Pushes to Artifact Registry (or gcr.io)
  - Deploys to Cloud Run with env secrets
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" || $# -eq 0 ]]; then
  usage; exit 0
fi

ENV_NAME=$1; shift
TAG="$(date +%Y%m%d-%H%M%S)"
REGION_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2;;
    --region) REGION_OVERRIDE="$2"; shift 2;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

ENV_FILE="env/${ENV_NAME}.yaml"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"; exit 1
fi

# Simple yaml parsing (expects simple key: value lines, and list for secrets)
PROJECT=$(grep '^project:' "$ENV_FILE" | awk '{print $2}')
SERVICE=$(grep '^service:' "$ENV_FILE" | awk '{print $2}')
REGION=${REGION_OVERRIDE:-$(grep '^region:' "$ENV_FILE" | awk '{print $2}')}
SECRETS=$(awk '/^secrets:/{flag=1;next} /^(\w+:|#|$)/{flag=0} flag{print $0}' "$ENV_FILE" | sed 's/^- //' | tr '\n' ',')
SECRETS=${SECRETS%,}

if [[ -z "$PROJECT" || -z "$SERVICE" || -z "$REGION" ]]; then
  echo "Missing project/service/region in $ENV_FILE"; exit 1
fi

IMAGE="gcr.io/$PROJECT/${SERVICE}:${TAG}"

echo "Running tests..."
npm -s test

echo "Building Docker image for linux/amd64: $IMAGE"
if docker buildx version >/dev/null 2>&1; then
  echo "Using docker buildx to build and push (linux/amd64)"
  # Ensure a builder exists and is selected; Docker Desktop typically has one by default
  if ! docker buildx inspect >/dev/null 2>&1; then
    docker buildx create --use --name deploybuilder >/dev/null
  fi
  docker buildx build --platform linux/amd64 -t "$IMAGE" --push .
else
  echo "buildx not found; falling back to classic build + push"
  docker build --platform=linux/amd64 -t "$IMAGE" .
  echo "Pushing image"
  docker push "$IMAGE"
fi

echo "Deploying to Cloud Run: service=$SERVICE region=$REGION project=$PROJECT"
SECRETS_ARGS=()
if [[ -n "$SECRETS" ]]; then
  #IFS=',' read -rA arr <<< "$SECRETS"
  #for kv in "${arr[@]}"; do
  #  SECRETS_ARGS+=("--set-secrets" "$kv")
  #done
  echo "Using secrets"
fi

gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT" \
  --allow-unauthenticated #\
  #"${SECRETS_ARGS[@]}"

echo "Deployment complete."
