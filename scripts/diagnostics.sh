#!/bin/bash

# Orchestrator AI Diagnostics Script
# Helps identify and diagnose setup issues

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Orchestrator AI Diagnostics${NC}"
echo -e "${BLUE}==============================${NC}"
echo ""

ISSUES=0
WARNINGS=0

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to report issue
report_issue() {
    echo -e "${RED}❌ $1${NC}"
    ISSUES=$((ISSUES + 1))
}

# Function to report warning
report_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# Function to report success
report_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Check prerequisites
echo -e "${BLUE}📋 Checking Prerequisites${NC}"
echo -e "${BLUE}-------------------------${NC}"

if command_exists node; then
    NODE_VERSION=$(node -v)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 20 ]; then
        report_success "Node.js: $NODE_VERSION"
    else
        report_issue "Node.js version 20+ required. Found: $NODE_VERSION"
    fi
else
    report_issue "Node.js not installed"
fi

if command_exists npm; then
    NPM_VERSION=$(npm -v)
    report_success "npm: $NPM_VERSION"
else
    report_issue "npm not installed"
fi

if command_exists docker; then
    DOCKER_VERSION=$(docker --version)
    report_success "Docker: $DOCKER_VERSION"
    
    # Check if Docker is running
    if docker info > /dev/null 2>&1; then
        report_success "Docker is running"
    else
        report_issue "Docker is installed but not running. Start Docker Desktop."
    fi
else
    report_warning "Docker not installed (optional for local dev, required for Docker Compose)"
fi

if command_exists supabase; then
    SUPABASE_VERSION=$(supabase --version 2>/dev/null || echo "installed")
    report_success "Supabase CLI: $SUPABASE_VERSION"
else
    report_warning "Supabase CLI not installed. Install with: npm install -g supabase"
fi

echo ""

# Check environment file
echo -e "${BLUE}📄 Checking Configuration${NC}"
echo -e "${BLUE}-------------------------${NC}"

if [ -f ".env" ]; then
    report_success ".env file exists"
    
    # Load environment variables
    set -a
    source .env 2>/dev/null || true
    set +a
    
    # Check critical variables
    if [ -z "$API_PORT" ]; then
        report_warning "API_PORT not set in .env (defaults to 6100)"
    else
        report_success "API_PORT: $API_PORT"
    fi
    
    if [ -z "$WEB_PORT" ]; then
        report_warning "WEB_PORT not set in .env (defaults to 7101)"
    else
        report_success "WEB_PORT: $WEB_PORT"
    fi
    
    if [ -z "$SUPABASE_URL" ]; then
        report_warning "SUPABASE_URL not set in .env"
    else
        report_success "SUPABASE_URL: $SUPABASE_URL"
    fi
    
    if [ -z "$OLLAMA_BASE_URL" ] && [ -z "$OLLAMA_CLOUD_API_KEY" ]; then
        report_warning "No Ollama configuration found (optional for local LLMs)"
    else
        if [ -n "$OLLAMA_BASE_URL" ]; then
            report_success "OLLAMA_BASE_URL: $OLLAMA_BASE_URL"
        fi
        if [ -n "$OLLAMA_CLOUD_API_KEY" ]; then
            report_success "Ollama Cloud configured"
        fi
    fi
    
    # Check for API keys (optional)
    if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ] && [ -z "$OLLAMA_CLOUD_API_KEY" ]; then
        report_warning "No LLM API keys configured (required for agent execution)"
    else
        if [ -n "$ANTHROPIC_API_KEY" ]; then
            report_success "ANTHROPIC_API_KEY configured"
        fi
        if [ -n "$OPENAI_API_KEY" ]; then
            report_success "OPENAI_API_KEY configured"
        fi
    fi
else
    report_issue ".env file not found. Run: cp dev.env.example .env"
fi

echo ""

# Check port availability
echo -e "${BLUE}🔌 Checking Port Availability${NC}"
echo -e "${BLUE}----------------------------${NC}"

check_port() {
    local port=$1
    local service=$2
    if lsof -ti:$port > /dev/null 2>&1; then
        local pid=$(lsof -ti:$port | head -1)
        report_warning "Port $port ($service) is in use by PID $pid"
    else
        report_success "Port $port ($service) is available"
    fi
}

