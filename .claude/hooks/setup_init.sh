#!/bin/bash
# Setup Hook
# This script runs automatically when Claude Code starts with the --init flag.

echo "🤖 Orchestrator AI Setup Hook"
echo "============================="

# 1. Run standard deterministic setup
./scripts/setup.sh

# 2. Add extra context about the environment
echo "\n✅ Setup hook execution complete."
echo "Starting agent session with fresh environment checks..."
