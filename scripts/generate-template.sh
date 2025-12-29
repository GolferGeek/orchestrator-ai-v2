#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$MAIN_REPO_DIR/../orchestrator-ai-platform-template"

echo -e "${BLUE}📦 Generating GitHub template repository...${NC}"
echo -e "${BLUE}📍 Main repo: $MAIN_REPO_DIR${NC}"
echo -e "${BLUE}📍 Template: $TEMPLATE_DIR${NC}"

# 1. Create template directory
if [ -d "$TEMPLATE_DIR" ]; then
  echo -e "${YELLOW}⚠️  Template directory exists. Removing...${NC}"
  rm -rf "$TEMPLATE_DIR"
fi

mkdir -p "$TEMPLATE_DIR"
cd "$TEMPLATE_DIR"

# Initialize git repo
git init
git checkout -b main

# 2. Copy core framework files
echo -e "${BLUE}📋 Copying core framework...${NC}"
cp "$MAIN_REPO_DIR/package.json" .
cp "$MAIN_REPO_DIR/package-lock.json" . 2>/dev/null || true
cp "$MAIN_REPO_DIR/turbo.json" . 2>/dev/null || true
cp "$MAIN_REPO_DIR/.gitignore" .
cp "$MAIN_REPO_DIR/.npmrc" . 2>/dev/null || true

# 3. Copy apps (will filter later)
echo -e "${BLUE}📱 Copying apps...${NC}"
mkdir -p apps
cp -r "$MAIN_REPO_DIR/apps/api" apps/
cp -r "$MAIN_REPO_DIR/apps/web" apps/
cp -r "$MAIN_REPO_DIR/apps/langgraph" apps/
cp -r "$MAIN_REPO_DIR/apps/n8n" apps/
cp -r "$MAIN_REPO_DIR/apps/transport-types" apps/ 2>/dev/null || true

# 4. Filter out internal agents
echo -e "${BLUE}🔍 Filtering internal agents...${NC}"
find apps/langgraph/src/agents -type d -name "internal-*" -exec rm -rf {} + 2>/dev/null || true
find apps/api/src/agents -type d -name "internal-*" -exec rm -rf {} + 2>/dev/null || true

# Keep only example/template agents (remove others)
if [ -d "apps/langgraph/src/agents" ]; then
  find apps/langgraph/src/agents -mindepth 1 -maxdepth 1 -type d | while read dir; do
    dirname=$(basename "$dir")
    if [[ ! "$dirname" =~ ^(example-|template-|marketing-swarm) ]]; then
      echo "  Removing: $dirname"
      rm -rf "$dir"
    fi
  done
fi

# 5. Copy shared code
echo -e "${BLUE}🔗 Copying shared code...${NC}"
cp -r "$MAIN_REPO_DIR/shared" . 2>/dev/null || true

