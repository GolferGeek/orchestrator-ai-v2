#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Preparing production package for customer deployment...${NC}"

# Create deployment directory
mkdir -p deployment/production-snapshot
mkdir -p deployment/production-agents
mkdir -p deployment/production-n8n

# 1. Build production assets
echo -e "${BLUE}🔨 Building production assets...${NC}"
npm run production:build || {
  echo -e "${RED}❌ Failed to build production assets${NC}"
  exit 1
}

# 2. Export database snapshot
echo -e "${BLUE}📤 Exporting database snapshot...${NC}"
npm run db:export-snapshot || {
  echo -e "${RED}❌ Failed to export snapshot${NC}"
  exit 1
}

# Copy snapshot files
if [ -d "storage/snapshots/latest" ]; then
  cp storage/snapshots/latest/* deployment/production-snapshot/ 2>/dev/null || true
  echo -e "${GREEN}✅ Snapshot files copied${NC}"
else
  echo -e "${YELLOW}⚠️  No snapshot files found${NC}"
fi

# 3. Export agents
echo -e "${BLUE}📦 Exporting agents...${NC}"
npm run db:export-all-agents || echo -e "${YELLOW}⚠️  No agents to export${NC}"

if [ -d "storage/snapshots/agents" ]; then
  cp storage/snapshots/agents/* deployment/production-agents/ 2>/dev/null || true
  echo -e "${GREEN}✅ Agent files copied${NC}"
fi

# 4. Export N8N workflows
echo -e "${BLUE}📦 Exporting N8N workflows...${NC}"
npm run db:export-all-n8n || echo -e "${YELLOW}⚠️  No N8N workflows to export${NC}"

if [ -d "storage/snapshots/n8n" ]; then
  cp storage/snapshots/n8n/* deployment/production-n8n/ 2>/dev/null || true
  echo -e "${GREEN}✅ N8N workflow files copied${NC}"
fi

# 5. Create deployment README
echo -e "${BLUE}📝 Creating deployment README...${NC}"
cat > deployment/README.md << 'EOF'
# Production Deployment Guide

## Quick Start

### 1. Configure Environment

```bash
cp .env.production.example .env.production
# Edit .env.production with your Supabase credentials
```

### 2. Apply Database Snapshot

```bash
# Copy snapshot files to storage/snapshots/latest/
cp deployment/production-snapshot/* storage/snapshots/latest/

# Apply snapshot
npm run db:apply-snapshot
```

### 3. Import Agents and Workflows

```bash
# Copy agents to storage/snapshots/agents/
cp deployment/production-agents/* storage/snapshots/agents/

# Copy N8N workflows to storage/snapshots/n8n/
cp deployment/production-n8n/* storage/snapshots/n8n/

# Import
npm run db:import-all-agents
npm run db:import-all-n8n
```

### 4. Start Production

```bash
npm run production
```

## Access

- **API**: http://localhost:9000
- **Web**: http://localhost:9001
- **Supabase Studio**: <your-supabase-studio-url>

## Environment Variables

Required variables in `.env.production`:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `API_PORT` - API server port (default: 9000)
- `WEB_PORT` - Web server port (default: 9001)
- `NODE_ENV` - Set to "production"

## Troubleshooting

- **Database connection issues**: Verify Supabase credentials
- **Port conflicts**: Change `API_PORT` and `WEB_PORT` in `.env.production`
- **Build errors**: Run `npm install` and `npm run build` again
EOF

echo -e "${GREEN}✅ Production package ready!${NC}"
echo -e "${GREEN}📁 Package location: deployment/${NC}"
echo -e "${BLUE}💡 Share this directory with customers for deployment${NC}"

