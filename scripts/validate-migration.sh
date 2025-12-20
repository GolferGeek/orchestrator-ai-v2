#!/bin/bash
# =============================================================================
# Migration Validation Script
# =============================================================================
# Validates SQL migrations before applying to the database
# Usage: ./scripts/validate-migration.sh [migration-file]
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

MIGRATION_DIR="storage/migrations/proposed"

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to validate SQL syntax
validate_syntax() {
    local file=$1
    print_status "$YELLOW" "Checking SQL syntax for: $file"

    # Check if file exists
    if [ ! -f "$file" ]; then
        print_status "$RED" "Error: File not found: $file"
        return 1
    fi

    # Check file extension
    if [[ ! "$file" =~ \.sql$ ]]; then
        print_status "$RED" "Error: File must have .sql extension"
        return 1
    fi

    # Check for common SQL syntax issues
    local issues=0

    # Check for missing semicolons at statement ends
    if grep -P "^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)\b" "$file" | grep -v ";\s*$" | grep -v -- "--" > /dev/null 2>&1; then
        print_status "$YELLOW" "Warning: Some statements may be missing semicolons"
        ((issues++))
    fi

    # Check for balanced parentheses
    local open_parens=$(grep -o '(' "$file" | wc -l)
    local close_parens=$(grep -o ')' "$file" | wc -l)
    if [ "$open_parens" -ne "$close_parens" ]; then
        print_status "$RED" "Error: Unbalanced parentheses (open: $open_parens, close: $close_parens)"
        return 1
    fi

    if [ $issues -eq 0 ]; then
        print_status "$GREEN" "Syntax check passed"
    fi
    return 0
}

# Function to check for rollback instructions
check_rollback() {
    local file=$1
    print_status "$YELLOW" "Checking for rollback instructions..."

    if grep -qi "rollback\|undo\|revert" "$file"; then
        print_status "$GREEN" "Rollback instructions found"
        return 0
    else
        print_status "$YELLOW" "Warning: No rollback instructions found. Consider adding -- ROLLBACK: comments"
        return 0
    fi
}

# Function to check migration naming convention
check_naming() {
    local file=$1
    local filename=$(basename "$file")
    print_status "$YELLOW" "Checking naming convention..."

    # Expected format: YYYYMMDD-HHMM-description.sql or YYYYMMDDNNNNNN_description.sql
    if [[ "$filename" =~ ^[0-9]{8}(-[0-9]{4})?(_|-)[a-z0-9_-]+\.sql$ ]] || [[ "$filename" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]]; then
        print_status "$GREEN" "Naming convention OK"
        return 0
    else
        print_status "$YELLOW" "Warning: Filename may not follow convention. Expected: YYYYMMDD-HHMM-description.sql or YYYYMMDDNNNNNN_description.sql"
        return 0
    fi
}

# Main validation function
validate_migration() {
    local file=$1
    local errors=0

    echo ""
    echo "============================================="
    echo "Validating: $file"
    echo "============================================="
    echo ""

    validate_syntax "$file" || ((errors++))
    check_rollback "$file" || ((errors++))
    check_naming "$file" || ((errors++))

    echo ""
    if [ $errors -eq 0 ]; then
        print_status "$GREEN" "Validation PASSED"
        return 0
    else
        print_status "$RED" "Validation FAILED with $errors error(s)"
        return 1
    fi
}

# Main script
main() {
    if [ $# -eq 0 ]; then
        # Validate all proposed migrations
        print_status "$YELLOW" "Validating all proposed migrations in $MIGRATION_DIR..."

        if [ ! -d "$MIGRATION_DIR" ]; then
            print_status "$YELLOW" "No proposed migrations directory found"
            exit 0
        fi

        local total_errors=0
        for file in "$MIGRATION_DIR"/*.sql; do
            [ -e "$file" ] || continue
            validate_migration "$file" || ((total_errors++))
        done

        echo ""
        echo "============================================="
        if [ $total_errors -eq 0 ]; then
            print_status "$GREEN" "All migrations validated successfully"
        else
            print_status "$RED" "$total_errors migration(s) failed validation"
            exit 1
        fi
    else
        # Validate specific file
        validate_migration "$1"
    fi
}

main "$@"
