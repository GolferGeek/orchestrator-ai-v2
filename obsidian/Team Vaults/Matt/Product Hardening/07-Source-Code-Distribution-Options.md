# Source Code Distribution Options
## How Customers Get, Customize, and Deploy the Platform

**Date:** 2025-01-27  
**Target:** Small-to-Mid-Sized Companies (Inside the Firewall)  
**Key Requirement:** Customers need full source code access to customize agents, framework, and front-end

---

## The Challenge

Customers need:
1. ✅ **Full source code access** - See entire codebase
2. ✅ **Local development** - Develop on their machines (hot reload, debugging)
3. ✅ **Production deployment** - Docker on actual servers
4. ✅ **Customization** - Add agents, modify framework, customize front-end
5. ✅ **Updates** - Get framework updates while preserving customizations

---

## Distribution Options Analysis

### Option 1: GitHub Template Repository ⭐ **RECOMMENDED**

**How It Works:**
- Create public/private GitHub template repository
- Customers click "Use this template" → Creates their own repo
- They own the repository completely
- Full git history, version control, branching

**Pros:**
- ✅ Standard GitHub workflow (customers familiar)
- ✅ Full git history and version control
- ✅ Easy to fork/clone
- ✅ Customers own their code completely
- ✅ Can make private repos for customers
- ✅ Updates via git pull/merge (standard workflow)
- ✅ Can track customer repos (if they grant access)

**Cons:**
- ⚠️ Need to handle merge conflicts on updates
- ⚠️ Customers see all code (may be concern for proprietary code)
- ⚠️ Need to manage template updates

**Implementation:**
```bash
# Customer workflow:
1. Go to https://github.com/orchestrator-ai/orchestrator-ai-platform
2. Click "Use this template"
3. Create new private repo: "acme-corp-orchestrator"
4. Clone locally: git clone git@github.com:acme-corp/orchestrator-ai-platform.git
5. npm install
6. docker-compose -f docker-compose.dev.yml up -d  # Local dev
7. docker-compose -f docker-compose.prod.yml up -d  # Production
```

**Update Process:**
```bash
# Customer gets updates:
git remote add upstream https://github.com/orchestrator-ai/orchestrator-ai-platform.git
git fetch upstream
git merge upstream/main  # Merge framework updates
# Resolve conflicts in their customizations
```

**Best For:**
- ✅ Most customers (standard workflow)
- ✅ Customers comfortable with git
- ✅ When you want to track customer usage

---

### Option 2: Private Git Repository Per Customer

**How It Works:**
- Create private repository for each customer
- Grant them access
- They clone and customize
- Updates via git pull

**Pros:**
- ✅ Full control over access
- ✅ Can revoke access if needed
- ✅ Private by default
- ✅ Can see what customers are doing (if they grant access)
- ✅ Standard git workflow

**Cons:**
- ❌ Managing many private repos (scaling issue)
- ❌ Need to push updates to each repo individually
- ❌ More complex for you to maintain

**Implementation:**
```bash
# Your workflow (per customer):
1. Create private repo: orchestrator-ai-acme-corp
2. Grant customer access
3. Customer clones: git clone git@github.com:orchestrator-ai/orchestrator-ai-acme-corp.git
4. Customer customizes
5. You push updates: git push origin main (to their repo)
```

**Best For:**
- ✅ Enterprise customers (high-touch)
- ✅ When you need strict access control
- ✅ Small number of customers

---

### Option 3: Tarball/Download Distribution

**How It Works:**
- Package source code as tarball (`.tar.gz`)
- Customers download from release server
- Extract and customize
- Updates via new tarball download

**Pros:**
- ✅ Simple (no git needed)
- ✅ Works for customers without git knowledge
- ✅ Can include/exclude specific files
- ✅ Easy to version (v1.0.0.tar.gz)

**Cons:**
- ❌ No version control (customers lose git history)
- ❌ Updates harder (manual merge of changes)
- ❌ No easy way to track customer customizations
- ❌ Customers can't easily contribute back

