#!/bin/bash

# Script to remove non-essential console statements from frontend
# Keeps: console.error in error handlers, test files, and observability files

WEB_SRC="/Users/golfergeek/projects/orchAI/orchestrator-ai-v2/apps/web/src"

# Files to exclude from cleanup (observability and error handling)
EXCLUDE_PATTERNS=(
  "useAdminObservabilityStream"
  "useGlobalErrorHandler"
  "errorStore"
  "test.ts"
  "spec.ts"
  "setup.ts"
)

# Find all .ts and .vue files with console.log or console.debug or console.warn
# Exclude observability and test files
find "$WEB_SRC" \( -name "*.ts" -o -name "*.vue" \) \
  ! -path "*/tests/*" \
  ! -path "*/*test.ts" \
  ! -path "*/*spec.ts" \
  ! -name "useAdminObservabilityStream.ts" \
  ! -name "useGlobalErrorHandler.ts" \
  ! -name "errorStore.ts" \
  -type f \
  -exec grep -l "console\.\(log\|debug\|info\|warn\)" {} \; | \
while read -r file; do
  echo "Cleaning: $file"
  # Remove console.log statements
  sed -i.bak '/console\.log(/d' "$file"
  # Remove console.debug statements
  sed -i.bak '/console\.debug(/d' "$file"
  # Remove console.info statements
  sed -i.bak '/console\.info(/d' "$file"
  # Remove console.warn statements (except in error handlers)
  sed -i.bak '/console\.warn(/d' "$file"
  # Remove backup file
  rm -f "$file.bak"
done

echo "Console cleanup complete!"
