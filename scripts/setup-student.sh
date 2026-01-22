#!/bin/bash

# Orchestrator AI Student Quick-Start Setup Script
# Simplified setup for students using Docker Compose

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎓 Orchestrator AI Student Quick-Start${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

MISSING_DEPS=()

if ! command -v docker >/dev/null 2>&1; then
    MISSING_DEPS+=("Docker - Install from https://www.docker.com/get-started")
fi

if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
    MISSING_DEPS+=("Docker Compose - Usually included with Docker Desktop")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing prerequisites:${NC}"
    for dep in "${MISSING_DEPS[@]}"; do
        echo -e "   - $dep"
    done
    echo ""
    echo -e "${YELLOW}Please install missing dependencies and run this script again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Create minimal .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${BLUE}📝 Creating minimal .env file...${NC}"
    cat > .env << 'EOF'
# Student Quick-Start Configuration
API_PORT=6100
WEB_PORT=7101

# Supabase (managed by Docker Compose)
SUPABASE_URL=http://127.0.0.1:6010
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Ollama (managed by Docker Compose)
OLLAMA_BASE_URL=http://localhost:11434

# Optional: Add API keys for cloud models if desired
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
EOF
    echo -e "${GREEN}✅ Created .env file${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Start services with Docker Compose
echo -e "${BLUE}🐳 Starting services with Docker Compose (student mode)...${NC}"
echo -e "${YELLOW}This will:${NC}"
echo -e "   - Start Supabase with demo data"
echo -e "   - Start Ollama with a lightweight model"
echo -e "   - Start API and Web servers"
echo -e "${YELLOW}This may take 2-3 minutes on first run...${NC}"
echo ""

# Use docker compose (newer) or docker-compose (older)
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

$COMPOSE_CMD -f docker-compose.student.yml up -d

echo ""
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Wait for services to be healthy
echo -e "${BLUE}🔍 Checking service health...${NC}"

MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://127.0.0.1:6010/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Supabase is ready${NC}"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo -e "${YELLOW}   Waiting for Supabase... (${ATTEMPT}/${MAX_ATTEMPTS})${NC}"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ Supabase failed to start. Check logs with:${NC}"
    echo -e "   ${GREEN}$COMPOSE_CMD -f docker-compose.student.yml logs supabase${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}📧 Demo Credentials:${NC}"
echo -e "   Email: ${GREEN}demo.user@orchestratorai.io${NC}"
echo -e "   Password: ${GREEN}DemoUser123!${NC}"
echo ""
echo -e "${BLUE}🌐 Access Points:${NC}"
echo -e "   Web App: ${GREEN}http://localhost:7101${NC}"
echo -e "   API: ${GREEN}http://localhost:6100${NC}"
echo -e "   Supabase Studio: ${GREEN}http://127.0.0.1:6015${NC}"
echo -e "   Email Testing: ${GREEN}http://127.0.0.1:6016${NC}"
echo ""
echo -e "${BLUE}📚 Next Steps:${NC}"
echo -e "   1. Open http://localhost:7101 in your browser"
echo -e "   2. Log in with the demo credentials above"
echo -e "   3. Explore the demo agents"
echo -e "   4. Check out docs/QUICK_START_STUDENTS.md for tutorials"
echo ""
echo -e "${BLUE}🛠️  Useful Commands:${NC}"
echo -e "   View logs: ${GREEN}$COMPOSE_CMD -f docker-compose.student.yml logs -f${NC}"
echo -e "   Stop services: ${GREEN}$COMPOSE_CMD -f docker-compose.student.yml down${NC}"
echo -e "   Restart: ${GREEN}$COMPOSE_CMD -f docker-compose.student.yml restart${NC}"
echo ""
