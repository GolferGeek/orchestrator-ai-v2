# Customer Site Deployment Workflow

## Your Workflow on Customer Machines

**Scenario:** You're working remotely on customer's machine (or in their office). They have one machine that serves as both development and production.

**Workflow:**
1. **Dev Mode** - You code/test (`npm run dev`)
2. **Staging** - Customer tests (`npm run staging` OR Docker?)
3. **Production** - All users access (`docker-compose up -d`)

---

## Recommended Approach

### Development (You Working)

**✅ Direct Node.js (npm)**
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
- You're actively coding

**No Docker needed here!**

---

### Staging (Customer Testing)

**✅ Docker (Recommended)**

**Why Docker for Staging:**
1. **Matches Production** - Catches Docker-specific issues early
2. **Consistent Environment** - Same as production
3. **Easy Transition** - Staging → Production is just restart
4. **Isolation** - Won't interfere with your dev work
5. **Practice** - Customer gets familiar with Docker workflow

**Setup:**
```bash
docker-compose -f docker-compose.staging.yml up -d
```

**OR Direct Node.js (Alternative)**

**When to Use npm for Staging:**
- Customer prefers it
- Faster iteration needed
- Simple setup preferred
- Customer doesn't want Docker complexity

**Setup:**
```bash
npm run staging
# Uses PM2
```

**Recommendation:** Use Docker for staging to match production environment.

---

### Production (All Users Access)

**✅ Docker (Required)**

**Why:**
- Consistent with staging
- Easy updates/rollbacks
- Resource management
- Health checks
- Isolation

**Setup:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## Complete Workflow on Customer Machine

### Step 1: Development (You Working)

```bash
# On customer machine (remote or in office)
cd /path/to/orchestrator-ai-platform

# Start development
npm run dev

# You code, test, iterate
# Hot reload works
# Easy debugging
```

**Access:**
- API: `http://localhost:6100` (only you)
- Web: `http://localhost:6101` (only you)

**No Docker - Direct Node.js**

---

### Step 2: Staging (Customer Tests)

**Option A: Docker (Recommended)**

```bash
# Stop dev (if running)
npm run dev:stop  # Or Ctrl+C

# Start staging in Docker
docker-compose -f docker-compose.staging.yml up -d

# Customer tests
# Access: http://customer-server:7100
```

**Why Docker:**
- Matches production environment
- Catches Docker issues early
- Easy to switch to production later

**Option B: Direct Node.js (Alternative)**

```bash
# Stop dev
npm run dev:stop

# Start staging
npm run staging

# Customer tests
# Access: http://customer-server:7100
```

**When to Use:**
- Customer prefers simpler setup
- Faster iteration needed
- Less complexity

**Recommendation:** Use Docker to match production.

---

### Step 3: Production (All Users)

```bash
# Stop staging
docker-compose -f docker-compose.staging.yml down
# OR
npm run staging:stop

# Start production in Docker
docker-compose -f docker-compose.prod.yml up -d

# All users can access
# Access: http://customer-server:9000
```

**Always Docker for Production!**

---

## Docker Compose Files for Customer Machine

### Development (No Docker - Direct npm)

**No Docker Compose needed** - Just use `npm run dev`

---

### Staging Docker Compose

**`docker-compose.staging.yml`**
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
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7101"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Use:** Customer testing before production

---

### Production Docker Compose

**`docker-compose.prod.yml`**
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

**Use:** Production - all users access

---

## npm Scripts for Customer Machine

```json
{
  "scripts": {
    // Development (You working - Direct Node.js)
    "dev": "./start-dev-local.sh",
    "dev:api": "cd apps/api && ./start-dev.sh",
    "dev:web": "cd apps/web && npm run dev",
    "dev:stop": "pkill -f 'nest start' || true",
    
    // Staging (Customer testing - Docker recommended)
    "staging": "docker-compose -f docker-compose.staging.yml up -d",
    "staging:build": "docker-compose -f docker-compose.staging.yml build",
    "staging:down": "docker-compose -f docker-compose.staging.yml down",
    "staging:logs": "docker-compose -f docker-compose.staging.yml logs -f",
    "staging:restart": "docker-compose -f docker-compose.staging.yml restart",
    
    // Staging Alternative (Direct Node.js - if customer prefers)
    "staging:npm": "pm2 start ecosystem.staging.config.js",
    "staging:npm:stop": "pm2 stop staging-api staging-web",
    
    // Production (All users - Docker required)
    "production": "docker-compose -f docker-compose.prod.yml up -d",
    "production:build": "docker-compose -f docker-compose.prod.yml build",
    "production:down": "docker-compose -f docker-compose.prod.yml down",
    "production:logs": "docker-compose -f docker-compose.prod.yml logs -f",
    "production:restart": "docker-compose -f docker-compose.prod.yml restart",
    
    // Quick workflow helpers
    "dev-to-staging": "npm run dev:stop && npm run staging",
    "staging-to-prod": "npm run staging:down && npm run production"
  }
}
```

