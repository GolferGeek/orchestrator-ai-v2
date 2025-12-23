# Development Architecture: Centralized vs Local

## Recommendation: Hybrid Approach

**Best of Both Worlds:**
- **Centralized** for shared/staging/production (Mac Studio)
- **Local** for individual development (each developer's machine)
- **Multiple Supabase databases** on Mac Studio for different projects

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Mac Studio (Central)                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Supabase Instance (Multiple DBs)            │   │
│  │                                                       │   │
│  │  • orchestrator_ai (main app)                       │   │
│  │  • orchestrator_ai_staging (shared staging)         │   │
│  │  • hyperarchy_db (Hyperarchy project)                │   │
│  │  • bookwriter_db (Book Writer project)               │   │
│  │  • research_ai_db (Research AI project)              │   │
│  │  • n8n schema (shared workflows)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         N8N Instance (Shared)                      │   │
│  │  • Shared workflows                                │   │
│  │  • Production workflows                            │   │
│  │  • Accessible via Tailscale                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Access: Tailscale (private) + Cloudflare (public)         │
└─────────────────────────────────────────────────────────────┘
                          │
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   MacBook    │  │  Nephew #1   │  │  Nephew #2   │
│  (Your Dev)  │  │   (Dev)      │  │   (Dev)      │
│              │  │              │  │              │
│ Local:       │  │ Local:       │  │ Local:       │
│ • Supabase   │  │ • Supabase   │  │ • Supabase   │
│ • N8N        │  │ • N8N        │  │ • N8N        │
│              │  │              │  │              │
│ Connects to: │  │ Connects to: │  │ Connects to: │
│ • Mac Studio │  │ • Mac Studio │  │ • Mac Studio │
│   (staging)  │  │   (staging)  │  │   (staging)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## When to Use What

### ✅ Use Centralized (Mac Studio) For:

1. **Shared Staging Environment**
   - Testing integrations between apps
   - Demo data that everyone can see
   - Pre-production testing
   - Client demos

2. **Production Apps**
   - Live customer-facing apps
   - Production workflows (N8N)
   - Production databases

3. **Shared Resources**
   - N8N workflows that multiple people use
   - Shared data/models
   - Centralized backups

4. **Projects That Need Collaboration**
   - Hyperarchy (multiple contributors)
   - Shared research data
   - Team projects

### ✅ Use Local Development For:

1. **Individual Development**
   - Writing new features
   - Testing changes
   - Experimenting
   - Learning/exploring

2. **Isolation**
   - Avoid conflicts with others
   - Break things safely
   - Reset database anytime
   - Work offline

3. **Performance**
   - Faster (no network latency)
   - No dependency on Mac Studio being online
   - Full control over environment

---

## Recommended Setup

### Mac Studio: Centralized Resources

**Multiple Supabase Databases:**

```bash
# On Mac Studio - Supabase config supports multiple databases
# Each project gets its own database:

# orchestrator_ai (main app)
# orchestrator_ai_staging (shared staging)
# hyperarchy_db (Hyperarchy project)
# bookwriter_db (Book Writer - nephew)
# research_ai_db (Research AI - son)
```

**Single N8N Instance (Shared):**
- All developers can access via Tailscale
- Shared workflows for production
- Each developer can have their own workspace/folder

**Access Methods:**
- **Tailscale**: `http://mac-studio-name:9010` (Supabase)
- **Tailscale**: `http://mac-studio-name:5678` (N8N)
- **Cloudflare**: Public apps (customer-facing)

### Each Developer: Local Development

**Local Supabase Instance:**
```bash
# Each developer runs locally
cd apps/api/supabase
supabase start

# Uses local ports:
# - API: http://127.0.0.1:6010
# - Studio: http://127.0.0.1:6015
# - DB: postgresql://postgres:postgres@127.0.0.1:6012/postgres
```

**Local N8N (Optional):**
```bash
# For isolated workflow development
cd apps/n8n
docker-compose up

# Uses local port: http://localhost:5678
```

**Environment Switching:**
```bash
# .env.local (local development)
SUPABASE_URL=http://127.0.0.1:6010
N8N_URL=http://localhost:5678

# .env.staging (connect to Mac Studio)
SUPABASE_URL=http://mac-studio-name:9010
N8N_URL=http://mac-studio-name:5678

# .env.production (production)
SUPABASE_URL=https://your-project.supabase.co
N8N_URL=https://n8n.yourdomain.com
```

---

## Implementation Strategy

### Phase 1: Set Up Mac Studio (Centralized)

**1. Multiple Supabase Databases**

Create separate databases for each project:

```sql
-- On Mac Studio Supabase instance
CREATE DATABASE orchestrator_ai;
CREATE DATABASE orchestrator_ai_staging;
CREATE DATABASE hyperarchy_db;
CREATE DATABASE bookwriter_db;
CREATE DATABASE research_ai_db;

-- Each database gets its own schema
-- Supabase can manage multiple databases via config
```

**Supabase Config (Mac Studio):**

```toml
# apps/api/supabase/config.toml (Mac Studio)
project_id = "mac-studio-central"

[api]
port = 9010
schemas = ["public", "graphql_public"]

# Multiple databases via connection pooling
# Each app connects to its own database
```

**2. Shared N8N Instance**

```yaml
# apps/n8n/docker-compose.yml (Mac Studio)
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: mac-studio-name  # Tailscale hostname
      DB_POSTGRESDB_DATABASE: orchestrator_ai
      DB_POSTGRESDB_SCHEMA: n8n
      # ... other config
```

**3. Tailscale Access**

```bash
# Mac Studio binds to Tailscale network
# Supabase listens on: 0.0.0.0:9010 (accessible via Tailscale)
# N8N accessible via: http://mac-studio-name:5678
```

### Phase 2: Developer Local Setup

**Each Developer's Machine:**

```bash
# 1. Clone repo
git clone <repo-url>
cd orchestrator-ai-v2

# 2. Set up local Supabase
cd apps/api/supabase
supabase start

# 3. (Optional) Set up local N8N
cd apps/n8n
docker-compose up

# 4. Configure environment
cp dev.env.example .env.local
# Edit .env.local to use local instances

# 5. Develop locally
npm run dev:api
# Connects to local Supabase at http://127.0.0.1:6010
```

**Environment Files:**

```bash
# .env.local (default - local development)
SUPABASE_URL=http://127.0.0.1:6010
N8N_URL=http://localhost:5678
NODE_ENV=development

# .env.staging (connect to Mac Studio)
SUPABASE_URL=http://mac-studio-name:9010
N8N_URL=http://mac-studio-name:5678
NODE_ENV=staging

# Switch environments:
cp .env.staging .env  # Use staging
cp .env.local .env    # Use local
```

---

## Database Strategy: Multiple Databases vs Schemas

### Option A: Multiple Databases (Recommended)

**Pros:**
- Complete isolation
- Different backup strategies per project
- Can scale independently
- Clear separation

**Cons:**
- More complex setup
- More connections to manage

**Implementation:**
```sql
-- Each project gets its own database
CREATE DATABASE orchestrator_ai;
CREATE DATABASE hyperarchy_db;
CREATE DATABASE bookwriter_db;
```

### Option B: Multiple Schemas (Simpler)

**Pros:**
- Single database connection
- Easier to manage
- Shared extensions

**Cons:**
- Less isolation
- Schema-level conflicts possible

**Implementation:**
```sql
-- Single database, multiple schemas
CREATE SCHEMA orchestrator_ai;
CREATE SCHEMA hyperarchy;
CREATE SCHEMA bookwriter;
```

**Recommendation:** Start with **multiple schemas** (simpler), migrate to **multiple databases** if needed.

---

## N8N Strategy: Shared vs Local

### Recommended: Shared Instance (Mac Studio)

**Why:**
- Workflows are collaborative
- Production workflows need centralization
- Easier to manage credentials
- Single source of truth

**How:**
- Mac Studio runs single N8N instance
- All developers connect via Tailscale
- Each developer can have their own workspace/folder
- Use N8N's folder/workspace features for isolation

**Access:**
```bash
# From any developer machine (via Tailscale)
open http://mac-studio-name:5678

# Or via Cloudflare (if you want public access)
open https://n8n.yourdomain.com
```

### Optional: Local N8N for Development

**When to Use:**
- Testing workflow changes
- Experimenting with new workflows
- Learning N8N features
- Working offline

**Setup:**
```bash
# Local N8N (isolated)
cd apps/n8n
docker-compose -f docker-compose.local.yml up

# Uses local database or SQLite
# Completely isolated from shared instance
```

---

## Workflow Examples

### Scenario 1: Developing New Feature

**Developer (MacBook):**
```bash
# 1. Work locally
cp .env.local .env
npm run dev:api

# 2. Develop feature
# - Uses local Supabase (http://127.0.0.1:6010)
# - Can reset database anytime
# - No conflicts with others

# 3. Test locally
npm test

# 4. When ready, push to staging
git push origin feature-branch

# 5. Test on Mac Studio staging
cp .env.staging .env
npm run dev:api
# Now connects to Mac Studio staging database
```

### Scenario 2: Collaborating on Hyperarchy

**Multiple Developers:**
```bash
# 1. Each developer works locally
# - Local Supabase for development
# - Local code changes

# 2. Push changes to shared repo
git push origin hyperarchy-feature

# 3. Test on Mac Studio staging
# - Connects to hyperarchy_db on Mac Studio
# - All developers can see shared data
# - Test integrations together

# 4. Deploy to production
# - Uses production database on Mac Studio
# - Accessible via Cloudflare
```

### Scenario 3: Nephew Working on Book Writer

**Nephew's Workflow:**
```bash
# 1. Local development
cp .env.local .env
npm run dev:api
# Uses local Supabase, isolated

# 2. When ready, test on Mac Studio
cp .env.staging .env
# Connects to bookwriter_db on Mac Studio
# Can share with you for review

# 3. Access via Tailscale
# http://mac-studio-name:9010 (Supabase)
# http://mac-studio-name:5678 (N8N)
```

---

## Environment Configuration

### Mac Studio (Centralized)

**Supabase:**
```toml
# apps/api/supabase/config.toml
[api]
port = 9010
# Bind to all interfaces (accessible via Tailscale)
bind_address = "0.0.0.0"

# Multiple databases configured via connection strings
```

**N8N:**
```yaml
# apps/n8n/docker-compose.yml
services:
  n8n:
    ports:
      - "5678:5678"
    environment:
      DB_POSTGRESDB_HOST: mac-studio-name
      DB_POSTGRESDB_DATABASE: orchestrator_ai
      DB_POSTGRESDB_SCHEMA: n8n
```

### Developer Machines (Local)

**Local Supabase:**
```bash
# Each developer runs:
cd apps/api/supabase
supabase start

# Uses ports:
# - API: 6010
# - Studio: 6015
# - DB: 6012
```

**Environment Variables:**
```bash
# .env.local
SUPABASE_URL=http://127.0.0.1:6010
N8N_URL=http://localhost:5678  # Optional local N8N
NODE_ENV=development

# .env.staging (connect to Mac Studio)
SUPABASE_URL=http://mac-studio-name:9010
N8N_URL=http://mac-studio-name:5678
NODE_ENV=staging
```

---

## Benefits of This Approach

### ✅ Advantages

1. **Isolation During Development**
   - No conflicts between developers
   - Can reset local database anytime
   - Experiment safely

2. **Shared Resources When Needed**
   - Staging environment for integration testing
   - Shared workflows (N8N)
   - Production apps centralized

3. **Flexibility**
   - Work offline (local)
   - Collaborate when needed (centralized)
   - Easy to switch between environments

4. **Performance**
   - Local development is fast (no network)
   - Centralized for production (reliable)

5. **Standard Practice**
   - Matches industry standards
   - Easy for new developers to understand
   - Scalable as team grows

### ⚠️ Considerations

1. **Mac Studio Must Be Online**
   - For staging/production access
   - Mitigated by Tailscale (works from anywhere)

2. **Database Sync**
   - Local dev databases need migrations
   - Use Supabase migrations (already in place)

3. **N8N Workflow Sync**
   - Shared workflows need coordination
   - Use N8N's export/import or Git sync

---

## Migration Path

### Step 1: Set Up Mac Studio (Week 1)

```bash
# 1. Install Tailscale on Mac Studio
# 2. Set up Supabase with multiple databases
# 3. Set up shared N8N instance
# 4. Configure Tailscale access
# 5. Test access from MacBook
```

### Step 2: Developer Setup (Week 1-2)

```bash
# 1. Each developer installs Tailscale
# 2. Sets up local Supabase
# 3. Configures environment files
# 4. Tests local development
# 5. Tests connection to Mac Studio staging
```

### Step 3: Workflow Documentation (Week 2)

```bash
# 1. Document local development workflow
# 2. Document staging workflow
# 3. Document production deployment
# 4. Create runbooks for common tasks
```

---

## Quick Reference

### Mac Studio Commands

```bash
# Start Supabase
cd apps/api/supabase
supabase start

# Start N8N
cd apps/n8n
docker-compose up -d

# Check Tailscale status
tailscale status

# View Supabase logs
supabase logs
```

### Developer Commands

```bash
# Local development
cp .env.local .env
npm run dev:api

# Connect to staging
cp .env.staging .env
npm run dev:api

# Check Tailscale connection
ping mac-studio-name
```

### Environment Switching

```bash
# Quick switch script
#!/bin/bash
# switch-env.sh
case "$1" in
  local)
    cp .env.local .env
    echo "Switched to local environment"
    ;;
  staging)
    cp .env.staging .env
    echo "Switched to staging (Mac Studio)"
    ;;
  production)
    cp .env.production .env
    echo "Switched to production"
    ;;
esac

# Usage:
./switch-env.sh local
./switch-env.sh staging
```

---

## Recommendation Summary

**✅ Do This:**

1. **Mac Studio**: Centralized Supabase (multiple databases) + shared N8N
2. **Each Developer**: Local Supabase + optional local N8N
3. **Environment Switching**: Easy switch between local/staging/production
4. **Access**: Tailscale for private, Cloudflare for public

**❌ Don't Do This:**

1. **Only Centralized**: Everyone fighting over same database
2. **Only Local**: No way to test integrations together
3. **No Environment Switching**: Hard to test staging/production

**🎯 Best Practice:**

- **Develop Locally** (fast, isolated, safe)
- **Test on Staging** (Mac Studio, shared, integration testing)
- **Deploy to Production** (Mac Studio, centralized, reliable)

This gives you the best of both worlds: fast local development with the ability to collaborate and test together when needed!

