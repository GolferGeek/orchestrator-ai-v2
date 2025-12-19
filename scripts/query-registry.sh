#!/bin/bash

# Query Claude Code Registry
# Provides various queries for registry data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLAUDE_DIR="$PROJECT_ROOT/.claude"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to extract YAML field value
get_field() {
    local file="$1"
    local field="$2"
    local line=$(grep "^${field}:" "$file" 2>/dev/null || echo "")
    if [ -z "$line" ]; then
        echo ""
        return
    fi
    
    # Remove field name and colon, trim whitespace
    echo "$line" | sed "s/^${field}://" | sed 's/^ *//' | sed 's/ *$//'
}

# Function to parse YAML array
parse_array() {
    local content="$1"
    if [ -z "$content" ] || [ "$content" = "[]" ]; then
        echo ""
        return
    fi
    
    # Extract array items
    echo "$content" | sed 's/^\[//' | sed 's/\]$//' | sed 's/"//g' | sed "s/'//g" | sed 's/, */ /g'
}

# Function to list all components by category
list_by_category() {
    local component_type="$1"
    local category="$2"
    
    case "$component_type" in
        "command")
            local dir="$CLAUDE_DIR/commands"
            local suffix=".md"
            ;;
        "agent")
            local dir="$CLAUDE_DIR/agents"
            local suffix=".md"
            ;;
        "skill")
            local dir="$CLAUDE_DIR/skills"
            local suffix="/SKILL.md"
            ;;
        *)
            echo "Invalid component type: $component_type"
            return 1
            ;;
    esac
    
    local type_label=$(echo "$component_type" | sed 's/^./\U&/')
    echo -e "${BLUE}${type_label}s in category '${category}':${NC}"
    echo ""
    
    local count=0
    if [ "$component_type" = "skill" ]; then
        for skill_dir in "$dir"/*/; do
            file="${skill_dir}SKILL.md"
            if [ -f "$file" ]; then
                local file_category=$(get_field "$file" "category" | sed 's/"//g')
                if [ "$file_category" = "${category}" ]; then
                    local name=$(get_field "$file" "name" | sed 's/"//g')
                    echo "  - $name"
                    count=$((count + 1))
                fi
            fi
        done
    else
        for file in "$dir"/*${suffix}; do
            if [ -f "$file" ]; then
                local file_category=$(get_field "$file" "category" | sed 's/"//g')
                if [ "$file_category" = "${category}" ]; then
                    local name=""
                    if [ "$component_type" = "command" ]; then
                        name=$(basename "$file" .md)
                    elif [ "$component_type" = "agent" ]; then
                        name=$(get_field "$file" "name" | sed 's/"//g')
                    fi
                    
                    echo "  - $name"
                    count=$((count + 1))
                fi
            fi
        done
    fi
    
    if [ $count -eq 0 ]; then
        echo "  (none found)"
    fi
    echo ""
}

# Function to find agents using a skill
find_agents_using_skill() {
    local skill_name="$1"
    
    echo -e "${BLUE}Agents using skill '${skill_name}':${NC}"
    echo ""
    
    local count=0
    for agent_file in "$CLAUDE_DIR/agents"/*.md; do
        if [ -f "$agent_file" ]; then
            local mandatory=$(get_field "$agent_file" "mandatory-skills")
            local optional=$(get_field "$agent_file" "optional-skills")
            
            local mandatory_list=$(parse_array "$mandatory")
            local optional_list=$(parse_array "$optional")
            
            local found=false
            for skill in $mandatory_list $optional_list; do
                if [ "$skill" = "$skill_name" ]; then
                    found=true
                    break
                fi
            done
            
            if [ "$found" = "true" ]; then
                local agent_name=$(get_field "$agent_file" "name" | sed 's/"//g')
                echo "  - $agent_name"
                count=$((count + 1))
            fi
        fi
    done
    
    if [ $count -eq 0 ]; then
        echo "  (none found)"
    fi
    echo ""
}

# Function to find skills used by an agent
find_skills_used_by_agent() {
    local agent_name="$1"
    
    echo -e "${BLUE}Skills used by agent '${agent_name}':${NC}"
    echo ""
    
    local agent_file="$CLAUDE_DIR/agents/${agent_name}.md"
    if [ ! -f "$agent_file" ]; then
        echo "  Agent not found: $agent_name"
        echo ""
        return 1
    fi
    
    local mandatory=$(get_field "$agent_file" "mandatory-skills")
    local optional=$(get_field "$agent_file" "optional-skills")
    
    local mandatory_list=$(parse_array "$mandatory")
    local optional_list=$(parse_array "$optional")
    
    if [ -n "$mandatory_list" ]; then
        echo -e "${GREEN}Mandatory:${NC}"
        for skill in $mandatory_list; do
            echo "  - $skill"
        done
        echo ""
    fi
    
    if [ -n "$optional_list" ]; then
        echo -e "${YELLOW}Optional:${NC}"
        for skill in $optional_list; do
            echo "  - $skill"
        done
        echo ""
    fi
    
    if [ -z "$mandatory_list" ] && [ -z "$optional_list" ]; then
        echo "  (none found)"
        echo ""
    fi
}

# Function to show full registry entry
show_registry_entry() {
    local component_type="$1"
    local component_name="$2"
    
    case "$component_type" in
        "command")
            local file="$CLAUDE_DIR/commands/${component_name}.md"
            ;;
        "agent")
            local file="$CLAUDE_DIR/agents/${component_name}.md"
            ;;
        "skill")
            local file="$CLAUDE_DIR/skills/${component_name}/SKILL.md"
            ;;
        *)
            echo "Invalid component type: $component_type"
            return 1
            ;;
    esac
    
    if [ ! -f "$file" ]; then
        echo "Component not found: ${component_type}/${component_name}"
        return 1
    fi
    
    echo -e "${BLUE}Registry Entry: ${component_type}/${component_name}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Extract all registry fields from frontmatter
    local in_frontmatter=false
    while IFS= read -r line; do
        if [[ "$line" == "---" ]]; then
            if [ "$in_frontmatter" = "false" ]; then
                in_frontmatter=true
            else
                break
            fi
        elif [ "$in_frontmatter" = "true" ]; then
            if [[ "$line" =~ ^(category|uses-skills|uses-agents|related-commands|mandatory-skills|optional-skills|related-agents|type|used-by-agents|related-skills): ]]; then
                echo "$line"
            fi
        fi
    done < "$file"
    
    echo ""
}

# Function to generate JSON registry view
generate_json_registry() {
    local output_file="${1:-registry.json}"
    
    echo "{"
    echo "  \"commands\": ["
    
    local first=true
    for cmd_file in "$CLAUDE_DIR/commands"/*.md; do
        if [ -f "$cmd_file" ]; then
            if [ "$first" = "true" ]; then
                first=false
            else
                echo ","
            fi
            
            local cmd_name=$(basename "$cmd_file" .md)
            local category=$(get_field "$cmd_file" "category" | sed 's/"//g')
            local uses_skills=$(get_field "$cmd_file" "uses-skills")
            local uses_agents=$(get_field "$cmd_file" "uses-agents")
            local related=$(get_field "$cmd_file" "related-commands")
            
            echo "    {"
            echo "      \"name\": \"$cmd_name\","
            echo "      \"category\": $category,"
            echo "      \"uses-skills\": $uses_skills,"
            echo "      \"uses-agents\": $uses_agents,"
            echo "      \"related-commands\": $related"
            echo -n "    }"
        fi
    done
    
    echo ""
    echo "  ],"
    echo "  \"agents\": ["
    
    first=true
    for agent_file in "$CLAUDE_DIR/agents"/*.md; do
        if [ -f "$agent_file" ]; then
            if [ "$first" = "true" ]; then
                first=false
            else
                echo ","
            fi
            
            local agent_name=$(get_field "$agent_file" "name" | sed 's/"//g')
            local category=$(get_field "$agent_file" "category" | sed 's/"//g')
            local mandatory=$(get_field "$agent_file" "mandatory-skills")
            local optional=$(get_field "$agent_file" "optional-skills")
            local related=$(get_field "$agent_file" "related-agents")
            
            echo "    {"
            echo "      \"name\": \"$agent_name\","
            echo "      \"category\": $category,"
            echo "      \"mandatory-skills\": $mandatory,"
            echo "      \"optional-skills\": $optional,"
            echo "      \"related-agents\": $related"
            echo -n "    }"
        fi
    done
    
    echo ""
    echo "  ],"
    echo "  \"skills\": ["
    
    first=true
    for skill_dir in "$CLAUDE_DIR/skills"/*/; do
        skill_file="${skill_dir}SKILL.md"
        if [ -f "$skill_file" ]; then
            if [ "$first" = "true" ]; then
                first=false
            else
                echo ","
            fi
            
            local skill_name=$(get_field "$skill_file" "name" | sed 's/"//g')
            local category=$(get_field "$skill_file" "category" | sed 's/"//g')
            local type=$(get_field "$skill_file" "type" | sed 's/"//g')
            local used_by=$(get_field "$skill_file" "used-by-agents")
            local related=$(get_field "$skill_file" "related-skills")
            
            echo "    {"
            echo "      \"name\": \"$skill_name\","
            echo "      \"category\": $category,"
            echo "      \"type\": $type,"
            echo "      \"used-by-agents\": $used_by,"
            echo "      \"related-skills\": $related"
            echo -n "    }"
        fi
    done
    
    echo ""
    echo "  ]"
    echo "}" > "$output_file"
    
    echo -e "${GREEN}✅ JSON registry generated: ${output_file}${NC}"
}