---

## Port Allocation on Customer Machine

| Environment | API Port | Web Port | Who Accesses |
|-------------|----------|----------|--------------|
| **Dev** | 6100 | 6101 | You only (localhost) |
| **Staging** | 7100 | 7101 | Customer tests (internal network) |
| **Production** | 9000 | 9001 | All users (internal network) |

**Why Different Ports:**
- Can run dev + staging simultaneously (if needed)
- Clear separation between environments
- Easy to switch between them

---

## Complete Workflow Example

### Day 1: Initial Setup on Customer Machine

```bash
# 1. Clone repository
git clone <customer-repo-url>
cd orchestrator-ai-platform

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.staging
cp .env.example .env.production
# Edit both files with customer's Supabase credentials

# 4. Build Docker images (one-time)
docker-compose -f docker-compose.staging.yml build
docker-compose -f docker-compose.prod.yml build
```

---

### Daily Workflow

**Morning: You Start Development**

```bash
# Start dev mode (Direct Node.js)
npm run dev

# You code, test, iterate
# Hot reload works
# Easy debugging
```

**Afternoon: Customer Tests (Staging)**

```bash
# Stop dev
npm run dev:stop

# Start staging (Docker)
npm run staging

# Customer tests at: http://customer-server:7100
# You can monitor logs:
npm run staging:logs
```

**Evening: Deploy to Production**

```bash
# Stop staging
npm run staging:down

# Start production (Docker)
npm run production

# All users access at: http://customer-server:9000
```

---

## Why Docker for Staging?

### Benefits

1. **Matches Production**
   - Same environment as production
   - Catches Docker-specific issues early
   - Same build process

2. **Easy Transition**
   - Staging → Production is just restart
   - Same Docker images (different config)
   - No surprises when going to production

3. **Isolation**
   - Won't interfere with your dev work
   - Can run dev + staging simultaneously (different ports)
   - Clean separation

4. **Practice**
   - Customer gets familiar with Docker
   - Same commands for staging and production
   - Less confusion

5. **Consistency**
   - Same as production
   - Same resource limits
   - Same health checks

---

## Alternative: npm for Staging

**When to Use:**

- Customer prefers simpler setup
- Faster iteration needed
- Less complexity desired
- Customer doesn't want Docker overhead

**Setup:**
```bash
npm run staging:npm
# Uses PM2
```

**Trade-offs:**
- ✅ Simpler (no Docker)
- ✅ Faster startup
- ❌ Different from production (might miss issues)
- ❌ Harder transition to production

**Recommendation:** Use Docker for staging to match production.

---

## Quick Reference

### Development (You Working)
```bash
npm run dev              # Direct Node.js
npm run dev:stop         # Stop dev
```

### Staging (Customer Testing)
```bash
npm run staging          # Docker (recommended)
npm run staging:logs     # View logs
npm run staging:down     # Stop staging

# OR npm alternative:
npm run staging:npm      # Direct Node.js (if preferred)
```

### Production (All Users)
```bash
npm run production       # Docker (required)
npm run production:logs  # View logs
npm run production:down  # Stop production
```

### Quick Transitions
```bash
npm run dev-to-staging   # Dev → Staging
npm run staging-to-prod  # Staging → Production
```

---

## Summary

### Your Workflow on Customer Machine

| Phase | Method | Port | Who Accesses |
|-------|--------|------|--------------|
| **Dev** | Direct Node.js (`npm run dev`) | 6100 | You only |
| **Staging** | **Docker** (recommended) | 7100 | Customer tests |
| **Production** | **Docker** (required) | 9000 | All users |

### Key Points

1. **Dev**: Direct Node.js - fastest, easiest debugging
2. **Staging**: Docker recommended - matches production, catches issues early
3. **Production**: Docker required - consistent, easy updates

### Answer to Your Question

**Q: "Should staging be in Docker as well?"**

**A: Yes, recommended!**

**Why:**
- Matches production environment
- Catches Docker-specific issues early
- Easy transition: staging → production
- Customer gets familiar with Docker workflow
- Same commands for both staging and production

**But:** You can use npm for staging if customer prefers simpler setup. Docker is just better practice.

**Bottom Line:**
- **Dev**: npm (Direct Node.js) ✅
- **Staging**: Docker (recommended) ✅
- **Production**: Docker (required) ✅

This gives you the best of both worlds: fast development + consistent staging/production!

