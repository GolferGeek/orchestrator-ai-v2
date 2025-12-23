# Docker Distribution Strategy
## Source Code Distribution with Development Environment

**Date:** 2025-01-27  
**Target:** Small-to-Mid-Sized Companies (Inside the Firewall)  
**Distribution Method:** Source Code + Docker Compose Development Environment

**CRITICAL INSIGHT:** Customers need to:
- ✅ Code their own agents (LangGraph, n8n)
- ✅ Modify the framework code
- ✅ Customize the front-end
- ✅ Build and deploy their customizations

**This is a Platform/Framework Distribution, NOT a Product Distribution**

---

## Architecture Overview

### Current Services
1. **API** (`apps/api`) - Port 9000 - Main NestJS backend
2. **Web** (`apps/web`) - Port 9001 - Vue/Ionic frontend (development + production)
3. **LangGraph** (`apps/langgraph`) - Port 6200/8200/9200 - LangGraph workflow engine
4. **Observability** (`apps/observability/server`) - Port 6300/8300/9300 - Observability server
5. **Supabase** - Database + Auth + Storage (already containerized)
6. **N8N** (`apps/n8n`) - Optional - Workflow automation (custom workflows)

### Service Dependencies
```
Web → API → LangGraph (for LangGraph agents)
     ↓
     Observability (for events)
     ↓
     Supabase (database)
     ↓
     N8N (for n8n workflows)
```

**Key Point:** Services communicate via HTTP, making them perfect for separate containers. **But customers need full source code access to customize everything.**

---

## Recommended Docker Architecture

### Option 1: Separate Containers (Recommended for Production)

**Why Separate Containers:**
- ✅ **Isolation** - Each service runs independently
- ✅ **Scaling** - Scale components independently (e.g., more LangGraph workers)
- ✅ **Resource Management** - Allocate CPU/memory per service
- ✅ **Updates** - Update services independently
- ✅ **Debugging** - Easier to debug individual services
- ✅ **Standard Practice** - Microservices pattern

**Docker Compose Structure:**
```yaml
services:
  # Core Services (Required)
  api:
    image: orchestratorai/api:latest
    ports:
      - "9000:9000"
    environment:
      - DATABASE_URL=postgresql://...
      - LANGGRAPH_BASE_URL=http://langgraph:9200
      - OBSERVABILITY_BASE_URL=http://observability:9300
    depends_on:
      - supabase-db
      - langgraph
      - observability

  web:
    image: orchestratorai/web:latest
    ports:
      - "9001:9001"
    environment:
      - VITE_API_BASE_URL=http://api:9000
    depends_on:
      - api

  langgraph:
    image: orchestratorai/langgraph:latest
    ports:
      - "9200:9200"
    environment:
      - DATABASE_URL=postgresql://...
      - API_BASE_URL=http://api:9000
    depends_on:
      - supabase-db
      - api

  observability:
    image: orchestratorai/observability:latest
    ports:
      - "9300:9300"
    environment:
      - DATABASE_URL=postgresql://...
    depends_on:
      - supabase-db

  # Infrastructure (Required)
  supabase-db:
    image: supabase/postgres:latest
    volumes:
      - supabase_data:/var/lib/postgresql/data
    # ... Supabase config

  # Optional Services
  n8n:
    image: docker.n8n.io/n8nio/n8n
    # ... N8N config (optional)
```

**Client Experience:**
```bash
# Download release
wget https://releases.orchestratorai.io/v1.0.0/orchestrator-ai.tar.gz
tar -xzf orchestrator-ai.tar.gz
cd orchestrator-ai

# Configure
cp .env.template .env
# Edit .env with their settings

# Start everything
docker-compose up -d

# Or start without optional services
docker-compose up -d --scale n8n=0
```

---

### Option 2: Simplified Single-Container (For Very Small Deployments)

**When to Use:**
- Very small companies (< 10 users)
- Limited hardware resources
- Simpler deployment requirements

**Approach:**
- Single Dockerfile builds entire monorepo
- All services run in one container (using PM2 or similar)
- Still uses Docker Compose for database

**Trade-offs:**
- ✅ Simpler deployment
- ✅ Lower resource usage
- ❌ Less flexible scaling
- ❌ Harder to update individual services
- ❌ Not recommended for production

**Recommendation:** Offer both options, default to separate containers.

---

## Distribution Package Structure

