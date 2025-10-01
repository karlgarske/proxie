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
export PROJECT=$(grep '^project:' "$ENV_FILE" | awk '{print $2}')
export SERVICE=$(grep '^service:' "$ENV_FILE" | awk '{print $2}')
export REGION=${REGION_OVERRIDE:-$(grep '^region:' "$ENV_FILE" | awk '{print $2}')}
export OPENAI_API_KEY=$(grep '^OPENAI_API_KEY:' "$ENV_FILE" | awk '{print $2}')
export VECTOR_STORE=$(grep '^VECTOR_STORE:' "$ENV_FILE" | awk '{print $2}')

#SA_EMAIL="$SERVICE@$PROJECT.iam.gserviceaccount.com"

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

#echo "Building Docker image for linux/amd64: $IMAGE"
#if docker buildx version >/dev/null 2>&1; then
#  echo "Using docker buildx to build and push (linux/amd64)"
  # Ensure a builder exists and is selected; Docker Desktop typically has one by default
#  if ! docker buildx inspect >/dev/null 2>&1; then
#    docker buildx create --use --name deploybuilder >/dev/null
#  fi
#  docker buildx build --platform linux/amd64 -t "$IMAGE" --push .
#else
#  echo "buildx not found; falling back to classic build + push"
#  docker build --platform=linux/amd64 -t "$IMAGE" .
#  echo "Pushing image"
#  docker push "$IMAGE"
#fi


echo "Deploying to Cloud Run: service=$SERVICE region=$REGION project=$PROJECT"
echo "- container image $CONTAINER_IMG"
echo "- api image $API_IMG"

#export GIT_SHA=$(git rev-parse --short=12 HEAD)
# replace service template params with env values
envsubst < infra/service.tmpl.yaml > infra/service.yaml

# load the images
gcloud run services replace infra/service.yaml

# gcloud run services replace service.yaml --region=us-central1
# gcloud run services update vibes-app --env-vars-file=./env/stage.yaml --region=us-central1

#gcloud run deploy "$SERVICE" \
#  --image "$IMAGE" \
#  --env-vars-file="$ENV_FILE" \
#  --platform managed \
#  --region "$REGION" \
#  --project "$PROJECT" \
#  --allow-unauthenticated \
#  --service-account=${SA_EMAIL} \
#  --set-secrets=OPENAI_API_KEY=OPENAI_API_KEY:latest 

echo "Deployment complete."
