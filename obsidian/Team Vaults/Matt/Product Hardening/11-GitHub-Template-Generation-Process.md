# GitHub Template Generation Process

## Overview

**Goal:** Create and maintain a GitHub template repository that contains a clean subset of the main codebase, suitable for customer distribution.

**Process:**
1. **Generate Template** - Extract customer-relevant subset from main repo
2. **Filter Content** - Remove internal agents, workflows, and sensitive data
3. **Clean Migrations** - Create customer-ready database snapshots
4. **Update Template** - Keep template in sync with main repo

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Main Repository (orchestrator-ai-v2)           │
│                                                              │
│  • All agents (internal + customer examples)                │
│  • All workflows (internal + customer examples)              │
│  • Full development history                                  │
│  • Internal tools and scripts                                │
│  • Complete database snapshots                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ generate-template.sh
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         Template Repository (orchestrator-ai-platform)       │
│                                                              │
│  • Customer-relevant agents only                             │
│  • Example workflows only                                    │
│  • Clean database snapshots                                  │
│  • Customer documentation                                    │
│  • No internal tools                                         │
│  • No sensitive data                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Customers use template
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Customer Repository (customer-name-platform)       │
│                                                              │
│  • Template code + customer customizations                  │
│  • Customer's own agents                                     │
│  • Customer's own workflows                                  │
│  • Customer's database                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## What Goes in the Template

### ✅ Include (Customer-Relevant)

**Core Framework:**
- `apps/api/` - API framework (filtered)
- `apps/web/` - Front-end framework (filtered)
- `apps/langgraph/` - LangGraph framework + example agents
- `apps/n8n/` - N8N setup + example workflows
- `shared/` - Shared code and contracts
- `deployment/` - Docker and deployment configs

**Example Agents:**
- `apps/langgraph/src/agents/example-*/` - Example LangGraph agents
- `apps/api/src/agents/example-*/` - Example API agents
- Agent templates and scaffolding

**Example Workflows:**
- `apps/n8n/workflows/examples/` - Example N8N workflows
- Workflow templates

**Database:**
- Clean schema snapshots (no internal data)
- Seed data (example agents, providers, models)
- Migration files (customer-ready)

**Documentation:**
- `README.md` - Customer onboarding guide
- `docs/customer/` - Customer documentation
- `docs/api/` - API documentation
- Setup guides

**Configuration:**
- `.env.example` - Environment variable templates
- `docker-compose.dev.yml` - Development setup
- `docker-compose.prod.yml` - Production setup
- `package.json` - Dependencies

### ❌ Exclude (Internal Only)

**Internal Agents:**
- `apps/langgraph/src/agents/internal-*/` - Internal agents
- `apps/api/src/agents/internal-*/` - Internal agents
- Customer-specific agents (if any)

**Internal Workflows:**
- `apps/n8n/workflows/internal/` - Internal workflows
- Customer-specific workflows

**Internal Tools:**
- `scripts/internal/` - Internal development scripts
- `obsidian/` - Internal documentation
- `.claude/` - Internal Claude Code configs
- `.cursor/` - Internal Cursor configs

**Sensitive Data:**
- `.env` files (use `.env.example` instead)
- API keys and secrets
- Customer-specific data
- Internal database snapshots

**Development History:**
- `.git/` - Start fresh (or filtered history)
- Internal commit history (optional)

---

## Template Generation Script

### Main Script: `scripts/generate-template.sh`