### Client Distribution Package (Source Code)

```
orchestrator-ai-client-v1.0.0/
├── apps/                           # Full monorepo source code
│   ├── api/                        # API source (customizable)
│   ├── web/                        # Front-end source (customizable)
│   ├── langgraph/                  # LangGraph engine source
│   │   └── src/agents/             # Customer adds agents here
│   ├── observability/              # Observability source
│   ├── n8n/                        # n8n workflows directory
│   │   └── workflows/              # Customer workflows here
│   └── transport-types/            # Shared types
├── shared/                         # Shared code
├── deployment/
│   ├── docker/
│   │   ├── Dockerfile.api.dev      # Development Dockerfile
│   │   ├── Dockerfile.api.prod     # Production Dockerfile
│   │   ├── Dockerfile.web.dev
│   │   ├── Dockerfile.web.dev
│   │   └── ...                     # Other service Dockerfiles
│   ├── docker-compose.dev.yml      # Development compose file
│   ├── docker-compose.prod.yml     # Production compose file
│   └── scripts/
├── .env.template                   # Environment template
├── package.json                    # Monorepo package.json
├── turbo.json                      # Turbo config
├── install.sh                      # One-command installer
├── update.sh                       # Update script (pulls latest source)
├── README.md                       # Client documentation
├── docs/
│   ├── QUICK_START.md              # Quick start guide
│   ├── DEVELOPMENT.md              # Development guide
│   ├── ADDING_AGENTS.md            # How to add LangGraph agents
│   ├── N8N_WORKFLOWS.md            # How to create n8n workflows
│   ├── CUSTOMIZING_FRONTEND.md     # Front-end customization guide
│   ├── CUSTOMIZING_API.md          # API customization guide
│   ├── CONFIGURATION.md            # Configuration guide
│   ├── TROUBLESHOOTING.md          # Common issues
│   └── ARCHITECTURE.md             # Architecture overview
└── scripts/
    ├── health-check.sh             # Health check script
    ├── backup.sh                   # Backup script
    └── restore.sh                  # Restore script
```

**Key Difference:** This is **full source code**, not pre-built containers. Customers can modify everything.

---

## Implementation Plan

### Phase 1: Development Docker Compose Setup (2-3 weeks with AI)

1. **Create Development Dockerfiles**
   - `Dockerfile.api.dev` - API service with hot reload
   - `Dockerfile.web.dev` - Web frontend with Vite dev server
   - `Dockerfile.langgraph.dev` - LangGraph service with hot reload
   - `Dockerfile.observability.dev` - Observability service with hot reload
   - All mount source code volumes for live development
   - Location: `deployment/docker/`
   - **AI Time:** 2-3 days (Dockerfiles + volume mounts + hot reload)

2. **Development Docker Compose Configuration**
   - `docker-compose.dev.yml` - Development compose file
   - Source code volume mounts
   - Hot reload configuration
   - Development environment variables
   - Service dependencies and networking
   - Location: `deployment/docker-compose.dev.yml`
   - **AI Time:** 1-2 days (compose file + testing)

3. **Production Dockerfiles (Optional)**
   - `Dockerfile.api.prod` - Production build
   - `Dockerfile.web.prod` - Production build
   - `Dockerfile.langgraph.prod` - Production build
   - `docker-compose.prod.yml` - Production compose file
   - Location: `deployment/docker/`
   - **AI Time:** 1-2 days (production builds)

### Phase 2: Client Distribution Package (2-3 weeks with AI)

1. **Source Code Distribution Setup**
   - Package full monorepo source code
   - Include all dependencies (package.json, etc.)
   - Include development tools
   - Location: `deployment/client/`
   - **AI Time:** 1-2 days (packaging script)

2. **Installer Script**
   - Downloads latest source code release
   - Interactive configuration wizard
   - Installs dependencies (`npm install`)
   - Validates environment
   - Sets up Docker Compose development environment
   - Location: `deployment/client/install.sh`
   - **AI Time:** 2-3 days (installer + wizard)

3. **Update Script**
   - Pulls latest source code (git pull or download)
   - Runs `npm install` for new dependencies
   - Runs database migrations
   - Restarts services
   - Preserves customer customizations (agents, workflows, code changes)
   - Location: `deployment/client/update.sh`
   - **AI Time:** 2-3 days (update mechanism + merge strategy)

