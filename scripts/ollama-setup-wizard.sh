#!/bin/bash
# =============================================================================
# Ollama Setup Wizard
# =============================================================================
# Interactive CLI wizard that detects system RAM and recommends appropriate
# Ollama models for your machine.
#
# Usage:
#   ./scripts/ollama-setup-wizard.sh           # Interactive mode
#   ./scripts/ollama-setup-wizard.sh --auto    # Auto-install recommended
#   ./scripts/ollama-setup-wizard.sh --list    # Just show recommendations
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Model definitions with RAM requirements
# Format: "model_name|size_gb|min_ram_gb|tier|description"
declare -a MODELS=(
    "llama3.2:1b|1.3|8|economy|Fast responses, simple tasks"
    "llama3.2:3b|2.0|16|standard|General purpose, balanced"
    "qwen3:8b|4.7|32|standard|Code generation, reasoning"
    "qwen3:14b|8.9|48|premium|Complex tasks, better quality"
    "deepseek-r1:32b|19|64|premium|Advanced reasoning"
    "deepseek-r1:70b|40|96|cloud|Maximum capability"
)

# Detect operating system
detect_os() {
    case "$(uname -s)" in
        Darwin*) echo "macos" ;;
        Linux*)  echo "linux" ;;
        *)       echo "unknown" ;;
    esac
}

# Detect system RAM in GB
detect_ram() {
    local os=$(detect_os)
    local ram_bytes=0

    if [[ "$os" == "macos" ]]; then
        ram_bytes=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    elif [[ "$os" == "linux" ]]; then
        ram_bytes=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2 * 1024}' || echo 0)
    fi

    if [[ "$ram_bytes" -eq 0 ]]; then
        echo "0"
        return
    fi

    # Convert to GB
    echo $((ram_bytes / 1024 / 1024 / 1024))
}

# Check if Ollama is installed and running
check_ollama() {
    if ! command -v ollama &> /dev/null; then
        echo -e "${RED}Error: Ollama is not installed.${NC}"
        echo -e "Install from: ${CYAN}https://ollama.ai${NC}"
        exit 1
    fi

    # Check if Ollama server is running
    if ! curl -s http://localhost:11434/api/version &> /dev/null; then
        echo -e "${YELLOW}Starting Ollama server...${NC}"
        if [[ "$(detect_os)" == "macos" ]]; then
            open -a Ollama 2>/dev/null || ollama serve &
        else
            ollama serve &
        fi
        sleep 3

        if ! curl -s http://localhost:11434/api/version &> /dev/null; then
            echo -e "${RED}Error: Could not start Ollama server.${NC}"
            echo -e "Try running: ${CYAN}ollama serve${NC}"
            exit 1
        fi
    fi
}

# Get already installed models
get_installed_models() {
    ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' || echo ""
}

# Get recommended models for RAM
get_recommendations() {
    local ram_gb=$1
    local installed=$(get_installed_models)

    for model_info in "${MODELS[@]}"; do
        IFS='|' read -r name size min_ram tier description <<< "$model_info"

        local is_installed="false"
        if echo "$installed" | grep -q "^${name}$"; then
            is_installed="true"
        fi

        local is_recommended="false"
        if (( ram_gb >= min_ram )); then
            is_recommended="true"
        fi

        echo "${name}|${size}|${min_ram}|${tier}|${description}|${is_installed}|${is_recommended}"
    done
}

# Display model table
display_models() {
    local ram_gb=$1
    local recommendations=$(get_recommendations "$ram_gb")

    echo ""
    echo -e "${BOLD}Available Ollama Models:${NC}"
    echo ""
    printf "  %-20s %-8s %-10s %-10s %-35s\n" "MODEL" "SIZE" "MIN RAM" "TIER" "DESCRIPTION"
    echo "  ────────────────────────────────────────────────────────────────────────────────────────"

    while IFS='|' read -r name size min_ram tier description is_installed is_recommended; do
        local status=""
        local color=""

        if [[ "$is_installed" == "true" ]]; then
            status="[installed]"
            color="${GREEN}"
        elif [[ "$is_recommended" == "true" ]]; then
            status="[recommended]"
            color="${CYAN}"
        else
            status=""
            color="${RED}"
        fi

        printf "  ${color}%-20s${NC} %-8s %-10s %-10s %-35s ${color}%s${NC}\n" \
            "$name" "${size}GB" "${min_ram}GB" "$tier" "$description" "$status"
    done <<< "$recommendations"

    echo ""
}

