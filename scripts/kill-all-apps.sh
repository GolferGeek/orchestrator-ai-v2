#!/bin/bash

# Script to kill all development apps running on their ports
# Usage: ./scripts/kill-all-apps.sh

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

echo -e "${BLUE}🛑 Stopping all development apps${NC}"
echo ""

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local name=$2
    
    # Find process using the port
    local pid=$(lsof -ti:$port 2>/dev/null)
    
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}🛑 Killing $name on port $port (PID: $pid)...${NC}"
        kill -9 $pid 2>/dev/null
        sleep 0.5
        
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

# Kill all services
kill_port "$API_PORT" "API Server"
kill_port "$WEB_PORT" "Web App"
kill_port "$ORCH_FLOW_PORT" "Orch-Flow"
kill_port "$NOTEBOOK_FRONTEND_PORT" "Open Notebook Frontend"
kill_port "$NOTEBOOK_API_PORT" "Open Notebook API"

echo ""
echo -e "${GREEN}✅ All development apps stopped${NC}"