4. **Client Documentation**
   - Quick start guide (development environment)
   - Development guide (hot reload, debugging)
   - **Adding LangGraph Agents** guide (`apps/langgraph/src/agents/`)
   - **Creating n8n Workflows** guide
   - **Customizing Front-End** guide (`apps/web/`)
   - **Customizing API** guide (`apps/api/`)
   - Configuration guide
   - Troubleshooting guide
   - Location: `deployment/client/docs/`
   - **AI Time:** 3-4 days (AI generates comprehensive docs)

### Phase 3: Agent Development Tools & Templates (1-2 weeks with AI)

1. **LangGraph Agent Templates**
   - Template for new LangGraph agents
   - Example agents (reference implementations)
   - Agent scaffolding script
   - Location: `apps/langgraph/templates/`
   - **AI Time:** 2-3 days (templates + scaffolding)

2. **n8n Workflow Templates**
   - Example n8n workflows
   - Workflow import/export tools
   - Location: `apps/n8n/templates/`
   - **AI Time:** 1-2 days (templates + tools)

3. **Development Tools**
   - Agent testing utilities
   - Code generation helpers
   - Development scripts
   - Location: `scripts/dev-tools/`
   - **AI Time:** 2-3 days (development tools)

---

## Source Code Distribution Strategy

### Distribution Method

**NOT Docker Images** - We distribute **source code** that customers build themselves.

**Distribution Channels:**
1. **GitHub Releases** - Tagged releases with source code tarball
2. **Private Git Repository** - For enterprise customers
3. **Tarball Download** - Direct download from release server

**Versioning:**
- `v1.0.0` - Tagged releases
- `v1.0.0-beta` - Beta releases
- `latest` - Latest stable release branch

### Development Dockerfiles

**Development Mode (Primary):**
- Mount source code as volumes
- Hot reload enabled
- Full development tools
- Debugging support

**Example (API Development):**
```dockerfile
FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci

# Source code mounted as volume in docker-compose
# No COPY of source - it's mounted for hot reload

EXPOSE 9000
CMD ["npm", "run", "start:dev", "--workspace=apps/api"]
```

**Production Build (Optional):**
- Build from customer's customized source
- Optimized production builds
- No source code volumes

**Example (API Production):**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci
COPY . .
RUN npm run build --workspace=apps/api

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
RUN npm ci --production
EXPOSE 9000
CMD ["node", "dist/main.js"]
```

---

## Service Communication

### Internal Networking

All services communicate via Docker internal network:
- `http://api:9000` - API service
- `http://langgraph:9200` - LangGraph service
- `http://observability:9300` - Observability service
- `postgresql://supabase-db:5432` - Database

**Benefits:**
- Services don't need exposed ports (except for external access)
- Secure internal communication
- Easy to add reverse proxy (Nginx) later

### External Access

Only necessary ports exposed:
- `9000` - API (or via Nginx reverse proxy)
- `9001` - Web (or via Nginx reverse proxy)
- `9010` - Supabase API (optional, for Supabase Studio)
- `9012` - Supabase Studio (optional)

---

## Configuration Management

### Environment Variables

**Centralized `.env` file:**
```bash
# Database
DATABASE_URL=postgresql://postgres:password@supabase-db:5432/postgres
SUPABASE_URL=http://supabase-api:9010
SUPABASE_ANON_KEY=...

# Service URLs (internal)
API_BASE_URL=http://api:9000
LANGGRAPH_BASE_URL=http://langgraph:9200
OBSERVABILITY_BASE_URL=http://observability:9300

# External URLs (for web app)
VITE_API_BASE_URL=https://api.client-domain.com
```

**Client Configuration:**
- `.env.template` provided with all variables
- Installer wizard helps configure
- Documentation explains each variable

---

## Scaling Considerations

### Horizontal Scaling

**Easy to Scale:**
```bash
# Scale LangGraph workers (if needed)
docker-compose up -d --scale langgraph=3

# Scale API (if needed)
docker-compose up -d --scale api=2
```

**Load Balancing:**
- Add Nginx reverse proxy for API scaling
- LangGraph can scale independently
- Database connection pooling handles multiple API instances

### Resource Allocation

**Default Resource Limits:**
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
  langgraph:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G  # More memory for LangGraph workflows
```

**Clients can adjust** based on their hardware.

---

## Update Strategy

### Version Updates (Source Code)

**Client Update Process:**
```bash
# Pull latest source code
git pull origin v1.1.0
# OR download new release tarball and extract