check_port 6100 "API"
check_port 7101 "Web"
check_port 6010 "Supabase API"
check_port 6012 "Supabase DB"
check_port 6015 "Supabase Studio"
check_port 11434 "Ollama"

echo ""

# Check service connectivity
echo -e "${BLUE}🌐 Checking Service Connectivity${NC}"
echo -e "${BLUE}-------------------------------${NC}"

# Check Supabase
if curl -s http://127.0.0.1:6010/health > /dev/null 2>&1; then
    report_success "Supabase API is accessible"
else
    report_warning "Supabase API not accessible (may not be started)"
    echo -e "   ${YELLOW}Start with: cd apps/api && supabase start${NC}"
fi

# Check Ollama
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    report_success "Ollama is accessible"
    # List available models
    MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null | grep -o '"name":"[^"]*"' | head -3 | cut -d'"' -f4 || echo "")
    if [ -n "$MODELS" ]; then
        echo -e "   ${GREEN}Available models: $MODELS${NC}"
    fi
else
    report_warning "Ollama not accessible (optional - install from https://ollama.com)"
fi

# Check API server
if curl -s http://localhost:6100/health > /dev/null 2>&1; then
    report_success "API server is running"
else
    report_warning "API server not running"
    echo -e "   ${YELLOW}Start with: npm run dev:api${NC}"
fi

# Check Web server
if curl -s http://localhost:7101 > /dev/null 2>&1; then
    report_success "Web server is running"
else
    report_warning "Web server not running"
    echo -e "   ${YELLOW}Start with: npm run dev:web${NC}"
fi

echo ""

# Check database migrations
echo -e "${BLUE}🗄️  Checking Database${NC}"
echo -e "${BLUE}---------------------${NC}"

if command_exists supabase && [ -d "apps/api/supabase" ]; then
    cd apps/api
    if supabase status > /dev/null 2>&1; then
        report_success "Supabase is running"
        
        # Check if migrations are applied
        MIGRATION_COUNT=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
        if [ "$MIGRATION_COUNT" -gt 0 ]; then
            report_success "Found $MIGRATION_COUNT migration files"
        else
            report_warning "No migration files found"
        fi
        
        # Check if seed.sql exists
        if [ -f "supabase/seed.sql" ]; then
            report_success "seed.sql exists"
        else
            report_warning "seed.sql not found (demo data will not be loaded)"
        fi
    else
        report_warning "Supabase not running"
        echo -e "   ${YELLOW}Start with: supabase start${NC}"
    fi
    cd ../..
else
    report_warning "Cannot check database (Supabase CLI not available or not in apps/api directory)"
fi

echo ""

# Check project structure
echo -e "${BLUE}📁 Checking Project Structure${NC}"
echo -e "${BLUE}----------------------------${NC}"

if [ -d "apps/api" ]; then
    report_success "apps/api directory exists"
else
    report_issue "apps/api directory not found"
fi

if [ -d "apps/web" ]; then
    report_success "apps/web directory exists"
else
    report_issue "apps/web directory not found"
fi

if [ -d "apps/transport-types" ]; then
    report_success "apps/transport-types directory exists"
else
    report_issue "apps/transport-types directory not found"
fi

if [ -d "node_modules" ]; then
    report_success "node_modules exists (dependencies installed)"
else
    report_warning "node_modules not found. Run: npm install"
fi

echo ""

# Summary
echo -e "${BLUE}📊 Summary${NC}"
echo -e "${BLUE}---------${NC}"

if [ $ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Your setup looks good.${NC}"
elif [ $ISSUES -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Found $WARNINGS warning(s). Setup should work, but review warnings above.${NC}"
else
    echo -e "${RED}❌ Found $ISSUES issue(s) and $WARNINGS warning(s).${NC}"
    echo -e "${YELLOW}Please fix the issues above before proceeding.${NC}"
fi

echo ""
echo -e "${BLUE}💡 Quick Fixes${NC}"
echo -e "${BLUE}-------------${NC}"
echo -e "   Setup: ${GREEN}./scripts/setup.sh${NC}"
echo -e "   Student Quick-Start: ${GREEN}./scripts/setup-student.sh${NC}"
echo -e "   Start Dev: ${GREEN}./start-dev-local.sh${NC}"
echo -e "   Docker Compose: ${GREEN}npm run docker:student${NC}"
echo ""

exit $ISSUES
