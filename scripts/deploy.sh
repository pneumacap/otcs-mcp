#!/usr/bin/env bash
set -euo pipefail

# Altius production deploy script
# Usage: ./scripts/deploy.sh [user@host]
#
# Prerequisites:
#   - SSH access to the VPS
#   - .env file on VPS at /opt/altius/.env
#   - Docker + Docker Compose installed on VPS

REMOTE="${1:-}"
DEPLOY_DIR="/opt/altius"

if [ -z "$REMOTE" ]; then
  echo "Usage: $0 user@host"
  exit 1
fi

echo "==> Deploying Altius to $REMOTE..."

ssh "$REMOTE" bash -s <<EOF
  set -euo pipefail
  cd $DEPLOY_DIR

  echo "==> Pulling latest code..."
  git pull --ff-only

  echo "==> Building and starting services..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

  echo "==> Waiting for health check..."
  sleep 5
  curl -sf http://localhost:3000/api/health || echo "WARNING: Health check failed"

  echo "==> Cleaning up old images..."
  docker image prune -f

  echo "==> Deploy complete!"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
EOF
