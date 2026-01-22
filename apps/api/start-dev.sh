#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

LANGGRAPH_STARTED_BY_SCRIPT=false

echo -e "${BLUE}🚀 Starting OrchAI NestJS API${NC}"

# Load environment variables from project root
if [ -f "../../.env" ]; then
    echo -e "${BLUE}📄 Loading environment variables from project root...${NC}"
    set -a
    source ../../.env
    set +a
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
else
    echo -e "${RED}⚠️  No .env file found in project root${NC}"
fi

# Check Docker daemon status
echo -e "${BLUE}🐳 Checking Docker daemon status...${NC}"

# Function to check if Docker daemon is running
check_docker() {
    # Try docker command first, then fall back to full path on macOS
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        return 0
    elif /Applications/Docker.app/Contents/Resources/bin/docker info >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start Docker Desktop (macOS)
start_docker_desktop() {
    echo -e "${BLUE}🚀 Starting Docker Desktop...${NC}"
    
    # Try to start Docker Desktop
    if command -v open >/dev/null 2>&1; then
        open -a Docker
        echo -e "${BLUE}⏳ Waiting for Docker Desktop to start (this may take 30-60 seconds)...${NC}"
        
        # Wait for Docker to start (max 2 minutes)
        local count=0
        local max_attempts=24  # 24 * 5 seconds = 2 minutes
        while [ $count -lt $max_attempts ]; do
            if check_docker; then
                echo -e "${GREEN}✅ Docker Desktop started successfully${NC}"
                return 0
            fi
            echo -e "${BLUE}   Waiting... ($((count + 1))/$max_attempts)${NC}"
            sleep 5
            count=$((count + 1))
        done
        
        echo -e "${RED}❌ Docker Desktop failed to start within 2 minutes${NC}"
        echo -e "${BLUE}💡 Please start Docker Desktop manually and try again${NC}"
        return 1
    else
        echo -e "${RED}❌ Cannot start Docker Desktop automatically on this system${NC}"
        echo -e "${BLUE}💡 Please start Docker Desktop manually and try again${NC}"
        return 1
    fi
}

# Check if Docker is running
if check_docker; then
    echo -e "${GREEN}✅ Docker daemon is running${NC}"
else
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo -e "${BLUE}🔧 Attempting to start Docker Desktop...${NC}"
    
    if start_docker_desktop; then
        echo -e "${GREEN}✅ Docker is now ready${NC}"
    else
        echo -e "${RED}❌ Failed to start Docker Desktop${NC}"
        echo -e "${BLUE}💡 Please start Docker Desktop manually and run this script again${NC}"
        echo -e "${BLUE}   Docker Desktop is required for Supabase local development${NC}"
        exit 1
    fi
fi

# Check and start local Supabase (DEV - port 6010)
echo -e "${BLUE}🗄️  Checking local Supabase status (Development - Port 6010)...${NC}"

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

is_langgraph_running() {
    if check_port 6200; then
        return 0
    else
        return 1
    fi
}

start_langgraph() {
    if is_langgraph_running; then
        echo -e "${GREEN}✅ LangGraph server already running on port 6200${NC}"
        return 0
    fi

    if [ ! -d "../langgraph" ]; then
        echo -e "${YELLOW}⚠️  LangGraph app directory not found at ../langgraph${NC}"
        return 1
    fi

    echo -e "${BLUE}🔄 Starting LangGraph workflow server...${NC}"

    # Build LangGraph first (from its directory)
    cd ../langgraph
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Installing LangGraph dependencies...${NC}"
        npm install >/dev/null 2>&1
    fi
    echo -e "${BLUE}📦 Building LangGraph...${NC}"
    npm run build >/dev/null 2>&1
    cd - > /dev/null

    # Run from monorepo root to properly resolve hoisted dependencies (e.g., opencascade.js)
    cd ../..
    node apps/langgraph/dist/main.js > /tmp/langgraph.log 2>&1 &
    LANGGRAPH_PID=$!
    cd - > /dev/null

    # Wait for it to start
    local count=0
    local max_attempts=10
    while [ $count -lt $max_attempts ]; do
        if check_port 6200; then
            echo -e "${GREEN}✅ LangGraph server running at http://localhost:6200${NC}"
            LANGGRAPH_STARTED_BY_SCRIPT=true
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done

    echo -e "${RED}❌ Failed to start LangGraph server${NC}"
    echo -e "${BLUE}💡 Check logs: tail -f /tmp/langgraph.log${NC}"
    return 1
}

# Check if Supabase is running on dev port 6010
if check_port 6010; then
    echo -e "${GREEN}✅ Local Supabase is already running on port 6010${NC}"
    echo -e "${BLUE}   Studio: http://127.0.0.1:6015${NC}"
    echo -e "${BLUE}   API: http://127.0.0.1:6010${NC}"
    echo -e "${BLUE}   Database: postgres://postgres:postgres@127.0.0.1:6012/postgres${NC}"

    # Remind about backup system if available
    if [ -f "supabase/backup-local-db.sh" ]; then
        echo -e "${BLUE}💡 Backup system available: ./supabase/backup-local-db.sh --list${NC}"
    fi
else
    echo -e "${BLUE}🚀 Starting local Supabase development instance on port 6010...${NC}"

    # Check if backup script exists and create a backup if Supabase has data
    if [ -f "supabase/backup-local-db.sh" ] && check_docker; then
        # Check if there are existing Docker volumes (indicating previous data)
        if docker volume ls | grep -q "supabase_db_api-dev"; then
            echo -e "${BLUE}💾 Creating safety backup before starting Supabase...${NC}"
            ./supabase/backup-local-db.sh --force > /dev/null 2>&1 || echo -e "${YELLOW}⚠️  Backup failed, but continuing...${NC}"
        fi
    fi

    # Start Supabase with development config
    echo -e "${BLUE}🔧 Starting Supabase with development configuration...${NC}"

    # Start Supabase (config.toml is already configured for dev on port 6010)
    supabase start
    SUPABASE_EXIT_CODE=$?
    if [ $SUPABASE_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ Local Supabase started successfully on port 6010${NC}"
        echo -e "${BLUE}   Studio: http://127.0.0.1:6015${NC}"
        echo -e "${BLUE}   API: http://127.0.0.1:6010${NC}"
        echo -e "${BLUE}   Database: postgres://postgres:postgres@127.0.0.1:6012/postgres${NC}"
        SUPABASE_STARTED_BY_SCRIPT=true

        # Remind about backup system
        if [ -f "supabase/backup-local-db.sh" ]; then
            echo -e "${BLUE}💡 Backup system available: ./supabase/backup-local-db.sh${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to start local Supabase on port 6010${NC}"
        echo -e "${BLUE}💡 This might be due to Docker not being ready yet${NC}"
        echo -e "${BLUE}💡 Try running: supabase start --config ./supabase/config.dev.toml${NC}"
        echo -e "${BLUE}💡 Or check Docker Desktop status and restart if needed${NC}"
        exit 1
    fi
fi

if ! start_langgraph; then
    echo -e "${YELLOW}⚠️  Continuing without local LangGraph server${NC}"
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${RED}🛑 Shutting down services...${NC}"

    # Kill the NestJS development server
    if [ ! -z "$NESTJS_PID" ]; then
        echo -e "${RED}📦 Stopping NestJS server...${NC}"
        kill $NESTJS_PID 2>/dev/null
        wait $NESTJS_PID 2>/dev/null
        echo -e "${GREEN}✅ NestJS server stopped${NC}"
    fi

    # Kill the LangGraph server
    if [ "$LANGGRAPH_STARTED_BY_SCRIPT" = true ] && [ ! -z "$LANGGRAPH_PID" ]; then
        echo -e "${RED}🔄 Stopping LangGraph server...${NC}"
        kill $LANGGRAPH_PID 2>/dev/null
        # Also kill any child processes on port 6200
        lsof -ti:6200 | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✅ LangGraph server stopped${NC}"
    fi

    echo -e "${GREEN}🏁 Cleanup complete${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Build transport-types if needed
echo -e "${BLUE}📦 Building transport-types...${NC}"
npm --prefix ../.. run build:transport-types
echo -e "${GREEN}✅ Transport-types built${NC}"

# Start NestJS development server in background
echo -e "${BLUE}🔥 Starting NestJS development server...${NC}"
npm run start:dev &
NESTJS_PID=$!

# Wait a moment for NestJS to start
sleep 2

echo -e "${GREEN}✅ Development environment ready!${NC}"
echo -e "${BLUE}📡 NestJS API: http://localhost:${API_PORT:-6100}${NC}"
if [ "$LANGGRAPH_STARTED_BY_SCRIPT" = true ]; then
    echo -e "${BLUE}🔄 LangGraph Workflows: http://localhost:6200${NC}"
fi
echo -e "\n${BLUE}Press Ctrl+C to stop all services${NC}"

# Wait for NestJS process to finish
wait $NESTJS_PID

# If we get here, NestJS exited normally
cleanup 