```bash
#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

TEMPLATE_DIR="../orchestrator-ai-platform-template"
MAIN_REPO_DIR="$(pwd)"

echo -e "${BLUE}📦 Generating GitHub template repository...${NC}"

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
cp -r "$MAIN_REPO_DIR/package.json" .
cp -r "$MAIN_REPO_DIR/package-lock.json" .
cp -r "$MAIN_REPO_DIR/turbo.json" .
cp -r "$MAIN_REPO_DIR/.gitignore" .

# 3. Copy apps (filtered)
echo -e "${BLUE}📱 Copying apps (filtered)...${NC}"
mkdir -p apps
cp -r "$MAIN_REPO_DIR/apps/api" apps/
cp -r "$MAIN_REPO_DIR/apps/web" apps/
cp -r "$MAIN_REPO_DIR/apps/langgraph" apps/
cp -r "$MAIN_REPO_DIR/apps/n8n" apps/
cp -r "$MAIN_REPO_DIR/apps/transport-types" apps/

# Filter out internal agents
find apps/langgraph/src/agents -type d -name "internal-*" -exec rm -rf {} + 2>/dev/null || true
find apps/api/src/agents -type d -name "internal-*" -exec rm -rf {} + 2>/dev/null || true

# Keep only example agents
find apps/langgraph/src/agents -mindepth 1 -maxdepth 1 -type d ! -name "example-*" ! -name "marketing-swarm" -exec rm -rf {} + 2>/dev/null || true

# 4. Copy shared code
echo -e "${BLUE}🔗 Copying shared code...${NC}"
cp -r "$MAIN_REPO_DIR/shared" .

# 5. Copy deployment configs
echo -e "${BLUE}🚀 Copying deployment configs...${NC}"
mkdir -p deployment
cp -r "$MAIN_REPO_DIR/deployment"/* deployment/ 2>/dev/null || true

# 6. Copy database snapshots (cleaned)
echo -e "${BLUE}💾 Copying database snapshots (cleaned)...${NC}"
mkdir -p apps/api/supabase/snapshots/latest
cp "$MAIN_REPO_DIR/apps/api/supabase/snapshots/latest/schema.sql" apps/api/supabase/snapshots/latest/ 2>/dev/null || true

# Clean seed data (remove internal agents)
if [ -f "$MAIN_REPO_DIR/apps/api/supabase/snapshots/latest/seed.sql" ]; then
  # Filter seed.sql to remove internal agents
  grep -v "internal-" "$MAIN_REPO_DIR/apps/api/supabase/snapshots/latest/seed.sql" > apps/api/supabase/snapshots/latest/seed.sql || true
fi

# 7. Copy migrations (filtered)
echo -e "${BLUE}📝 Copying migrations...${NC}"
mkdir -p apps/api/supabase/migrations
cp -r "$MAIN_REPO_DIR/apps/api/supabase/migrations"/* apps/api/supabase/migrations/ 2>/dev/null || true

# 8. Copy example workflows
echo -e "${BLUE}🔄 Copying example workflows...${NC}"
mkdir -p apps/n8n/workflows/examples
if [ -d "$MAIN_REPO_DIR/apps/n8n/workflows/examples" ]; then
  cp -r "$MAIN_REPO_DIR/apps/n8n/workflows/examples"/* apps/n8n/workflows/examples/
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
else
  cp "$MAIN_REPO_DIR/dev.env.example" .env.example
fi

# Remove sensitive values
sed -i '' 's/=.*/=/' .env.example 2>/dev/null || sed -i 's/=.*/=/' .env.example

# 12. Create docker-compose files
echo -e "${BLUE}🐳 Creating docker-compose files...${NC}"
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
git commit -m "Initial template repository" || echo "Nothing to commit"

echo -e "${GREEN}✅ Template generated successfully!${NC}"
echo -e "${GREEN}📁 Location: $TEMPLATE_DIR${NC}"
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "   1. Review the template: cd $TEMPLATE_DIR"
echo -e "   2. Push to GitHub: git remote add origin <template-repo-url>"
echo -e "   3. Enable 'Template repository' in GitHub settings"
```

---

## Agent/Workflow Filtering

### Filter Configuration: `scripts/template-filters.json`

```json
{
  "include": {
    "agents": [
      "example-*",
      "marketing-swarm",
      "blog-post-writer",
      "requirements-writer"
    ],
    "workflows": [
      "examples/*",
      "templates/*"
    ],
    "directories": [
      "apps/api/src/core",
      "apps/web/src/core",
      "shared",
      "deployment"
    ]
  },
  "exclude": {
    "agents": [
      "internal-*",
      "customer-specific-*",
      "test-*"
    ],
    "workflows": [
      "internal/*",
      "customer-specific/*"
    ],
    "directories": [
      "obsidian",
      ".claude",
      ".cursor",
      "scripts/internal"
    ],
    "files": [
      ".env",
      "*.log",
      "*.tmp"
    ]
  },
  "database": {
    "includeSchemas": ["public", "n8n"],
    "excludeTables": [
      "internal_*",
      "customer_specific_*"
    ],
    "seedData": {
      "includeAgents": ["example-*"],
      "excludeAgents": ["internal-*"]
    }
  }
}
```

### Filter Script: `scripts/filter-template-content.sh`