# 6. Copy deployment configs
echo -e "${BLUE}🚀 Copying deployment configs...${NC}"
mkdir -p deployment
if [ -d "$MAIN_REPO_DIR/deployment" ]; then
  cp -r "$MAIN_REPO_DIR/deployment"/* deployment/ 2>/dev/null || true
fi

# 7. Copy database snapshots (will clean later)
echo -e "${BLUE}💾 Copying database snapshots...${NC}"
mkdir -p apps/api/supabase/snapshots/latest
if [ -f "$MAIN_REPO_DIR/apps/api/supabase/snapshots/latest/schema.sql" ]; then
  cp "$MAIN_REPO_DIR/apps/api/supabase/snapshots/latest/schema.sql" apps/api/supabase/snapshots/latest/
fi

# Clean seed.sql (remove internal agents)
if [ -f "$MAIN_REPO_DIR/apps/api/supabase/snapshots/latest/seed.sql" ]; then
  echo -e "${BLUE}🧹 Cleaning seed.sql...${NC}"
  grep -v "internal-" "$MAIN_REPO_DIR/apps/api/supabase/snapshots/latest/seed.sql" > apps/api/supabase/snapshots/latest/seed.sql.tmp || true
  mv apps/api/supabase/snapshots/latest/seed.sql.tmp apps/api/supabase/snapshots/latest/seed.sql
fi

# Copy migrations
mkdir -p apps/api/supabase/migrations
if [ -d "$MAIN_REPO_DIR/apps/api/supabase/migrations" ]; then
  cp -r "$MAIN_REPO_DIR/apps/api/supabase/migrations"/* apps/api/supabase/migrations/ 2>/dev/null || true
fi

# 8. Copy example workflows
echo -e "${BLUE}🔄 Copying example workflows...${NC}"
mkdir -p apps/n8n/workflows/examples
if [ -d "$MAIN_REPO_DIR/apps/n8n/workflows/examples" ]; then
  cp -r "$MAIN_REPO_DIR/apps/n8n/workflows/examples"/* apps/n8n/workflows/examples/ 2>/dev/null || true
fi

# 9. Copy customer documentation
echo -e "${BLUE}📚 Copying customer documentation...${NC}"
mkdir -p docs
if [ -d "$MAIN_REPO_DIR/docs/customer" ]; then
  cp -r "$MAIN_REPO_DIR/docs/customer" docs/
fi
if [ -d "$MAIN_REPO_DIR/docs/api" ]; then
  cp -r "$MAIN_REPO_DIR/docs/api" docs/
fi

# 10. Create template README
echo -e "${BLUE}📝 Creating template README...${NC}"
cat > README.md << 'EOF'
# Orchestrator AI Platform

> AI agent platform for inside-the-firewall deployments

## Quick Start

```bash
# 1. Clone this repository
git clone <your-repo-url>
cd orchestrator-ai-platform

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 4. Start development environment
docker-compose -f docker-compose.dev.yml up -d

# 5. Access the platform
# API: http://localhost:9000
# Web: http://localhost:9001
# N8N: http://localhost:5678
```

## Documentation

- [Getting Started Guide](docs/customer/getting-started.md)
- [Development Guide](docs/customer/development.md)
- [Production Deployment](docs/customer/production.md)
- [API Documentation](docs/api/)

## Customization

### Adding LangGraph Agents

```bash
cd apps/langgraph/src/agents
mkdir my-custom-agent
# Create agent files using templates/agent-template.ts
```

### Creating N8N Workflows

Access N8N UI at http://localhost:5678 and create workflows.

### Customizing Front-End

Edit files in `apps/web/src/` - changes hot-reload automatically.

## Updates

To get framework updates:

```bash
git remote add upstream <template-repo-url>
git fetch upstream
git merge upstream/main
```

## License

[Your License]
EOF

# 11. Create .env.example
echo -e "${BLUE}⚙️  Creating .env.example...${NC}"
if [ -f "$MAIN_REPO_DIR/.env.example" ]; then
  cp "$MAIN_REPO_DIR/.env.example" .env.example
elif [ -f "$MAIN_REPO_DIR/dev.env.example" ]; then
  cp "$MAIN_REPO_DIR/dev.env.example" .env.example
fi

# Remove sensitive values (basic cleanup)
if [ -f .env.example ]; then
  sed -i '' 's/=.*/=/' .env.example 2>/dev/null || sed -i 's/=.*/=/' .env.example
fi

# 12. Copy docker-compose files if they exist
echo -e "${BLUE}🐳 Copying docker-compose files...${NC}"
if [ -f "$MAIN_REPO_DIR/docker-compose.dev.yml" ]; then
  cp "$MAIN_REPO_DIR/docker-compose.dev.yml" .
fi
if [ -f "$MAIN_REPO_DIR/docker-compose.prod.yml" ]; then
  cp "$MAIN_REPO_DIR/docker-compose.prod.yml" .
fi

# 13. Remove internal files
echo -e "${BLUE}🧹 Removing internal files...${NC}"
rm -rf obsidian/ .claude/ .cursor/ scripts/internal/ 2>/dev/null || true
find . -name ".env" -type f -delete 2>/dev/null || true
find . -name "*.log" -type f -delete 2>/dev/null || true
find . -name ".DS_Store" -type f -delete 2>/dev/null || true

# 14. Create .github/template-repository directory
echo -e "${BLUE}📋 Creating GitHub template config...${NC}"
mkdir -p .github/template-repository
cat > .github/template-repository/README.md << 'EOF'
# Template Repository Setup

This repository is a GitHub template. When customers use this template:

1. They create their own repository
2. They get a clean copy of the platform
3. They can customize agents, workflows, and front-end
4. They can get updates via git merge

## For Customers

See the main README.md for setup instructions.

## For Maintainers

To update this template, run:

```bash
./scripts/generate-template.sh
```

Then push to the template repository.
EOF

# 15. Commit template
echo -e "${BLUE}💾 Committing template...${NC}"
git add .
git commit -m "Initial template repository - $(date +%Y-%m-%d)" || echo "Nothing to commit"

echo -e "${GREEN}✅ Template generated successfully!${NC}"
echo -e "${GREEN}📁 Location: $TEMPLATE_DIR${NC}"
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "   1. Review the template: cd $TEMPLATE_DIR"
echo -e "   2. Push to GitHub: git remote add origin <template-repo-url> && git push -u origin main"
echo -e "   3. Enable 'Template repository' in GitHub repository settings"

