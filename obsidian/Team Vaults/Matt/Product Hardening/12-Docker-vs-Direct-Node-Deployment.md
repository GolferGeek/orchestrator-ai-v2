# Docker vs Direct Node.js Deployment Strategy

## Overview

**Question:** When should we use Docker vs direct Node.js (`npm run prod:api`)?

**Answer:** It depends on the environment and use case. Here's the recommended approach:

---

## Deployment Options Comparison

### Option 1: Direct Node.js (Current Approach)

**How It Works:**
```bash
npm run prod:api        # Runs Node.js directly on host
npm run staging:api     # Runs Node.js directly on host
```

**Pros:**
- ✅ Simpler (no Docker overhead)
- ✅ Faster startup (no container overhead)
- ✅ Easier debugging (direct access to process)
- ✅ Less resource usage (no container layer)
- ✅ Works well for single-server deployments

**Cons:**
- ❌ Environment differences (dev vs prod)
- ❌ Dependency conflicts possible
- ❌ Harder to scale horizontally
- ❌ More complex deployment (need Node.js, PM2, etc.)
- ❌ Harder to rollback (need to rebuild)

**Best For:**
- **Staging** (Mac Studio - your internal use)
- **Single-server deployments**
- **Development environments**

---

### Option 2: Docker (Recommended for Production)

**How It Works:**
```bash
docker-compose -f docker-compose.prod.yml up -d
# Or via npm script:
npm run docker:prod
```