**Implementation:**
```bash
# Customer workflow:
1. Download: wget https://releases.orchestratorai.io/v1.0.0/orchestrator-ai-v1.0.0.tar.gz
2. Extract: tar -xzf orchestrator-ai-v1.0.0.tar.gz
3. Customize code
4. Deploy

# Updates:
1. Download new version: orchestrator-ai-v1.1.0.tar.gz
2. Extract to new directory
3. Manually merge customizations (difficult!)
```

**Best For:**
- ✅ Customers who don't use git
- ✅ One-time deployments (no updates expected)
- ✅ Simple use cases

---

### Option 4: Git Fork (Public Repository)

**How It Works:**
- Public repository (or private with customer access)
- Customers fork the repository
- They customize in their fork
- Updates via upstream sync

**Pros:**
- ✅ Standard open-source workflow
- ✅ Easy for customers familiar with GitHub
- ✅ Can contribute back (if desired)
- ✅ Full git history

**Cons:**
- ⚠️ Public repo exposes all code (if public)
- ⚠️ Fork relationship visible (may not want this)
- ⚠️ Updates require upstream sync

**Best For:**
- ✅ Open-source model (if you go that route)
- ✅ Educational/training use cases
- ✅ When you want community contributions

---

## Recommended Approach: Hybrid Model

### Primary: GitHub Template Repository (Private)

**For Most Customers:**
- Private GitHub template repository
- Customers create their own repo from template
- Standard git workflow
- Updates via upstream merge

**Why This Works Best:**
- ✅ Customers own their code
- ✅ Standard workflow (familiar to developers)
- ✅ Full version control
- ✅ Easy updates (git merge)
- ✅ You can track usage (if they grant access)

### Secondary: Private Repo Per Customer (Enterprise)

**For Enterprise/High-Value Customers:**
- Dedicated private repository
- You manage updates directly
- Higher-touch relationship

---

## Development vs Production Workflow

### Local Development (Customer's Machine)

**Purpose:** Develop agents, customize code, test changes

**Setup:**
```bash
# Clone repository
git clone git@github.com:customer/orchestrator-ai-platform.git
cd orchestrator-ai-platform

# Install dependencies
npm install

# Configure environment
cp .env.template .env
# Edit .env with local settings

# Start development environment
docker-compose -f docker-compose.dev.yml up -d
```

**Development Mode Features:**
- ✅ Hot reload (changes reflect immediately)
- ✅ Source code mounted as volumes
- ✅ Full debugging support
- ✅ Fast iteration cycle
- ✅ Runs on localhost (ports 9000, 9001, 6200, etc.)

**Development Docker Compose:**
```yaml
# docker-compose.dev.yml
services:
  api:
    build:
      context: .
      dockerfile: deployment/docker/Dockerfile.api.dev
    volumes:
      - ./apps/api:/app/apps/api  # Hot reload
      - ./shared:/app/shared
    ports:
      - "9000:9000"
    command: npm run start:dev --workspace=apps/api
    environment:
      - NODE_ENV=development
```

**Customer Workflow:**
```bash
# Add new LangGraph agent
cd apps/langgraph/src/agents
mkdir my-custom-agent
# Create agent files...
# Changes hot-reload automatically!

# Modify front-end
cd apps/web/src/components
# Edit Vue components...
# Changes hot-reload automatically!

# Test locally
curl http://localhost:9000/health
```

---

### Production Deployment (Customer's Servers)

**Purpose:** Deploy customized platform to production servers

