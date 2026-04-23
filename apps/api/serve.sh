#!/usr/bin/env bash
# Start the PHP dev server with env vars loaded from .env
# Usage: ./serve.sh [port]

PORT=${1:-8000}
ENV_FILE="$(dirname "$0")/.env"

if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

echo "Starting PHP dev server on http://localhost:$PORT"
php -S "localhost:$PORT" "$(dirname "$0")/index.php"
