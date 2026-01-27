#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Orchestrator AI Command Menu${NC}"
echo -e "${BLUE}===============================${NC}"

# Get detailed list from just
recipes=()
while IFS= read -r line; do
    recipes+=("$line")
done < <(just --list | tail -n +2)

declare -a recipe_names
declare -a recipe_descs
count=1

for line in "${recipes[@]}"; do
    # Trim leading whitespace
    trimmed=$(echo "$line" | sed 's/^[ \t]*//')
    
    # Get recipe name (first word)
    name=$(echo "$trimmed" | awk '{print $1}')
    
    # Skip if empty or default
    if [[ -z "$name" || "$name" == "default" ]]; then
        continue
    fi
    
    # Get description (content after #)
    if [[ "$trimmed" == *"#"* ]]; then
        desc=$(echo "$trimmed" | cut -d'#' -f2- | sed 's/^[ \t]*//')
    else
        desc=""
    fi
    
    recipe_names+=("$name")
    recipe_descs+=("$desc")
    
    # Format nicer output
    # printf doesn't handle colors well with column alignment typically, manual padding
    if [ "$count" -lt 10 ]; then
        echo -e " ${GREEN}$count)${NC} ${CYAN}$name${NC} \t- $desc"
    else
        echo -e "${GREEN}$count)${NC} ${CYAN}$name${NC} \t- $desc"
    fi
    ((count++))
done

echo ""
echo -e "${YELLOW}Enter command number (or 'q' to quit):${NC}"
read -r choice

if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
    echo "Bye!"
    exit 0
fi

if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#recipe_names[@]}" ]; then
    idx=$((choice-1))
    selected="${recipe_names[$idx]}"
    echo -e "\n${BLUE}Running: just $selected${NC}\n"
    just "$selected"
else
    echo -e "${RED}Invalid selection.${NC}"
    exit 1
fi
