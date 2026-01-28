#!/bin/bash
# =============================================================================
# Ollama Sync Script
# =============================================================================
# Syncs Ollama models with the database by calling the API endpoint.
#
# Usage:
#   ./scripts/ollama-sync.sh              # Use default port (6100)
#   API_PORT=7100 ./scripts/ollama-sync.sh  # Use custom port
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

API_PORT=${API_PORT:-6100}
API_URL="http://localhost:${API_PORT}/llm/sync-models"

echo "Syncing Ollama models with database..."
echo "API URL: ${API_URL}"
echo ""

# Make the sync request
response=$(curl -s -X POST "$API_URL" -H "Content-Type: application/json" 2>&1) || {
    echo -e "${RED}Error: Could not connect to API at ${API_URL}${NC}"
    echo "Make sure the API is running on port ${API_PORT}"
    exit 1
}

# Check if response is valid JSON
if ! echo "$response" | jq . > /dev/null 2>&1; then
    echo -e "${RED}Error: Invalid response from API${NC}"
    echo "$response"
    exit 1
fi

# Parse response
success=$(echo "$response" | jq -r '.success')
ollamaUrl=$(echo "$response" | jq -r '.ollamaUrl // "N/A"')
modelCount=$(echo "$response" | jq -r '.models | length')
models=$(echo "$response" | jq -r '.models | join(", ")')
warnings=$(echo "$response" | jq -r '.warnings | join(", ")')
globalProvider=$(echo "$response" | jq -r '.globalConfig.provider')
globalModel=$(echo "$response" | jq -r '.globalConfig.model')

echo "================================================"
if [[ "$success" == "true" ]]; then
    echo -e "${GREEN}Sync successful!${NC}"
    echo ""
    echo "Ollama URL: ${ollamaUrl}"
    echo "Models (${modelCount}): ${models}"
    echo "Default: ${globalProvider}/${globalModel}"
else
    echo -e "${YELLOW}Sync completed with warnings${NC}"
fi

if [[ -n "$warnings" && "$warnings" != "" ]]; then
    echo ""
    echo -e "${YELLOW}Warnings: ${warnings}${NC}"
fi
echo "================================================"