```bash
#!/bin/bash
# Filters template content based on template-filters.json

FILTER_CONFIG="scripts/template-filters.json"
TEMPLATE_DIR="$1"

if [ ! -f "$FILTER_CONFIG" ]; then
  echo "Error: Filter config not found: $FILTER_CONFIG"
  exit 1
fi

# Read filter config
INCLUDE_AGENTS=$(jq -r '.include.agents[]' "$FILTER_CONFIG" | tr '\n' '|')
EXCLUDE_AGENTS=$(jq -r '.exclude.agents[]' "$FILTER_CONFIG" | tr '\n' '|')

# Filter agents
find "$TEMPLATE_DIR/apps/langgraph/src/agents" -type d | while read dir; do
  dirname=$(basename "$dir")
  if [[ ! "$dirname" =~ ^($INCLUDE_AGENTS)$ ]]; then
    if [[ "$dirname" =~ ^($EXCLUDE_AGENTS)$ ]]; then
      echo "Removing: $dir"
      rm -rf "$dir"
    fi
  fi
done

# Similar filtering for workflows, etc.
```

---

## Database Snapshot Cleanup

### Clean Snapshot Script: `scripts/clean-template-snapshot.sh`

```bash
#!/bin/bash
set -e

SNAPSHOT_DIR="apps/api/supabase/snapshots/latest"
TEMPLATE_SNAPSHOT_DIR="../orchestrator-ai-platform-template/apps/api/supabase/snapshots/latest"

echo "🧹 Cleaning database snapshot for template..."

# 1. Copy schema.sql (no changes needed - it's structure only)
cp "$SNAPSHOT_DIR/schema.sql" "$TEMPLATE_SNAPSHOT_DIR/schema.sql"

# 2. Clean seed.sql (remove internal agents)
if [ -f "$SNAPSHOT_DIR/seed.sql" ]; then
  # Remove INSERT statements for internal agents
  grep -v "INSERT INTO.*agents.*VALUES.*'internal-" "$SNAPSHOT_DIR/seed.sql" > "$TEMPLATE_SNAPSHOT_DIR/seed.sql.tmp"
  
  # Remove internal workflow data
  grep -v "INSERT INTO.*workflows.*VALUES.*'internal-" "$TEMPLATE_SNAPSHOT_DIR/seed.sql.tmp" > "$TEMPLATE_SNAPSHOT_DIR/seed.sql"
  
  rm "$TEMPLATE_SNAPSHOT_DIR/seed.sql.tmp"
  
  echo "✅ Cleaned seed.sql"
fi

# 3. Create metadata.json
cat > "$TEMPLATE_SNAPSHOT_DIR/metadata.json" << EOF
{
  "version": "1.0.0",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "description": "Customer-ready database snapshot",
  "includes": {
    "schemas": ["public", "n8n"],
    "exampleAgents": true,
    "exampleWorkflows": true
  },
  "excludes": {
    "internalAgents": true,
    "internalWorkflows": true,
    "customerData": true
  }
}
EOF

echo "✅ Snapshot cleaned and ready for template"
```

---

## Update Process

### Update Template Script: `scripts/update-template.sh`

```bash
#!/bin/bash
set -e

TEMPLATE_DIR="../orchestrator-ai-platform-template"
MAIN_REPO_DIR="$(pwd)"

echo "🔄 Updating template repository..."

# 1. Generate fresh template
./scripts/generate-template.sh

# 2. Check for changes
cd "$TEMPLATE_DIR"
if [ -n "$(git status --porcelain)" ]; then
  echo "📝 Changes detected, committing..."
  git add .
  git commit -m "Update template from main repo $(date +%Y-%m-%d)"
  
  # 3. Push to GitHub (if remote exists)
  if git remote | grep -q origin; then
    echo "🚀 Pushing to GitHub..."
    git push origin main
  else
    echo "⚠️  No remote configured. Set up GitHub remote:"
    echo "   git remote add origin <template-repo-url>"
  fi
else
  echo "✅ No changes detected"
fi

echo "✅ Template update complete"
```

---

## Automation

### GitHub Actions: `.github/workflows/update-template.yml`

```yaml
name: Update Template Repository

on:
  push:
    branches:
      - main
    paths:
      - 'apps/**'
      - 'shared/**'
      - 'deployment/**'
      - 'docs/customer/**'
  workflow_dispatch:

jobs:
  update-template:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Generate Template
        run: |
          chmod +x scripts/generate-template.sh
          ./scripts/generate-template.sh
      
      - name: Push to Template Repo
        env:
          GITHUB_TOKEN: ${{ secrets.TEMPLATE_REPO_TOKEN }}
        run: |
          cd ../orchestrator-ai-platform-template
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .
          git commit -m "Auto-update template from main repo" || exit 0
          git push https://$GITHUB_TOKEN@github.com/orchestrator-ai/orchestrator-ai-platform-template.git main
```

