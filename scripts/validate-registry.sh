#!/bin/bash

# Validate Registry Pattern Implementation
# Checks that all commands, agents, and skills have required registry fields

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLAUDE_DIR="$PROJECT_ROOT/.claude"

ERRORS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Validating Claude Code Registry Pattern..."
echo ""

# Function to check YAML frontmatter field
check_field() {
    local file="$1"
    local field="$2"
    local required="${3:-false}"
    
    if grep -q "^${field}:" "$file"; then
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}❌ Missing required field '${field}' in ${file}${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠️  Missing optional field '${field}' in ${file}${NC}"
            return 2
        fi
    fi
}

# Function to validate category value
validate_category() {
    local file="$1"
    local component_type="$2"
    local category=$(grep "^category:" "$file" | sed 's/category: *"\(.*\)"/\1/' | sed "s/category: *'\(.*\)'/\1/" | sed 's/category: *\(.*\)/\1/' | tr -d ' ')
    
    if [ -z "$category" ]; then
        return 1
    fi
    
    case "$component_type" in
        "command")
            case "$category" in
                "pr-workflow"|"development"|"quality"|"ecosystem")
                    return 0
                    ;;
                *)
                    echo -e "${RED}❌ Invalid category '${category}' in ${file}. Must be: pr-workflow, development, quality, or ecosystem${NC}"
                    return 1
                    ;;
            esac
            ;;
        "agent")
            case "$category" in
                "architecture"|"builder"|"specialized")
                    return 0
                    ;;
                *)
                    echo -e "${RED}❌ Invalid category '${category}' in ${file}. Must be: architecture, builder, or specialized${NC}"
                    return 1
                    ;;
            esac
            ;;
        "skill")
            case "$category" in
                "architecture"|"development"|"testing"|"utility"|"builder")
                    return 0
                    ;;
                *)
                    echo -e "${RED}❌ Invalid category '${category}' in ${file}. Must be: architecture, development, testing, utility, or builder${NC}"
                    return 1
                    ;;
            esac
            ;;
    esac
}

# Function to validate skill type
validate_skill_type() {
    local file="$1"
    local type=$(grep "^type:" "$file" | sed 's/type: *"\(.*\)"/\1/' | sed "s/type: *'\(.*\)'/\1/" | sed 's/type: *\(.*\)/\1/' | tr -d ' ')
    
    if [ -z "$type" ]; then
        return 1
    fi
    
    case "$type" in
        "classification-validation"|"prescriptive"|"utility"|"template")
            return 0
            ;;
        *)
            echo -e "${RED}❌ Invalid type '${type}' in ${file}. Must be: classification-validation, prescriptive, utility, or template${NC}"
            return 1
            ;;
    esac
}

# Function to check if referenced component exists
check_reference() {
    local file="$1"
    local field="$2"
    local component_type="$3"
    
    # Extract the line with the field
    local line=$(grep "^${field}:" "$file" || echo "")
    if [ -z "$line" ]; then
        return 0
    fi
    
    # Parse YAML array: ["item1", "item2"] or [item1, item2]
    # Remove field name and colon
    local content=$(echo "$line" | sed "s/^${field}://" | sed 's/^ *//')
    
    # Check if it's an empty array
    if [ "$content" = "[]" ] || [ -z "$content" ]; then
        return 0
    fi
    
    # Extract array items (handle both ["item"] and [item] formats)
    local refs=$(echo "$content" | sed 's/^\[//' | sed 's/\]$//' | sed 's/"//g' | sed "s/'//g" | sed 's/, */ /g')
    
    if [ -z "$refs" ]; then
        return 0
    fi
    
    for ref in $refs; do
        # Skip empty refs
        if [ -z "$ref" ]; then
            continue
        fi
        
        local found=false
        case "$component_type" in
            "skill")
                if [ -f "$CLAUDE_DIR/skills/${ref}/SKILL.md" ]; then
                    found=true
                fi
                ;;
            "agent")
                if [ -f "$CLAUDE_DIR/agents/${ref}.md" ]; then
                    found=true
                fi
                ;;
            "command")
                if [ -f "$CLAUDE_DIR/commands/${ref}.md" ]; then
                    found=true
                fi
                ;;
        esac
        
        if [ "$found" = "false" ]; then
            echo -e "${RED}❌ Referenced ${component_type} '${ref}' in ${field} of ${file} does not exist${NC}"
            return 1
        fi
    done
    
    return 0
}

