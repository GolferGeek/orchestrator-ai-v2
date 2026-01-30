#!/bin/bash
# =============================================================================
# Setup Cron Jobs for Prediction Pipeline
# =============================================================================
# Installs cron jobs to run prediction pipeline 3x daily:
# - 6:00 AM  - Morning run (captures overnight news)
# - 2:00 PM  - Afternoon run (captures market-hours news)
# - 10:00 PM - Evening run (captures after-market news)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_SCRIPT="${SCRIPT_DIR}/run-prediction-pipeline.sh"

# Make the pipeline script executable
chmod +x "$PIPELINE_SCRIPT"

echo "Setting up prediction pipeline cron jobs..."
echo ""

# Define cron entries
CRON_6AM="0 6 * * * $PIPELINE_SCRIPT"
CRON_2PM="0 14 * * * $PIPELINE_SCRIPT"
CRON_10PM="0 22 * * * $PIPELINE_SCRIPT"

# Remove old entries and add new ones
(
    # Get existing crontab, excluding any old prediction-pipeline entries
    crontab -l 2>/dev/null | grep -v "run-prediction-pipeline" || true

    # Add new entries
    echo "$CRON_6AM"
    echo "$CRON_2PM"
    echo "$CRON_10PM"
) | crontab -

echo "Cron jobs installed:"
echo "  - 6:00 AM daily  : Morning run"
echo "  - 2:00 PM daily  : Afternoon run"
echo "  - 10:00 PM daily : Evening run"
echo ""
echo "Current crontab entries:"
crontab -l | grep "prediction-pipeline" || echo "(none found)"
echo ""
echo "To remove these cron jobs, run:"
echo "  crontab -l | grep -v 'run-prediction-pipeline' | crontab -"
echo ""
echo "Logs will be written to: logs/prediction-pipeline.log"