**Setup:**
```bash
# On production server
git clone git@github.com:customer/orchestrator-ai-platform.git
cd orchestrator-ai-platform

# Checkout production branch (with their customizations)
git checkout production

# Install dependencies
npm install

# Configure production environment
cp .env.production.template .env.production
# Edit .env.production with production settings

# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

**Production Mode Features:**
- ✅ Optimized builds (no source code volumes)
- ✅ Production environment variables
- ✅ Health checks and monitoring
- ✅ Resource limits
- ✅ SSL/TLS termination
- ✅ Backup scripts

**Production Docker Compose:**
```yaml
# docker-compose.prod.yml
services:
  api:
    build:
      context: .
      dockerfile: deployment/docker/Dockerfile.api.prod
    # No volumes - uses built code
    ports:
      - "9000:9000"
    command: npm run start:prod --workspace=apps/api
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/health"]
      interval: 30s
```

**Deployment Workflow:**
```bash
# Build from customized source
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Verify
docker-compose -f docker-compose.prod.yml ps
curl https://api.customer-domain.com/health
```

---

## Customer Customization Workflow

### Adding LangGraph Agents

**Location:** `apps/langgraph/src/agents/`

**Process:**
```bash
# Local development
cd apps/langgraph/src/agents
mkdir my-custom-agent
cd my-custom-agent