**Pros:**
- ✅ Consistent environments (dev, staging, prod all same)
- ✅ Easy deployment (just pull image and run)
- ✅ Easy rollback (switch to previous image)
- ✅ Isolation (no dependency conflicts)
- ✅ Scalability (easy horizontal scaling)
- ✅ Resource limits (CPU, memory)
- ✅ Health checks built-in
- ✅ Works on any server (doesn't need Node.js installed)

**Cons:**
- ⚠️ Slightly more complex setup
- ⚠️ Container overhead (minimal)
- ⚠️ Need Docker installed

**Best For:**
- **Production** (customer deployments)
- **Multi-server deployments**
- **When you need consistency**
- **When you need easy updates/rollbacks**

---

## Recommended Architecture

### Your Setup (Mac Studio)

**Development:**
```bash
npm run dev              # Direct Node.js (fast, easy debugging)
# No Docker needed
```

**Staging (What Boys See):**
```bash
npm run staging          # Direct Node.js via PM2
# OR
docker-compose -f docker-compose.staging.yml up -d
# Your choice - both work!
```

**Why Direct Node.js for Staging?**
- You control the Mac Studio environment
- Faster iteration
- Easier debugging
- Less overhead
- Boys can access via Tailscale

---

### Customer Setup (Their Servers)

**Production (Recommended: Docker):**
```bash
docker-compose -f docker-compose.prod.yml up -d
# OR via npm script:
npm run docker:prod
```

**Why Docker for Customer Production?**
- ✅ Consistent environment (works same everywhere)
- ✅ Easy updates (pull new image, restart)
- ✅ Easy rollback (switch to previous image)
- ✅ No need to install Node.js on server
- ✅ Isolation (no conflicts with other software)
- ✅ Resource management (CPU/memory limits)
- ✅ Health checks and auto-restart

---

## How npm Scripts Relate to Docker

### npm Scripts Can Wrap Docker Commands

**Option A: npm Scripts Call Docker**
```json
{
  "scripts": {
    "docker:dev": "docker-compose -f docker-compose.dev.yml up -d",
    "docker:staging": "docker-compose -f docker-compose.staging.yml up -d",
    "docker:prod": "docker-compose -f docker-compose.prod.yml up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f"
  }
}
```

**Option B: npm Scripts Run Direct Node.js**
```json
{
  "scripts": {
    "staging": "pm2 start ecosystem.staging.config.js",
    "prod:api": "pm2 start ecosystem.production.config.js"
  }
}
```

**Option C: Hybrid (Your Choice Per Environment)**
```json
{
  "scripts": {
    // Development: Direct Node.js
    "dev": "npm run dev:api",
    
    // Staging: Direct Node.js (your choice)
    "staging": "pm2 start ecosystem.staging.config.js",
    
    // Production: Docker (recommended)
    "production": "docker-compose -f docker-compose.prod.yml up -d"
  }
}
```

---

## Environment-Specific Recommendations

### Development (Mac Studio - Your Coding)

**Recommended: Direct Node.js**
```bash
npm run dev
# Or:
npm run dev:api
npm run dev:web
```

**Why:**
- Fastest iteration
- Easiest debugging
- Hot reload works best
- No Docker overhead

**No Docker needed here!**

---

### Staging (Mac Studio - Boys See This)

**Option 1: Direct Node.js (Recommended for You)**
```bash
npm run staging
# Uses PM2 to run Node.js directly
```

**Why:**
- You control the environment
- Faster startup
- Easier to debug issues
- Less overhead
- Boys access via Tailscale (works fine)

**Option 2: Docker (Also Fine)**
```bash
docker-compose -f docker-compose.staging.yml up -d
```

**Why:**
- More consistent with production
- Easier to test production-like environment
- Good practice for deployment

**Your Choice:** Both work! Direct Node.js is simpler for staging.

---

### Production (Customer Servers)

**Recommended: Docker**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Why Docker for Production:**
1. **Consistency** - Works same on any server
2. **Easy Updates** - Pull new image, restart
3. **Easy Rollback** - Switch to previous image
4. **No Node.js Required** - Server doesn't need Node.js installed
5. **Isolation** - No conflicts with other software
6. **Resource Management** - CPU/memory limits
7. **Health Checks** - Auto-restart on failure
8. **Scaling** - Easy to scale horizontally

**Alternative: Direct Node.js (If Customer Prefers)**
```bash
npm run production
# Uses PM2 to run Node.js directly
```

**When to Use Direct Node.js:**
- Customer prefers it
- Single-server deployment
- Customer has Node.js expertise
- Customer wants more control

**But Docker is strongly recommended!**

---

## Docker Compose Files

### Development Docker Compose

**`docker-compose.dev.yml`** (For Customers - Local Development)
```yaml
version: '3.8'

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
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: deployment/docker/Dockerfile.web.dev
    volumes:
      - ./apps/web:/app/apps/web  # Hot reload
    ports:
      - "9001:9001"
    command: npm run dev --workspace=apps/web
    environment:
      - NODE_ENV=development
    restart: unless-stopped

  supabase:
    # Supabase runs in Docker (already configured)
    # Uses existing Supabase Docker setup
```

**Use Case:** Customer local development (hot reload, easy debugging)

---

### Staging Docker Compose (Optional)

**`docker-compose.staging.yml`** (For Your Mac Studio - Optional)
```yaml
version: '3.8'

services:
  staging-api:
    build:
      context: .
      dockerfile: deployment/docker/Dockerfile.api.prod
    ports:
      - "7100:7100"
    environment:
      - NODE_ENV=staging
      - API_PORT=7100
    env_file:
      - .env.staging
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7100/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  staging-web:
    build:
      context: .
      dockerfile: deployment/docker/Dockerfile.web.prod
    ports:
      - "7101:7101"
    environment:
      - NODE_ENV=staging
      - PORT=7101
    env_file:
      - .env.staging
    restart: unless-stopped
```

**Use Case:** Optional - if you want staging to match production exactly

---

### Production Docker Compose

**`docker-compose.prod.yml`** (For Customer Production)
```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: deployment/docker/Dockerfile.api.prod
    ports:
      - "9000:9000"
    environment:
      - NODE_ENV=production
      - API_PORT=9000
    env_file:
      - .env.production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

  web:
    build:
      context: .
      dockerfile: deployment/docker/Dockerfile.web.prod
    ports:
      - "9001:9001"
    environment:
      - NODE_ENV=production
      - PORT=9001
    env_file:
      - .env.production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9001"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  n8n:
    image: docker.n8n.io/n8nio/n8n
    ports:
      - "5678:5678"
    env_file:
      - .env.production
    restart: unless-stopped
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

**Use Case:** Customer production deployment (recommended)

---

## npm Scripts That Wrap Docker

### Recommended npm Scripts

```json
{
  "scripts": {
    // Development (Direct Node.js - no Docker)
    "dev": "./start-dev-local.sh",
    "dev:api": "cd apps/api && ./start-dev.sh",
    
    // Staging (Direct Node.js via PM2 - your choice)
    "staging": "pm2 start ecosystem.staging.config.js",
    "staging:stop": "pm2 stop staging-api staging-web",
    "staging:restart": "pm2 restart staging-api staging-web",
    
    // Staging via Docker (optional alternative)
    "staging:docker": "docker-compose -f docker-compose.staging.yml up -d",
    "staging:docker:down": "docker-compose -f docker-compose.staging.yml down",
    
    // Production (Docker - recommended)
    "production": "docker-compose -f docker-compose.prod.yml up -d",
    "production:build": "docker-compose -f docker-compose.prod.yml build",
    "production:down": "docker-compose -f docker-compose.prod.yml down",
    "production:logs": "docker-compose -f docker-compose.prod.yml logs -f",
    "production:restart": "docker-compose -f docker-compose.prod.yml restart",
    
    // Production via Direct Node.js (alternative)
    "production:direct": "pm2 start ecosystem.production.config.js",
    "production:direct:stop": "pm2 stop all",
    
    // Docker utilities
    "docker:dev": "docker-compose -f docker-compose.dev.yml up -d",
    "docker:dev:down": "docker-compose -f docker-compose.dev.yml down",
    "docker:prod": "docker-compose -f docker-compose.prod.yml up -d",
    "docker:prod:down": "docker-compose -f docker-compose.prod.yml down"
  }
}
```

---

## Your Specific Setup

### Mac Studio Staging (What Boys See)

**Current Approach (Direct Node.js):**
```bash
npm run staging
# Runs: pm2 start ecosystem.staging.config.js
# API on port 7100
# Web on port 7101
# Boys access via Tailscale: http://mac-studio-name:7100
```

**This Works Great!** No need to change.

**Why It Works:**
- You control Mac Studio environment
- PM2 handles process management
- Easy to debug
- Fast startup
- Boys can access via Tailscale

**Optional: Switch to Docker**
```bash
npm run staging:docker
# Runs: docker-compose -f docker-compose.staging.yml up -d
# Same ports, same access
```

**Your Choice:** Direct Node.js is fine for staging!

---

### Customer Production

**Recommended: Docker**
```bash
# Customer runs:
docker-compose -f docker-compose.prod.yml up -d

# Or via npm script:
npm run production
```

**Why Docker for Customers:**
1. **Easy Deployment** - Just pull and run
2. **Easy Updates** - Pull new image, restart
3. **Easy Rollback** - Switch to previous image
4. **No Node.js Required** - Server doesn't need Node.js
5. **Consistency** - Works same everywhere
6. **Isolation** - No conflicts
7. **Resource Limits** - CPU/memory management
8. **Health Checks** - Auto-restart

**Alternative: Direct Node.js**
```bash
# Customer runs:
npm run production:direct
# Uses PM2
```

**When to Use:**
- Customer prefers it
- Single-server deployment
- Customer has Node.js expertise

**But Docker is strongly recommended!**

---

## Dockerfile Examples

### Development Dockerfile

**`deployment/docker/Dockerfile.api.dev`**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci

# Source code mounted as volume (hot reload)
# No COPY of source - it's mounted in docker-compose

EXPOSE 9000

CMD ["npm", "run", "start:dev", "--workspace=apps/api"]
```

**Use:** Customer local development (hot reload)

---

### Production Dockerfile

**`deployment/docker/Dockerfile.api.prod`**
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY shared ./shared

# Install dependencies
RUN npm ci

# Copy source code
COPY apps/api ./apps/api

# Build
RUN npm run build --workspace=apps/api

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/shared ./shared

EXPOSE 9000

CMD ["node", "apps/api/dist/main.js"]
```

**Use:** Customer production deployment

---

## Summary: When to Use What

### Development (Mac Studio - Your Coding)

**✅ Direct Node.js**
```bash
npm run dev
```
- Fastest iteration
- Easiest debugging
- Hot reload works best

---

### Staging (Mac Studio - Boys See This)

**✅ Direct Node.js (Recommended)**
```bash
npm run staging
# Uses PM2
```
- You control environment
- Faster startup
- Easier debugging
- Works great with Tailscale

**OR Docker (Optional)**
```bash
npm run staging:docker
```
- More consistent with production
- Good for testing production-like environment

**Your Choice:** Direct Node.js is fine!

---

### Production (Customer Servers)

**✅ Docker (Strongly Recommended)**
```bash
docker-compose -f docker-compose.prod.yml up -d
```
- Consistent environments
- Easy updates/rollbacks
- No Node.js required on server
- Resource management
- Health checks

**OR Direct Node.js (Alternative)**
```bash
npm run production:direct
# Uses PM2
```
- Customer preference
- Single-server deployment
- Customer has Node.js expertise

**Recommendation:** Use Docker for customer production!

---

## Answer to Your Question

**Q: "If I'm running `npm run prod:api` that's my local, right? That's where the boys can hit that, that would be our actual running Orchestrator AI for us to do our stuff in. How does that relate to Docker?"**

**A:**

1. **`npm run prod:api` (or `npm run staging`)** = Direct Node.js via PM2
   - Runs on Mac Studio
   - Boys access via Tailscale
   - This is your staging environment
   - **No Docker needed here** - Direct Node.js works great!

2. **Docker** = For customer production deployments
   - Customers run `docker-compose -f docker-compose.prod.yml up -d`
   - More consistent, easier updates
   - Recommended for customer servers

3. **Relationship:**
   - npm scripts can wrap Docker commands
   - You can use Direct Node.js for staging (your choice)
   - Customers should use Docker for production (recommended)

**Bottom Line:**
- **Your Staging (Mac Studio):** Direct Node.js is fine! (`npm run staging`)
- **Customer Production:** Docker is recommended (`docker-compose -f docker-compose.prod.yml up -d`)

Both approaches work - Docker is just better for production deployments because it's more consistent and easier to manage!

