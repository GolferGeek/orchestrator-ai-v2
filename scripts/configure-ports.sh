#!/bin/bash

# =============================================================================
# Configure Ports for Worktree
# =============================================================================
# Updates all port definitions in .env file based on CONDUCTOR_PORT
# Usage: ./scripts/configure-ports.sh [base_port]
#   If base_port not provided, uses CONDUCTOR_PORT env var or defaults to 6100
# =============================================================================

set -e

# Get base port from argument, env var, or default
BASE_PORT="${1:-${CONDUCTOR_PORT:-6100}}"

# Validate port is a number
if ! [[ "$BASE_PORT" =~ ^[0-9]+$ ]]; then
    echo "Error: Base port must be a number. Got: $BASE_PORT"
    exit 1
fi

# Find .env file (current directory or parent)
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found in current directory"
    exit 1
fi

echo "Configuring ports with base port: $BASE_PORT"
echo "Updating .env file: $ENV_FILE"

# Calculate port values
API_PORT=$((BASE_PORT + 0))
WEB_PORT=$((BASE_PORT + 1))
LANGGRAPH_PORT=$((BASE_PORT + 100))
SERVER_PORT=$((BASE_PORT + 200))
ORCH_FLOW_PORT=$((BASE_PORT + 2))
N8N_PORT=5678  # Keep N8N port fixed unless you want to change it
OPEN_NOTEBOOK_FRONTEND_PORT=$((BASE_PORT + 101))
OPEN_NOTEBOOK_API_PORT=$((BASE_PORT + 102))
OPEN_NOTEBOOK_SURREALDB_PORT=$((BASE_PORT + 103))

# Use macOS-compatible sed syntax (empty string after -i for no backup)
# Update port definitions
sed -i '' "s/^API_PORT=.*/API_PORT=$API_PORT/" "$ENV_FILE"
sed -i '' "s/^WEB_PORT=.*/WEB_PORT=$WEB_PORT/" "$ENV_FILE"
sed -i '' "s/^VITE_WEB_PORT=.*/VITE_WEB_PORT=$WEB_PORT/" "$ENV_FILE"
sed -i '' "s/^VITE_HTTP_PORT=.*/VITE_HTTP_PORT=$WEB_PORT/" "$ENV_FILE"
sed -i '' "s/^VITE_API_PORT=.*/VITE_API_PORT=$API_PORT/" "$ENV_FILE"
sed -i '' "s/^LANGGRAPH_PORT=.*/LANGGRAPH_PORT=$LANGGRAPH_PORT/" "$ENV_FILE"
sed -i '' "s/^VITE_LANGGRAPH_PORT=.*/VITE_LANGGRAPH_PORT=$LANGGRAPH_PORT/" "$ENV_FILE"
sed -i '' "s/^SERVER_PORT=.*/SERVER_PORT=$SERVER_PORT/" "$ENV_FILE"
sed -i '' "s/^ORCH_FLOW_PORT=.*/ORCH_FLOW_PORT=$ORCH_FLOW_PORT/" "$ENV_FILE"
sed -i '' "s/^OPEN_NOTEBOOK_FRONTEND_PORT=.*/OPEN_NOTEBOOK_FRONTEND_PORT=$OPEN_NOTEBOOK_FRONTEND_PORT/" "$ENV_FILE"
sed -i '' "s/^OPEN_NOTEBOOK_API_PORT=.*/OPEN_NOTEBOOK_API_PORT=$OPEN_NOTEBOOK_API_PORT/" "$ENV_FILE"
sed -i '' "s/^OPEN_NOTEBOOK_SURREALDB_PORT=.*/OPEN_NOTEBOOK_SURREALDB_PORT=$OPEN_NOTEBOOK_SURREALDB_PORT/" "$ENV_FILE"

# Update VITE URL variables that contain port numbers (explicit updates - matches any port)
sed -i '' "s|^VITE_API_BASE_URL=http://localhost:[0-9]\+|VITE_API_BASE_URL=http://localhost:$API_PORT|" "$ENV_FILE"
sed -i '' "s|^VITE_API_NESTJS_BASE_URL=http://localhost:[0-9]\+|VITE_API_NESTJS_BASE_URL=http://localhost:$API_PORT|" "$ENV_FILE"
sed -i '' "s|^VITE_API_URL=http://localhost:[0-9]\+|VITE_API_URL=http://localhost:$API_PORT|" "$ENV_FILE"

# Update port references in other URLs (catch any remaining localhost URLs with ports)
# Replace any localhost URLs that match the old default ports OR any 4-digit port
sed -i '' "s|http://localhost:6100|http://localhost:$API_PORT|g" "$ENV_FILE"
sed -i '' "s|http://localhost:6101|http://localhost:$WEB_PORT|g" "$ENV_FILE"
sed -i '' "s|http://localhost:6200|http://localhost:$LANGGRAPH_PORT|g" "$ENV_FILE"
sed -i '' "s|http://localhost:7100|http://localhost:$API_PORT|g" "$ENV_FILE"
sed -i '' "s|http://localhost:7101|http://localhost:$WEB_PORT|g" "$ENV_FILE"
sed -i '' "s|http://localhost:7200|http://localhost:$LANGGRAPH_PORT|g" "$ENV_FILE"
sed -i '' "s|ws://localhost:6203|ws://localhost:$OPEN_NOTEBOOK_SURREALDB_PORT|g" "$ENV_FILE"
sed -i '' "s|ws://localhost:7203|ws://localhost:$OPEN_NOTEBOOK_SURREALDB_PORT|g" "$ENV_FILE"

# Update SurrealDB WebSocket URL (matches any port)
sed -i '' "s|^SURREAL_URL=.*ws://localhost:[0-9]\+|SURREAL_URL=\"ws://localhost:$OPEN_NOTEBOOK_SURREALDB_PORT/rpc\"|" "$ENV_FILE"

echo "✓ Ports configured successfully:"
echo "  API_PORT=$API_PORT"
echo "  WEB_PORT=$WEB_PORT"
echo "  LANGGRAPH_PORT=$LANGGRAPH_PORT"
echo "  SERVER_PORT=$SERVER_PORT"
echo "  ORCH_FLOW_PORT=$ORCH_FLOW_PORT"
echo "  OPEN_NOTEBOOK_FRONTEND_PORT=$OPEN_NOTEBOOK_FRONTEND_PORT"
echo "  OPEN_NOTEBOOK_API_PORT=$OPEN_NOTEBOOK_API_PORT"
echo "  OPEN_NOTEBOOK_SURREALDB_PORT=$OPEN_NOTEBOOK_SURREALDB_PORT"
