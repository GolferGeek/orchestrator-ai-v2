#!/bin/bash

# Change to open-notebook directory
cd "$(dirname "$0")"

# Load environment variables from root .env (has all config now)
set -a  # automatically export all variables
source "../../.env"
set +a

# Activate virtual environment
source .venv/bin/activate

# Show key env vars for debugging
echo "Starting worker with:"
echo "  OPENAI_API_KEY: ${OPENAI_API_KEY:0:20}..."
echo "  SURREAL_URL: ${SURREAL_URL}"

exec surreal-commands-worker -i commands "$@"