# Install a model
install_model() {
    local model=$1
    echo -e "${BLUE}Pulling ${model}...${NC}"
    if ollama pull "$model"; then
        echo -e "${GREEN}Successfully installed ${model}${NC}"
        return 0
    else
        echo -e "${RED}Failed to install ${model}${NC}"
        return 1
    fi
}

# Auto-install recommended models
auto_install() {
    local ram_gb=$1
    local recommendations=$(get_recommendations "$ram_gb")
    local models_to_install=()

    while IFS='|' read -r name size min_ram tier description is_installed is_recommended; do
        if [[ "$is_recommended" == "true" && "$is_installed" == "false" ]]; then
            models_to_install+=("$name")
        fi
    done <<< "$recommendations"

    if [[ ${#models_to_install[@]} -eq 0 ]]; then
        echo -e "${GREEN}All recommended models are already installed!${NC}"
        return 0
    fi

    echo -e "${BOLD}Installing ${#models_to_install[@]} recommended model(s)...${NC}"
    echo ""

    for model in "${models_to_install[@]}"; do
        install_model "$model"
    done
}

# Interactive model selection
interactive_install() {
    local ram_gb=$1
    local recommendations=$(get_recommendations "$ram_gb")

    echo -e "${BOLD}Select models to install:${NC}"
    echo -e "(Enter model names separated by spaces, or press Enter for recommended)"
    echo ""

    # Show recommended defaults
    local recommended_models=()
    while IFS='|' read -r name size min_ram tier description is_installed is_recommended; do
        if [[ "$is_recommended" == "true" && "$is_installed" == "false" ]]; then
            recommended_models+=("$name")
        fi
    done <<< "$recommendations"

    if [[ ${#recommended_models[@]} -eq 0 ]]; then
        echo -e "${GREEN}All recommended models are already installed!${NC}"
        return 0
    fi

    echo -e "Recommended: ${CYAN}${recommended_models[*]}${NC}"
    echo ""
    read -p "Models to install (Enter for recommended): " user_input

    local models_to_install=()
    if [[ -z "$user_input" ]]; then
        models_to_install=("${recommended_models[@]}")
    else
        read -ra models_to_install <<< "$user_input"
    fi

    echo ""
    for model in "${models_to_install[@]}"; do
        install_model "$model"
    done
}

# Sync with API (optional)
sync_with_api() {
    local api_port=${API_PORT:-6100}
    local api_url="http://localhost:${api_port}/llm/sync-models"

    echo ""
    echo -e "${BLUE}Syncing models with database...${NC}"

    if curl -s -X POST "$api_url" > /dev/null 2>&1; then
        echo -e "${GREEN}Database sync complete!${NC}"
    else
        echo -e "${YELLOW}Note: API not available for sync. Models will sync on next API startup.${NC}"
    fi
}

# Main script
main() {
    local mode="interactive"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --auto)
                mode="auto"
                shift
                ;;
            --list)
                mode="list"
                shift
                ;;
            --help|-h)
                echo "Ollama Setup Wizard"
                echo ""
                echo "Usage:"
                echo "  $0              Interactive mode (default)"
                echo "  $0 --auto       Auto-install recommended models"
                echo "  $0 --list       Just show recommendations"
                echo "  $0 --help       Show this help"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    echo ""
    echo -e "${BOLD}================================================${NC}"
    echo -e "${BOLD}           Ollama Setup Wizard${NC}"
    echo -e "${BOLD}================================================${NC}"
    echo ""

    # Detect RAM
    local ram_gb=$(detect_ram)

    if [[ "$ram_gb" -eq 0 ]]; then
        echo -e "${YELLOW}Could not detect system RAM. Please enter RAM size in GB:${NC}"
        read -p "RAM (GB): " ram_gb
    else
        echo -e "Detected System RAM: ${GREEN}${ram_gb}GB${NC}"
    fi

    echo -e "Operating System: ${GREEN}$(detect_os)${NC}"

    # Check Ollama
    check_ollama

    # Show current models
    display_models "$ram_gb"

    # Take action based on mode
    case $mode in
        auto)
            auto_install "$ram_gb"
            sync_with_api
            ;;
        list)
            echo -e "${CYAN}Use --auto to install recommended models automatically.${NC}"
            ;;
        interactive)
            interactive_install "$ram_gb"
            sync_with_api
            ;;
    esac

    echo ""
    echo -e "${GREEN}Done!${NC}"
    echo ""
}

main "$@"