---

## Customer Update Workflow

### Customer Gets Updates

```bash
# Customer adds upstream remote (one-time)
git remote add upstream https://github.com/orchestrator-ai/orchestrator-ai-platform-template.git

# Get updates
git fetch upstream
git checkout main
git merge upstream/main

# Resolve conflicts (if any)
# - Framework code: Usually accept upstream
# - Customer agents: Keep customer version
# - Customer workflows: Keep customer version

# Test locally
docker-compose -f docker-compose.dev.yml restart

# Deploy to production
git checkout production
git merge main
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

---

## File Structure Comparison

### Main Repo Structure
```
orchestrator-ai-v2/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── agents/
│   │   │   │   ├── internal-marketing/      ❌ Exclude
│   │   │   │   ├── customer-acme/          ❌ Exclude
│   │   │   │   └── example-blog-writer/    ✅ Include
│   │   │   └── core/                        ✅ Include
│   │   └── supabase/
│   │       └── snapshots/
│   │           └── latest/
│   │               ├── schema.sql           ✅ Include (cleaned)
│   │               └── seed.sql             ✅ Include (filtered)
│   ├── langgraph/
│   │   └── src/agents/
│   │       ├── internal-swarm/             ❌ Exclude
│   │       └── example-agents/              ✅ Include
│   └── n8n/
│       └── workflows/
│           ├── internal/                    ❌ Exclude
│           └── examples/                    ✅ Include
├── obsidian/                                ❌ Exclude
├── .claude/                                 ❌ Exclude
├── scripts/
│   ├── internal/                            ❌ Exclude
│   └── generate-template.sh                 ✅ Include
└── docs/
    ├── customer/                            ✅ Include
    └── internal/                            ❌ Exclude
```

### Template Repo Structure
```
orchestrator-ai-platform-template/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── agents/
│   │   │   │   └── example-blog-writer/    ✅ Only examples
│   │   │   └── core/                        ✅ Framework only
│   │   └── supabase/
│   │       └── snapshots/
│   │           └── latest/
│   │               ├── schema.sql           ✅ Clean schema
│   │               └── seed.sql             ✅ Example data only
│   ├── langgraph/
│   │   └── src/agents/
│   │       └── example-agents/              ✅ Only examples
│   └── n8n/
│       └── workflows/
│           └── examples/                    ✅ Only examples
├── scripts/
│   └── generate-template.sh                 ✅ (if needed)
└── docs/
    └── customer/                            ✅ Customer docs only
```

---

## Implementation Checklist

### Phase 1: Initial Template Creation (1 week with AI)

- [ ] Create `scripts/generate-template.sh`
- [ ] Create `scripts/template-filters.json`
- [ ] Create `scripts/clean-template-snapshot.sh`
- [ ] Test template generation
- [ ] Create template repository on GitHub
- [ ] Enable "Template repository" in GitHub settings
- [ ] Push initial template
- [ ] **AI Time:** 3-4 days

### Phase 2: Update Automation (1 week with AI)

- [ ] Create `scripts/update-template.sh`
- [ ] Set up GitHub Actions workflow
- [ ] Test automated updates
- [ ] Document update process
- [ ] **AI Time:** 2-3 days

### Phase 3: Customer Documentation (1 week with AI)

- [ ] Create customer onboarding guide
- [ ] Create update/merge guide
- [ ] Create customization examples
- [ ] Create troubleshooting guide
- [ ] **AI Time:** 2-3 days

**Total:** 3 weeks (with AI) | 1 week human oversight

---

## Quick Reference

### Generate Template
```bash
./scripts/generate-template.sh
```

### Update Template
```bash
./scripts/update-template.sh
```

### Clean Snapshot
```bash
./scripts/clean-template-snapshot.sh
```

### Manual Update (if needed)
```bash
cd ../orchestrator-ai-platform-template
git pull origin main
# Review changes
git push origin main
```

---

## Summary

**Process:**
1. **Generate** - Extract customer subset from main repo
2. **Filter** - Remove internal content, keep examples
3. **Clean** - Create customer-ready database snapshots
4. **Update** - Keep template in sync with main repo

**Key Points:**
- Template contains only customer-relevant content
- Internal agents/workflows excluded
- Database snapshots cleaned (no internal data)
- Automated updates via GitHub Actions
- Customers merge updates via standard git workflow

This gives you a clean, maintainable template repository that stays in sync with your main codebase!