# Create agent files (using template)
cp ../marketing-swarm/*.ts .  # Copy template
# Modify for custom agent

# Test locally (hot reload)
curl -X POST http://localhost:6200/my-custom-agent/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'

# Commit to git
git add apps/langgraph/src/agents/my-custom-agent
git commit -m "Add custom agent"
git push origin main

# Deploy to production
git checkout production
git merge main
# Build and deploy
```

---

### Creating n8n Workflows

**Location:** `apps/n8n/workflows/` (or via n8n UI)

**Process:**
```bash
# Access n8n UI
open http://localhost:5678

# Create workflow in UI
# Workflow saved to apps/n8n/workflows/my-workflow.json

# Commit workflow
git add apps/n8n/workflows/my-workflow.json
git commit -m "Add custom n8n workflow"
git push origin main
```

---

### Customizing Front-End

**Location:** `apps/web/src/`

**Process:**
```bash
# Local development
cd apps/web/src/components
# Edit Vue components
# Changes hot-reload automatically

# Test locally
open http://localhost:9001

# Commit changes
git add apps/web/src/
git commit -m "Customize front-end"
git push origin main
```

---

### Customizing API/Framework

**Location:** `apps/api/src/`

**Process:**
```bash
# Local development
cd apps/api/src
# Modify framework code
# Changes hot-reload automatically

# Test locally
curl http://localhost:9000/health

# Commit changes
git add apps/api/src/
git commit -m "Customize API"
git push origin main
```

---

## Update Strategy

### Getting Framework Updates

**Challenge:** Merge framework updates with customer customizations

**Recommended Approach: Git Upstream Merge**

```bash
# Customer adds upstream remote (one-time setup)
git remote add upstream https://github.com/orchestrator-ai/orchestrator-ai-platform.git

# Get framework updates
git fetch upstream
git checkout main
git merge upstream/main

# Resolve conflicts (if any)
# - Framework code conflicts: Usually accept upstream (framework updates)
# - Customer customizations: Keep customer version
# - Agent files: Usually no conflicts (separate directories)

# Test locally
docker-compose -f docker-compose.dev.yml restart
# Test customizations still work

# Deploy to production
git checkout production
git merge main
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

**Conflict Resolution Strategy:**
- **Framework code** (`apps/api/src/core/`, `apps/web/src/core/`): Usually accept upstream
- **Customer agents** (`apps/langgraph/src/agents/customer-*/`): Keep customer version
- **Customer workflows** (`apps/n8n/workflows/customer-*.json`): Keep customer version
- **Configuration** (`.env`, `docker-compose.yml`): Usually keep customer version

---

## Implementation Plan

### Phase 1: Template Repository Setup (1-2 weeks with AI)

1. **Create Template Repository**
   - Clean version without client-specific code
   - Remove sensitive data, client agents, etc.
   - Add comprehensive README
   - Location: New GitHub repo (orchestrator-ai-platform-template)
   - **AI Time:** 2-3 days (cleanup script + documentation)

2. **Template Repository Configuration**
   - Enable "Template repository" in GitHub settings
   - Add `.github/template-repository/` with setup instructions
   - Create starter documentation
   - **AI Time:** 1-2 days (GitHub setup + docs)

3. **Customer Onboarding Documentation**
   - Quick start guide
   - Development setup guide
   - Production deployment guide
   - Update/merge guide
   - Location: `docs/customer/`
   - **AI Time:** 2-3 days (comprehensive docs)

### Phase 2: Development Docker Compose (2-3 weeks with AI)

1. **Development Dockerfiles**
   - Hot reload configuration
   - Source code volume mounts
   - Development environment variables
   - Location: `deployment/docker/Dockerfile.*.dev`
   - **AI Time:** 2-3 days (Dockerfiles)

2. **Development Docker Compose**
   - `docker-compose.dev.yml` with volume mounts
   - Hot reload for all services
   - Development networking
   - Location: `deployment/docker-compose.dev.yml`
   - **AI Time:** 1-2 days (compose file)

3. **Production Dockerfiles**
   - Optimized builds
   - No source code volumes
   - Production environment
   - Location: `deployment/docker/Dockerfile.*.prod`
   - **AI Time:** 2-3 days (production builds)

### Phase 3: Customer Tools & Documentation (1-2 weeks with AI)

1. **Agent Templates**
   - LangGraph agent template
   - Scaffolding script
   - Example agents
   - Location: `apps/langgraph/templates/`
   - **AI Time:** 2-3 days (templates + scripts)

2. **Update/Merge Tools**
   - Script to help with upstream merges
   - Conflict resolution helpers
   - Update verification scripts
   - Location: `scripts/customer-tools/`
   - **AI Time:** 2-3 days (tools)

3. **Customer Documentation**
   - Development workflow guide
   - Production deployment guide
   - Update/merge guide
   - Troubleshooting guide
   - Location: `docs/customer/`
   - **AI Time:** 2-3 days (docs)

**Total:** 4-7 weeks (with AI) | 2-3 weeks human oversight

---

## Recommended Distribution Model

### Primary: GitHub Template Repository (Private)

**Setup:**
1. Create `orchestrator-ai-platform-template` repository
2. Enable "Template repository" in GitHub settings
3. Customers click "Use this template" → Create their repo
4. Customers clone and customize

**Workflow:**
- **Local Dev:** `docker-compose -f docker-compose.dev.yml up -d` (on their machines)
- **Production:** `docker-compose -f docker-compose.prod.yml up -d` (on servers)
- **Updates:** `git merge upstream/main` (standard git workflow)

**Best For:** 90% of customers

---

### Secondary: Private Repo Per Customer (Enterprise)

**Setup:**
1. Create private repo per enterprise customer
2. Grant them access
3. Push updates directly to their repo

**Workflow:**
- Same as template, but you manage updates
- Higher-touch relationship

**Best For:** Enterprise customers, high-value accounts

---

## Cost & Timeline

### Implementation
- **Template Repository Setup:** 1-2 weeks (with AI)
- **Development Docker Compose:** 2-3 weeks (with AI)
- **Customer Tools & Docs:** 1-2 weeks (with AI)
- **Total:** 4-7 weeks (with AI) | 2-3 weeks human oversight
- **Cost:** $20K-$30K (human oversight)

### Ongoing
- **Template Updates:** Push to template repo (customers merge)
- **Customer Support:** Help with merges, customizations
- **Documentation:** Keep docs updated

---

## Success Metrics

- ✅ Customers can clone and run locally in < 30 minutes
- ✅ Customers can add agents in < 1 hour
- ✅ Customers can deploy to production in < 2 hours
- ✅ Framework updates merge cleanly (minimal conflicts)
- ✅ Customer customizations preserved through updates

---

**See Also:**
- `05-Docker-Distribution-Strategy.md` - Docker architecture details
- `01-Tier1-Small-Mid-Sized-Hardening.md` - Full hardening assessment
- `docs/v2-starter-repository-strategy.md` - Existing template repo strategy