# Validate Commands
echo "📋 Validating Commands..."
COMMAND_COUNT=0
COMMAND_ERRORS=0

for cmd_file in "$CLAUDE_DIR/commands"/*.md; do
    if [ -f "$cmd_file" ]; then
        COMMAND_COUNT=$((COMMAND_COUNT + 1))
        cmd_name=$(basename "$cmd_file" .md)
        
        # Check required fields
        if ! check_field "$cmd_file" "category" "true"; then
            COMMAND_ERRORS=$((COMMAND_ERRORS + 1))
            ERRORS=$((ERRORS + 1))
        fi
        
        # Validate category
        if ! validate_category "$cmd_file" "command"; then
            COMMAND_ERRORS=$((COMMAND_ERRORS + 1))
            ERRORS=$((ERRORS + 1))
        fi
        
        # Check optional fields (warnings only)
        check_field "$cmd_file" "uses-skills" "false" || WARNINGS=$((WARNINGS + 1))
        check_field "$cmd_file" "uses-agents" "false" || WARNINGS=$((WARNINGS + 1))
        check_field "$cmd_file" "related-commands" "false" || WARNINGS=$((WARNINGS + 1))
        
        # Validate references
        if grep -q "^uses-skills:" "$cmd_file"; then
            check_reference "$cmd_file" "uses-skills" "skill" || COMMAND_ERRORS=$((COMMAND_ERRORS + 1)) || ERRORS=$((ERRORS + 1))
        fi
        if grep -q "^uses-agents:" "$cmd_file"; then
            check_reference "$cmd_file" "uses-agents" "agent" || COMMAND_ERRORS=$((COMMAND_ERRORS + 1)) || ERRORS=$((ERRORS + 1))
        fi
        if grep -q "^related-commands:" "$cmd_file"; then
            check_reference "$cmd_file" "related-commands" "command" || COMMAND_ERRORS=$((COMMAND_ERRORS + 1)) || ERRORS=$((ERRORS + 1))
        fi
    fi
done

if [ $COMMAND_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All $COMMAND_COUNT commands validated${NC}"
else
    echo -e "${RED}❌ $COMMAND_ERRORS error(s) found in commands${NC}"
fi
echo ""

# Validate Agents
echo "🤖 Validating Agents..."
AGENT_COUNT=0
AGENT_ERRORS=0

for agent_file in "$CLAUDE_DIR/agents"/*.md; do
    if [ -f "$agent_file" ]; then
        AGENT_COUNT=$((AGENT_COUNT + 1))
        agent_name=$(basename "$agent_file" .md)
        
        # Check required fields
        if ! check_field "$agent_file" "category" "true"; then
            AGENT_ERRORS=$((AGENT_ERRORS + 1))
            ERRORS=$((ERRORS + 1))
        fi
        
        if ! check_field "$agent_file" "mandatory-skills" "true"; then
            AGENT_ERRORS=$((AGENT_ERRORS + 1))
            ERRORS=$((ERRORS + 1))
        fi
        
        # Validate category
        if ! validate_category "$agent_file" "agent"; then
            AGENT_ERRORS=$((AGENT_ERRORS + 1))
            ERRORS=$((ERRORS + 1))
        fi
        
        # Check optional fields (warnings only)
        check_field "$agent_file" "optional-skills" "false" || WARNINGS=$((WARNINGS + 1))
        check_field "$agent_file" "related-agents" "false" || WARNINGS=$((WARNINGS + 1))
        
        # Validate references
        if grep -q "^mandatory-skills:" "$agent_file"; then
            check_reference "$agent_file" "mandatory-skills" "skill" || AGENT_ERRORS=$((AGENT_ERRORS + 1)) || ERRORS=$((ERRORS + 1))
        fi
        if grep -q "^optional-skills:" "$agent_file"; then
            check_reference "$agent_file" "optional-skills" "skill" || AGENT_ERRORS=$((AGENT_ERRORS + 1)) || ERRORS=$((ERRORS + 1))
        fi
        if grep -q "^related-agents:" "$agent_file"; then
            check_reference "$agent_file" "related-agents" "agent" || AGENT_ERRORS=$((AGENT_ERRORS + 1)) || ERRORS=$((ERRORS + 1))
        fi
        
        # Validate mandatory skills for architecture agents
        if grep -q 'category: "architecture"' "$agent_file"; then
            if ! grep -q "execution-context-skill" "$agent_file"; then
                echo -e "${RED}❌ Architecture agent ${agent_name} missing mandatory execution-context-skill${NC}"
                AGENT_ERRORS=$((AGENT_ERRORS + 1))
                ERRORS=$((ERRORS + 1))
            fi
            if ! grep -q "transport-types-skill" "$agent_file"; then
                echo -e "${RED}❌ Architecture agent ${agent_name} missing mandatory transport-types-skill${NC}"
                AGENT_ERRORS=$((AGENT_ERRORS + 1))
                ERRORS=$((ERRORS + 1))
            fi
        fi
    fi
done

if [ $AGENT_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All $AGENT_COUNT agents validated${NC}"
else
    echo -e "${RED}❌ $AGENT_ERRORS error(s) found in agents${NC}"
fi
echo ""

# Validate Skills
echo "🎯 Validating Skills..."
SKILL_COUNT=0
SKILL_ERRORS=0

for skill_dir in "$CLAUDE_DIR/skills"/*/; do
    skill_file="${skill_dir}SKILL.md"
    if [ -f "$skill_file" ]; then
        SKILL_COUNT=$((SKILL_COUNT + 1))
        skill_name=$(basename "$skill_dir")
        
        # Check required fields
        if ! check_field "$skill_file" "category" "true"; then
            SKILL_ERRORS=$((SKILL_ERRORS + 1))
            ERRORS=$((ERRORS + 1))
        fi
        
        if ! check_field "$skill_file" "type" "true"; then
            SKILL_ERRORS=$((SKILL_ERRORS + 1))
            ERRORS=$((ERRORS + 1))
        fi
        
        # Validate category
        if ! validate_category "$skill_file" "skill"; then
            SKILL_ERRORS=$((SKILL_ERRORS + 1))
            ERRORS=$((ERRORS + 1))
        fi
        
        # Validate type
        if ! validate_skill_type "$skill_file"; then
            SKILL_ERRORS=$((SKILL_ERRORS + 1))
            ERRORS=$((ERRORS + 1))
        fi
        
        # Check optional fields (warnings only)
        check_field "$skill_file" "used-by-agents" "false" || WARNINGS=$((WARNINGS + 1))
        check_field "$skill_file" "related-skills" "false" || WARNINGS=$((WARNINGS + 1))
        
        # Validate references
        if grep -q "^used-by-agents:" "$skill_file"; then
            check_reference "$skill_file" "used-by-agents" "agent" || SKILL_ERRORS=$((SKILL_ERRORS + 1)) || ERRORS=$((ERRORS + 1))
        fi
        if grep -q "^related-skills:" "$skill_file"; then
            check_reference "$skill_file" "related-skills" "skill" || SKILL_ERRORS=$((SKILL_ERRORS + 1)) || ERRORS=$((ERRORS + 1))
        fi
    fi
done

if [ $SKILL_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All $SKILL_COUNT skills validated${NC}"
else
    echo -e "${RED}❌ $SKILL_ERRORS error(s) found in skills${NC}"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Commands:  $COMMAND_COUNT"
echo "Agents:    $AGENT_COUNT"
echo "Skills:    $SKILL_COUNT"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All components validated successfully!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Validation passed with $WARNINGS warning(s)${NC}"
    exit 0
else
    echo -e "${RED}❌ Validation failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    exit 1
fi

