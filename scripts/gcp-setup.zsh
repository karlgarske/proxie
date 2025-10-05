#!/usr/bin/env zsh
set -euo pipefail

function usage() {
  cat <<'EOF'
GCP Setup Script

Usage:
  gcp-setup.zsh --project <PROJECT_ID> [--sa-name <SERVICE_ACCOUNT_NAME>]

Steps:
  - Authenticate via gcloud
  - Set active project
  - Create service account
  - Grant Secret Manager access (roles/secretmanager.secretAccessor)

Example:
  ./scripts/gcp-setup.zsh --project my-project-123 --sa-name simple-web-app-sa
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" || $# -eq 0 ]]; then
  usage; exit 0
fi

PROJECT=""
SA_NAME="simple-web-app-sa"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2;;
    --sa-name) SA_NAME="$2"; shift 2;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

if [[ -z "$PROJECT" ]]; then
  echo "--project is required"; usage; exit 1
fi

echo "Authenticating with gcloud..."
gcloud auth login

echo "Setting project: $PROJECT"
gcloud config set project "$PROJECT"

SA_EMAIL="$SA_NAME@$PROJECT.iam.gserviceaccount.com"

echo "Creating service account: $SA_EMAIL"
gcloud iam service-accounts create "$SA_NAME" --display-name "Simple Web App Service Account" || true

echo "Granting Secret Manager access to $SA_EMAIL"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member "serviceAccount:$SA_EMAIL" \
  --role "roles/secretmanager.secretAccessor"

# creates an index for searching vectors in Firestore
echo "Creating Firestore vector index (may take a few minutes)..."
gcloud firestore indexes composite create \
--collection-group=resources \
--query-scope=COLLECTION \
--field-config field-path=embedding,vector-config='{"dimension":"1536", "flat": "{}"}' \
--database='(default)'

echo "Done. You may also create a key if needed:"
echo "  gcloud iam service-accounts keys create key.json --iam-account $SA_EMAIL"

