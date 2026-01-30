#!/bin/bash
# =============================================================================
# Run Prediction Pipeline via Claude Code
# =============================================================================
# Triggered by external cron 3x daily (6 AM, 2 PM, 10 PM)
# Uses Claude Code subscription instead of API calls
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/prediction-pipeline.log"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M:%S)

# Ensure log directory exists
mkdir -p "$LOG_DIR"

echo "" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"
echo "[$DATE $TIME] Starting prediction pipeline" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Change to project directory
cd "$PROJECT_ROOT"

# Run the Claude Code command
# Note: This requires claude CLI to be installed and authenticated
if command -v claude &> /dev/null; then
    echo "[$DATE $TIME] Running /run-prediction-pipeline via Claude Code..." >> "$LOG_FILE"
    claude /run-prediction-pipeline >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        echo "[$DATE $TIME] Pipeline completed successfully" >> "$LOG_FILE"
    else
        echo "[$DATE $TIME] Pipeline completed with errors (exit code: $EXIT_CODE)" >> "$LOG_FILE"
    fi
else
    echo "[$DATE $TIME] ERROR: claude CLI not found. Please install Claude Code." >> "$LOG_FILE"
    exit 1
fi

echo "[$DATE $TIME] Done" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"
