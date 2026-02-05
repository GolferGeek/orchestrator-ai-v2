#!/bin/bash
# Conductor setup script for orchestrator-ai-v2 worktree
# Copies .env and installs Node.js dependencies (web, api, langgraph)

WORKTREE_PATH="${CONDUCTOR_WORKTREE_PATH:-${PWD}}"
REPO_ROOT="/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2"

# Copy .env from main repo to worktree
ENV_SOURCE="${REPO_ROOT}/.env"
ENV_TARGET="${WORKTREE_PATH}/.env"
if [ -f "$ENV_SOURCE" ]; then
    cp "$ENV_SOURCE" "$ENV_TARGET"
    echo "✓ Copied .env to worktree"
else
    echo "Warning: .env not found at ${ENV_SOURCE}"
fi

# Change to worktree directory
cd "$WORKTREE_PATH" || exit 1

# Install Node.js dependencies (handles web, api, langgraph via workspaces)
echo "Installing Node.js dependencies..."
if command -v npm &> /dev/null; then
    npm install
    echo "✓ Node.js dependencies installed"
    
    # Build transport-types (required by other apps)
    echo "Building transport-types..."
    npm run build:transport-types || echo "Warning: Failed to build transport-types"
else
    echo "Warning: npm not found, skipping Node.js dependencies"
fi

echo "✓ Setup complete"