# Install new dependencies
npm install

# Run migrations (if any)
docker-compose exec api npm run db:migrate

# Rebuild if needed (for production)
docker-compose -f docker-compose.prod.yml build

# Restart services
docker-compose restart
```

**Automated Update Script:**
```bash
./update.sh v1.1.0
# - Downloads/pulls v1.1.0 source code
# - Preserves customer customizations (agents, workflows, code)
# - Installs new dependencies
# - Runs migrations
# - Restarts services
# - Health checks
```

**Key Challenge:** Merging customer customizations with framework updates
- Customer agents in `apps/langgraph/src/agents/` are preserved
- Customer n8n workflows in `apps/n8n/workflows/` are preserved
- Framework code changes need manual merge (like any framework upgrade)

---

## Security Considerations

### Image Security
- Scan images for vulnerabilities (Snyk, Trivy)
- Use minimal base images (Alpine Linux)
- No secrets in images (use environment variables)
- Signed images (Docker Content Trust)

### Network Security
- Internal network isolation
- Only expose necessary ports
- Use reverse proxy for external access
- TLS termination at reverse proxy

---

## Monitoring & Health Checks

### Health Checks

Each service includes health check:
```yaml
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Monitoring Script

```bash
./scripts/health-check.sh
# Checks all services
# Reports status
# Suggests fixes
```

---

## Cost & Resource Estimates

### Minimum Hardware (Separate Containers)
- **CPU:** 4 cores
- **RAM:** 8GB (2GB API + 2GB LangGraph + 2GB DB + 2GB overhead)
- **Storage:** 50GB SSD

### Recommended Hardware
- **CPU:** 8 cores
- **RAM:** 16GB (4GB API + 4GB LangGraph + 4GB DB + 4GB overhead)
- **Storage:** 100GB SSD

### Single Container (Simplified)
- **CPU:** 2 cores
- **RAM:** 4GB
- **Storage:** 50GB SSD

---

## Implementation Timeline

### Phase 1: Development Docker Compose Setup (2-3 weeks with AI)
- Development Dockerfiles (with hot reload)
- Development docker-compose.yml
- Production Dockerfiles (optional)
- **AI Time:** 4-7 days

### Phase 2: Source Code Distribution Package (2-3 weeks with AI)
- Source code packaging
- Installer script (downloads source, installs deps)
- Update script (preserves customizations)
- Comprehensive client documentation
- **AI Time:** 8-12 days

### Phase 3: Agent Development Tools (1-2 weeks with AI)
- LangGraph agent templates
- n8n workflow templates
- Development tools and scripts
- **AI Time:** 5-8 days

**Total:** 5-8 weeks (with AI) | 3-4 weeks human oversight

---

## Recommendation Summary

**CRITICAL CHANGE:** This is **Source Code Distribution**, NOT pre-built container distribution.

**Primary Distribution:** Source Code + Development Docker Compose
- ✅ Full source code access for customization
- ✅ Hot reload for agent development
- ✅ Customers can modify framework and front-end
- ✅ Standard development workflow
- ✅ Production builds from customized source

**Key Features:**
- **Agent Development:** Customers add LangGraph agents in `apps/langgraph/src/agents/`
- **Workflow Creation:** Customers create n8n workflows via n8n UI
- **Framework Customization:** Customers can modify any part of the codebase
- **Front-End Customization:** Customers can modify Vue/Ionic front-end

**Distribution Model:**
- Think **WordPress/Drupal** - you get source code, customize it, deploy it
- Think **Enterprise Framework** - platform SDK that customers build on
- NOT a SaaS product - it's a **deployable platform**

**Skip:** Pre-built Docker images
- ❌ Customers need source code to customize
- ❌ Customers need to add their own agents
- ❌ Not suitable for a customizable platform

---

**See Also:**
- `01-Tier1-Small-Mid-Sized-Hardening.md` - Full hardening assessment
- `06-Advanced-RAG-Strategy.md` - RAG capabilities
- `07-Source-Code-Distribution-Options.md` - **How customers get source code (fork vs template vs private repo)**
- `deployment/PRODUCTION_DEPLOYMENT.md` - Current deployment guide
- `apps/langgraph/README.md` - LangGraph agent development
- `apps/n8n/README.md` - n8n workflow setup

