#!/bin/bash
# Copy .env from main repo to worktree
WORKTREE_PATH="${CONDUCTOR_WORKTREE_PATH:-${PWD}}"
REPO_ROOT="/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2"
ENV_SOURCE="${REPO_ROOT}/.env"
ENV_TARGET="${WORKTREE_PATH}/.env"
if [ -f "$ENV_SOURCE" ]; then
    cp "$ENV_SOURCE" "$ENV_TARGET"
    echo "✓ Copied .env to worktree"
fi