# Main menu
usage() {
    echo "Usage: $0 <command> [args...]"
    echo ""
    echo "Commands:"
    echo "  list-category <type> <category>     List components by category"
    echo "                                     Types: command, agent, skill"
    echo "  agents-using-skill <skill-name>   Find agents using a skill"
    echo "  skills-used-by-agent <agent-name> Find skills used by an agent"
    echo "  show <type> <name>                Show full registry entry"
    echo "  json [output-file]                Generate JSON registry (default: registry.json)"
    echo ""
    echo "Examples:"
    echo "  $0 list-category command pr-workflow"
    echo "  $0 list-category agent architecture"
    echo "  $0 list-category skill utility"
    echo "  $0 agents-using-skill execution-context-skill"
    echo "  $0 skills-used-by-agent web-architecture-agent"
    echo "  $0 show command create-pr"
    echo "  $0 show agent web-architecture-agent"
    echo "  $0 show skill web-architecture-skill"
    echo "  $0 json registry.json"
}

# Parse command
case "${1:-}" in
    "list-category")
        if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
            echo "Error: list-category requires <type> and <category>"
            usage
            exit 1
        fi
        list_by_category "$2" "$3"
        ;;
    "agents-using-skill")
        if [ -z "${2:-}" ]; then
            echo "Error: agents-using-skill requires <skill-name>"
            usage
            exit 1
        fi
        find_agents_using_skill "$2"
        ;;
    "skills-used-by-agent")
        if [ -z "${2:-}" ]; then
            echo "Error: skills-used-by-agent requires <agent-name>"
            usage
            exit 1
        fi
        find_skills_used_by_agent "$2"
        ;;
    "show")
        if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
            echo "Error: show requires <type> and <name>"
            usage
            exit 1
        fi
        show_registry_entry "$2" "$3"
        ;;
    "json")
        generate_json_registry "${2:-registry.json}"
        ;;
    *)
        usage
        exit 1
        ;;
esac

