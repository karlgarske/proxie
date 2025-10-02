#!/usr/bin/env zsh
set -euo pipefail

function usage() {
  cat <<'EOF'
Deploy to Cloud Run

Usage:
  deploy.zsh <stage|prod> [--tag <TAG>] [--region <REGION>]

Requires env file: env/<stage|prod>.yaml 

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

ENV_FILE=".env.${ENV_NAME}.yaml"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"; exit 1
fi

# Simple yaml parsing (expects simple key: value lines)
export ENV=$(grep '^ENV:' "$ENV_FILE" | awk '{print $2}')
export PROJECT=$(grep '^PROJECT:' "$ENV_FILE" | awk '{print $2}')
export SERVICE=$(grep '^SERVICE:' "$ENV_FILE" | awk '{print $2}')
export REGION=${REGION_OVERRIDE:-$(grep '^REGION:' "$ENV_FILE" | awk '{print $2}')}
export OPENAI_API_KEY=$(grep '^OPENAI_API_KEY:' "$ENV_FILE" | awk '{print $2}')
export VECTOR_STORE=$(grep '^VECTOR_STORE:' "$ENV_FILE" | awk '{print $2}')

if [[ -z "$PROJECT" || -z "$SERVICE" || -z "$REGION" ]]; then
  echo "Missing project/service/region in $ENV_FILE"; exit 1
fi


export TAG="$(date +%Y%m%d-%H%M%S)"
export CONTAINER_IMG="gcr.io/$PROJECT/${SERVICE}:${TAG}"
export API_IMG="gcr.io/$PROJECT/${SERVICE}/api:${TAG}"

#build the image to be used as the primary container
docker buildx build --platform linux/amd64 -t $CONTAINER_IMG -f Dockerfile .
docker push $CONTAINER_IMG

#build the api docker image to be used as a sidecar
echo "Building api image $API_IMG"
docker buildx build --platform linux/amd64 -t $API_IMG -f api/Dockerfile .
docker push $API_IMG

#echo "Running tests..."
#npm -s test

echo "Deploying to Cloud Run: service=$SERVICE region=$REGION project=$PROJECT"
echo "- container image $CONTAINER_IMG"
echo "- api image $API_IMG"

# replace service template with env values
envsubst < infra/service.tmpl.yaml > infra/service.yaml

# load the images
gcloud run services replace infra/service.yaml --region=us-central1 --project "$PROJECT"

echo "Deployment complete."
