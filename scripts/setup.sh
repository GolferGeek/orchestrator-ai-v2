#!/bin/bash

# Orchestrator AI Setup Script
# Automates initial setup and configuration

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Orchestrator AI Setup${NC}"
echo -e "${BLUE}========================${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

MISSING_DEPS=()

if ! command_exists node; then
    MISSING_DEPS+=("Node.js (v20+)")
fi

if ! command_exists npm; then
    MISSING_DEPS+=("npm")
fi

if ! command_exists docker; then
    MISSING_DEPS+=("Docker")
fi

if ! command_exists supabase; then
    MISSING_DEPS+=("Supabase CLI - Install with: npm install -g supabase")
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

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js version 20+ required. Current: $(node -v)${NC}"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${BLUE}📝 Creating .env file from dev.env.example...${NC}"
    if [ -f "dev.env.example" ]; then
        cp dev.env.example .env
        echo -e "${GREEN}✅ Created .env file${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env and add your API keys (ANTHROPIC_API_KEY, etc.)${NC}"
    else
        echo -e "${RED}❌ dev.env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Load environment variables
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Build transport types
echo -e "${BLUE}🔨 Building shared transport types...${NC}"
npm run build:transport-types
echo -e "${GREEN}✅ Transport types built${NC}"
echo ""

# Start Supabase
echo -e "${BLUE}🗄️  Starting Supabase...${NC}"
cd apps/api
if supabase status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Supabase is already running${NC}"
else
    echo -e "${BLUE}Starting Supabase (this may take a minute)...${NC}"
    supabase start
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Supabase started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to start Supabase${NC}"
        exit 1
    fi
fi
cd ../..
echo ""

# Check if seed data should be loaded
if [ "$1" == "--with-seed" ] || [ "$1" == "--seed" ]; then
    echo -e "${BLUE}🌱 Seeding database with demo data...${NC}"
    cd apps/api
    supabase db reset --with-seed
    cd ../..
    echo -e "${GREEN}✅ Database seeded${NC}"
    echo ""
    echo -e "${GREEN}📧 Demo Credentials:${NC}"
    echo -e "   Email: ${GREEN}demo.user@orchestratorai.io${NC}"
    echo -e "   Password: ${GREEN}DemoUser123!${NC}"
    echo ""
fi

# Verify setup
echo -e "${BLUE}🔍 Verifying setup...${NC}"

# Check Supabase
if curl -s http://127.0.0.1:6010/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Supabase is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Supabase health check failed (may still be starting)${NC}"
fi

# Check Ollama (optional)
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Ollama not running (optional - install from https://ollama.com)${NC}"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "   1. Edit .env file and add your API keys"
echo -e "   2. Start development servers: ${GREEN}npm run dev${NC}"
echo -e "   3. Or use Docker Compose: ${GREEN}npm run docker:up${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo -e "   - Start dev: ${GREEN}./start-dev-local.sh${NC}"
echo -e "   - Supabase Studio: ${GREEN}http://127.0.0.1:6015${NC}"
echo -e "   - API Health: ${GREEN}http://localhost:6100/health${NC}"
echo ""
