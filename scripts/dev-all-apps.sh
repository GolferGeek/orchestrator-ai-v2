#!/bin/bash

# Script to start all 4 development apps in separate named terminal windows
# Usage: ./scripts/dev-all-apps.sh

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Load environment variables to get actual ports
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Get ports with defaults
API_PORT=${API_PORT:-6100}
WEB_PORT=${WEB_PORT:-9001}
ORCH_FLOW_PORT=${ORCH_FLOW_PORT:-6102}
NOTEBOOK_FRONTEND_PORT=${NOTEBOOK_FRONTEND_PORT:-6201}
NOTEBOOK_API_PORT=${NOTEBOOK_API_PORT:-6202}

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local name=$2
    
    # Find process using the port
    local pid=$(lsof -ti:$port 2>/dev/null)
    
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}🛑 Killing $name on port $port (PID: $pid)...${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
        
        # Verify it's killed
        if lsof -ti:$port >/dev/null 2>&1; then
            echo -e "${RED}⚠️  Failed to kill $name on port $port${NC}"
            return 1
        else
            echo -e "${GREEN}✅ $name stopped${NC}"
            return 0
        fi
    else
        echo -e "${BLUE}ℹ️  $name not running on port $port${NC}"
        return 0
    fi
}

echo -e "${BLUE}🚀 Starting all development apps in separate terminals${NC}"
echo ""

# Kill any existing processes on the ports
echo -e "${BLUE}🧹 Checking for running processes on ports...${NC}"
echo ""
kill_port "$API_PORT" "API Server"
kill_port "$WEB_PORT" "Web App"
kill_port "$ORCH_FLOW_PORT" "Orch-Flow"
kill_port "$NOTEBOOK_FRONTEND_PORT" "Open Notebook Frontend"
kill_port "$NOTEBOOK_API_PORT" "Open Notebook API"
echo ""

# Check if iTerm2 is available (better terminal management)
if [[ "$TERM_PROGRAM" == "iTerm.app" ]] || command -v osascript &> /dev/null && osascript -e 'tell application "System Events" to (name of processes) contains "iTerm"' 2>/dev/null; then
    USE_ITERM=true
    echo -e "${GREEN}✅ Detected iTerm2 - using iTerm2 windows${NC}"
else
    USE_ITERM=false
    echo -e "${YELLOW}📱 Using macOS Terminal${NC}"
fi

# Function to open a terminal window with a specific name and command
open_terminal() {
    local name=$1
    local command=$2
    local dir=${3:-$PROJECT_ROOT}
    
    # Use simpler name without emojis for AppleScript compatibility
    local simple_name=$(echo "$name" | sed 's/[🔷🌐🔄📓]//g' | xargs)
    
    # Create a temporary script file to avoid AppleScript quoting issues
    local temp_script=$(mktemp)
    cat > "$temp_script" <<SCRIPT
#!/bin/bash
cd '$dir'
echo -e '\033]0;$simple_name\007'
$command
SCRIPT
    chmod +x "$temp_script"
    
    if [ "$USE_ITERM" = true ]; then
        # Use iTerm2 - create new tab and run script
        osascript -e "tell application \"iTerm2\"" \
                  -e "  tell current window" \
                  -e "    create tab with default profile" \
                  -e "    tell current session of current tab to write text \"bash $temp_script\"" \
                  -e "  end tell" \
                  -e "end tell" 2>/dev/null || \
        # Fallback to Terminal if iTerm2 fails
        osascript -e "tell app \"Terminal\" to do script \"bash $temp_script\""
    else
        # Use macOS Terminal
        osascript -e "tell app \"Terminal\" to do script \"bash $temp_script\""
    fi
    
    sleep 1
}

# Check if Supabase needs to be started
echo -e "${BLUE}🗄️  Checking Supabase status...${NC}"
cd apps/api
if ! supabase status > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Supabase not running. Starting...${NC}"
    supabase start
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Supabase started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to start Supabase${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Supabase is already running${NC}"
fi
cd "$PROJECT_ROOT"

echo ""
echo -e "${BLUE}📱 Opening terminal windows...${NC}"
echo ""

# 1. API Server
echo -e "${GREEN}1️⃣  Opening API terminal...${NC}"
open_terminal "🔷 API Server" "npm run dev:api" "$PROJECT_ROOT"

# 2. Web App
echo -e "${GREEN}2️⃣  Opening Web terminal...${NC}"
open_terminal "🌐 Web App" "npm run dev:web" "$PROJECT_ROOT"

# 3. Orch-Flow
echo -e "${GREEN}3️⃣  Opening Orch-Flow terminal...${NC}"
open_terminal "🔄 Orch-Flow" "npm run dev:flow" "$PROJECT_ROOT"

# 4. Open Notebook
echo -e "${GREEN}4️⃣  Opening Open Notebook terminal...${NC}"
open_terminal "📓 Open Notebook" "npm run dev:notebook" "$PROJECT_ROOT"

echo ""
echo -e "${GREEN}✅ All terminals opened!${NC}"
echo ""
echo -e "${BLUE}📋 Terminal Summary:${NC}"
echo -e "  ${GREEN}🔷 API Server${NC}      - http://localhost:${API_PORT}"
echo -e "  ${GREEN}🌐 Web App${NC}         - http://localhost:${WEB_PORT}"
echo -e "  ${GREEN}🔄 Orch-Flow${NC}       - http://localhost:${ORCH_FLOW_PORT}"
echo -e "  ${GREEN}📓 Open Notebook${NC}   - http://localhost:${NOTEBOOK_FRONTEND_PORT} (Frontend) / http://localhost:${NOTEBOOK_API_PORT} (API)"
echo ""
echo -e "${BLUE}💡 Tip: Each terminal window is named for easy identification${NC}"
echo -e "${YELLOW}⚠️  Note: Close individual terminals to stop specific services${NC}"

