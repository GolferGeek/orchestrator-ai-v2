# Deployment Workflow: Dev → Staging → Production

## Overview

**Your Workflow:**
- **Dev**: Code on Mac Studio (fast machine, local development)
- **Staging**: What the boys see, where they test and develop
- **Production**: What customers see (or their own deployment)

**Key Question:** What do customers actually use?
- **Answer**: Customers deploy their own instance (inside their firewall)
- **Staging** = What we show them in demos
- **Production** = Their own deployment (they run `npm run production` on their servers)

---

## Environment Strategy

### Three Environments

```
┌─────────────────────────────────────────────────────────────┐
│                    Mac Studio                                │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    DEV       │  │   STAGING    │  │  PRODUCTION  │      │
│  │              │  │              │  │              │      │
│  │ • Local DB   │  │ • Shared DB  │  │ • Customer   │      │
│  │ • Port 6100  │  │ • Port 7100  │  │   Instance   │      │
│  │ • Fast dev   │  │ • Boys see   │  │ • Port 9000  │      │
│  │ • You code   │  │ • Testing    │  │ • Live apps  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  Promotion: Dev → Staging → Production                      │
└─────────────────────────────────────────────────────────────┘
```

### Environment Details

| Environment | Purpose | Database | Port | Who Uses It | Access |
|-------------|---------|----------|------|-------------|--------|
| **Dev** | Your coding | Local Supabase | 6100 | You (Mac Studio) | Local only |
| **Staging** | Boys see/test | Mac Studio Supabase | 7100 | Boys, you, demos | Tailscale |
| **Production** | Customer deployment | Customer's Supabase | 9000 | Customers | Their network |

---

## Quick Answer: What Do Customers Use?

### Customer Deployment Model

**Customers deploy their own instance:**
- They get source code (GitHub Template)
- They run `npm run production` on their servers
- They use their own Supabase instance (or direct PostgreSQL)
- It's "production" from their perspective

**What we show them:**
- **Staging** = Demo environment (what we show in sales calls)
- **Production** = Their own deployment (what they run)

**So:**
- **Staging** = Our demo/showcase environment
- **Production** = Their deployment (they run it themselves)

---

## Environment Configuration

### Environment Files

Create three environment files:

```bash
# .env.dev (local development on Mac Studio)
NODE_ENV=development
API_PORT=6100
WEB_PORT=6101
SUPABASE_URL=http://127.0.0.1:6010
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# .env.staging (shared staging on Mac Studio)
NODE_ENV=staging
API_PORT=7100
WEB_PORT=7101
SUPABASE_URL=http://mac-studio-name:9010
SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-key>
# Uses staging database on Mac Studio

# .env.production (customer deployment)
NODE_ENV=production
API_PORT=9000
WEB_PORT=9001
SUPABASE_URL=<customer-supabase-url>
SUPABASE_ANON_KEY=<customer-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<customer-service-key>
# Customer configures their own Supabase
```

### Port Allocation

| Service | Dev | Staging | Production |
|---------|-----|---------|------------|
| API | 6100 | 7100 | 9000 |
| Web | 6101 | 7101 | 9001 |
| Supabase API | 6010 | 9010 | Customer's |
| Supabase Studio | 6015 | 9015 | Customer's |
| N8N | 5678 | 5678 | Customer's |

---

## NPM Scripts

### Add to `package.json`

```json
{
  "scripts": {
    // Development (local on Mac Studio)
    "dev": "cp .env.dev .env && ./start-dev-local.sh",
    "dev:api": "cp .env.dev .env && cd apps/api && ./start-dev.sh",
    "dev:web": "cp .env.dev .env && cd apps/web && npm run dev",
    
    // Staging (shared on Mac Studio - boys see this)
    "staging": "cp .env.staging .env && npm run staging:start",
    "staging:start": "npm run staging:supabase && npm run staging:api && npm run staging:web",
    "staging:supabase": "cd apps/api/supabase && supabase start --config config.staging.toml",
    "staging:api": "cd apps/api && API_PORT=7100 npm run start:prod",
    "staging:web": "cd apps/web && npm run build && PORT=7101 npm run preview",
    "staging:stop": "npm run staging:api:stop && npm run staging:web:stop",
    "staging:logs": "pm2 logs staging-api staging-web",
    
    // Production (customer deployment)
    "production": "cp .env.production .env && npm run production:start",
    "production:start": "npm run production:build && npm run production:serve",
    "production:build": "npm run build",
    "production:serve": "pm2 start ecosystem.production.config.js",
    "production:stop": "pm2 stop all",
    "production:restart": "pm2 restart all",
    "production:logs": "pm2 logs",
    
    // Migration/Promotion
    "promote:dev-to-staging": "npm run migrate:dev-to-staging && npm run staging:restart",
    "promote:staging-to-production": "npm run migrate:staging-to-production && npm run production:restart"
  }
}
```

### PM2 Ecosystem Files

**`ecosystem.staging.config.js`:**
```javascript
module.exports = {
  apps: [
    {
      name: 'staging-api',
      script: 'apps/api/dist/main.js',
      cwd: '/path/to/orchestrator-ai-v2',
      env: {
        NODE_ENV: 'staging',
        API_PORT: 7100,
      },
      env_file: '.env.staging',
      instances: 1,
      exec_mode: 'fork',
    },
    {
      name: 'staging-web',
      script: 'apps/web/dist/server.js',
      cwd: '/path/to/orchestrator-ai-v2',
      env: {
        NODE_ENV: 'staging',
        PORT: 7101,
      },
      env_file: '.env.staging',
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
```

**`ecosystem.production.config.js`:**
```javascript
module.exports = {
  apps: [
    {
      name: 'production-api',
      script: 'apps/api/dist/main.js',
      cwd: '/path/to/orchestrator-ai-v2',
      env: {
        NODE_ENV: 'production',
        API_PORT: 9000,
      },
      env_file: '.env.production',
      instances: 2, // Scale for production
      exec_mode: 'cluster',
    },
    {
      name: 'production-web',
      script: 'apps/web/dist/server.js',
      cwd: '/path/to/orchestrator-ai-v2',
      env: {
        NODE_ENV: 'production',
        PORT: 9001,
      },
      env_file: '.env.production',
      instances: 2,
      exec_mode: 'cluster',
    },
  ],
};
```

---

## Migration Workflow

### Dev → Staging Promotion

**Step 1: Export from Dev**
```bash
# On Mac Studio (dev environment)
npm run dev  # Make sure dev is running

# Export database snapshot
npm run db:export-snapshot

# Export agents/workflows
npm run db:export-all-agents
npm run db:export-all-n8n
```

**Step 2: Apply to Staging**
```bash
# Switch to staging environment
cp .env.staging .env

# Apply database snapshot
npm run db:apply-snapshot

# Import agents/workflows
npm run db:import-all-agents
npm run db:import-all-n8n

# Restart staging
npm run staging:restart
```

**Step 3: Verify Staging**
```bash
# Check staging is running
curl http://mac-studio-name:7100/health

# Check from boys' machines (via Tailscale)
# They should see staging at: http://mac-studio-name:7100
```

**Automated Script: `scripts/promote-dev-to-staging.sh`**
```bash
#!/bin/bash
set -e

echo "🔄 Promoting Dev → Staging..."

# 1. Export from dev
echo "📤 Exporting from dev..."
cp .env.dev .env
npm run db:export-snapshot
npm run db:export-all-agents
npm run db:export-all-n8n

# 2. Apply to staging
echo "📥 Applying to staging..."
cp .env.staging .env
npm run db:apply-snapshot
npm run db:import-all-agents
npm run db:import-all-n8n

# 3. Restart staging
echo "🚀 Restarting staging..."
npm run staging:restart

echo "✅ Promotion complete! Staging is now updated."
echo "📍 Access staging at: http://mac-studio-name:7100"
```

### Staging → Production Promotion

**For Customer Deployment:**

**Step 1: Prepare Production Package**
```bash
# Create production-ready package
npm run production:build

# Export production snapshot
npm run db:export-snapshot
# Save to: deployment/production-snapshot/

# Export agents/workflows
npm run db:export-all-agents
npm run db:export-all-n8n
# Save to: deployment/production-agents/
```

**Step 2: Customer Deployment**
```bash
# Customer runs on their server:
git clone <your-template-repo>
cd orchestrator-ai-v2

# Configure their environment
cp .env.production.example .env.production
# Edit .env.production with their Supabase credentials

# Apply database snapshot
npm run db:apply-snapshot

# Import agents/workflows
npm run db:import-all-agents
npm run db:import-all-n8n

# Start production
npm run production
```

**Automated Script: `scripts/prepare-production-package.sh`**
```bash
#!/bin/bash
set -e

echo "📦 Preparing production package..."

# Build production assets
npm run production:build

# Export database snapshot
mkdir -p deployment/production-snapshot
npm run db:export-snapshot
cp storage/snapshots/latest/* deployment/production-snapshot/

# Export agents/workflows
mkdir -p deployment/production-agents
npm run db:export-all-agents
npm run db:export-all-n8n
cp storage/snapshots/agents/* deployment/production-agents/
cp storage/snapshots/n8n/* deployment/production-agents/

# Create deployment README
cat > deployment/README.md << EOF
# Production Deployment Guide

## Quick Start

1. Configure environment:
   \`\`\`bash
   cp .env.production.example .env.production
   # Edit .env.production with your Supabase credentials
   \`\`\`

2. Apply database snapshot:
   \`\`\`bash
   npm run db:apply-snapshot
   \`\`\`

3. Import agents/workflows:
   \`\`\`bash
   npm run db:import-all-agents
   npm run db:import-all-n8n
   \`\`\`

4. Start production:
   \`\`\`bash
   npm run production
   \`\`\`

## Access

- API: http://localhost:9000
- Web: http://localhost:9001
- Supabase Studio: <your-supabase-studio-url>
EOF

echo "✅ Production package ready in deployment/"
```

---

## Daily Workflow

### Your Workflow (Mac Studio)

**Morning: Start Development**
```bash
# On Mac Studio
cd /path/to/orchestrator-ai-v2
npm run dev

# Code, test, develop
# Uses local Supabase (port 6010)
# Fast, isolated, safe
```

**When Ready: Promote to Staging**
```bash
# Promote dev → staging
npm run promote:dev-to-staging

# Boys can now see your changes
# They access via: http://mac-studio-name:7100
```

**Evening: Check Staging**
```bash
# View staging logs
npm run staging:logs

# Test staging from boys' perspective
curl http://mac-studio-name:7100/health
```

### Boys' Workflow

**Connect to Staging**
```bash
# On their machines (via Tailscale)
# They can:
npm run staging:api    # Connect to staging API
npm run staging:web    # Connect to staging web

# Or just access via browser:
# http://mac-studio-name:7100 (API)
# http://mac-studio-name:7101 (Web)
```

**Develop Against Staging**
```bash
# Boys develop locally but test against staging
cp .env.staging .env
npm run dev:api

# Their local API connects to staging Supabase
# They see shared data, can test together
```

**Promote Their Work to Staging**
```bash
# Boys push their changes
git push origin feature-branch

# You review and promote
npm run promote:dev-to-staging
```

---

## Customer Deployment Workflow

### What Customers Do

**1. Get Source Code**
```bash
# Customer clones template repo
git clone <your-github-template>
cd orchestrator-ai-v2
```

**2. Configure Their Environment**
```bash
# Customer sets up their Supabase (or PostgreSQL)
# They configure .env.production with their credentials
cp .env.production.example .env.production
# Edit .env.production
```

**3. Deploy**
```bash
# Customer runs on their server
npm run production

# This:
# - Builds production assets
# - Applies database snapshot
# - Imports agents/workflows
# - Starts production servers (PM2)
```

**4. Access**
```bash
# Customer accesses on their network:
# http://their-server:9000 (API)
# http://their-server:9001 (Web)
```

### What We Show Customers

**Sales Demo:**
- Show them **staging** environment
- `https://staging.yourdomain.com` (via Cloudflare)
- They see what the product looks like

**After Sale:**
- They deploy their own **production** instance
- They run `npm run production` on their servers
- It's "production" from their perspective

---

## Database Migration Strategy

### Snapshot-Based (Current System)

**Export Snapshot:**
```bash
npm run db:export-snapshot
# Creates: storage/snapshots/latest/schema.sql
#         storage/snapshots/latest/seed.sql
```

**Apply Snapshot:**
```bash
# To staging
cp .env.staging .env
npm run db:apply-snapshot

# To production (customer)
cp .env.production .env
npm run db:apply-snapshot
```

### Migration Script: `scripts/migrate-dev-to-staging.sh`

```bash
#!/bin/bash
set -e

echo "🔄 Migrating Dev → Staging..."

# 1. Stop staging (if running)
echo "⏸️  Stopping staging..."
npm run staging:stop || true

# 2. Export from dev
echo "📤 Exporting from dev..."
cp .env.dev .env
npm run db:export-snapshot

# 3. Backup staging database
echo "💾 Backing up staging..."
cp .env.staging .env
pg_dump $DATABASE_URL > staging-backup-$(date +%Y%m%d-%H%M%S).sql

# 4. Apply to staging
echo "📥 Applying to staging..."
npm run db:apply-snapshot

# 5. Import agents/workflows
echo "📦 Importing agents/workflows..."
npm run db:import-all-agents
npm run db:import-all-n8n

# 6. Restart staging
echo "🚀 Restarting staging..."
npm run staging:start

echo "✅ Migration complete!"
echo "📍 Staging: http://mac-studio-name:7100"
```

---

## Access Patterns

### Development (Mac Studio)

```bash
# Local access only
http://localhost:6100  # API
http://localhost:6101  # Web
http://localhost:6015  # Supabase Studio
```

### Staging (Mac Studio - Boys See This)

```bash
# Via Tailscale (private)
http://mac-studio-name:7100  # API
http://mac-studio-name:7101  # Web
http://mac-studio-name:9015  # Supabase Studio

# Via Cloudflare (public demo)
https://staging.yourdomain.com  # API
https://staging-web.yourdomain.com  # Web
```

### Production (Customer Deployment)

```bash
# On customer's network
http://customer-server:9000  # API
http://customer-server:9001  # Web
# Customer configures their own Supabase Studio
```

---

## Quick Reference Commands

### Development
```bash
npm run dev              # Start dev (local)
npm run dev:api          # Start dev API only
npm run dev:web          # Start dev web only
npm run dev:supabase     # Check Supabase status
```

### Staging
```bash
npm run staging          # Start staging (boys see this)
npm run staging:start    # Start staging services
npm run staging:stop     # Stop staging
npm run staging:restart  # Restart staging
npm run staging:logs     # View staging logs
```

### Production
```bash
npm run production       # Start production (customer)
npm run production:build # Build production assets
npm run production:start # Start production services
npm run production:stop  # Stop production
npm run production:logs  # View production logs
```

### Promotion
```bash
npm run promote:dev-to-staging        # Dev → Staging
npm run promote:staging-to-production # Staging → Production (prepare package)
```

---

## Summary

### Your Workflow

1. **Code on Mac Studio** → `npm run dev` (local, fast)
2. **Promote to Staging** → `npm run promote:dev-to-staging` (boys see)
3. **Prepare Production Package** → `npm run prepare-production-package` (for customers)

### Boys' Workflow

1. **Access Staging** → `http://mac-studio-name:7100` (via Tailscale)
2. **Develop Locally** → Connect to staging Supabase
3. **Push Changes** → You promote to staging

### Customer Workflow

1. **Get Source Code** → Clone GitHub template
2. **Configure** → Set up their Supabase
3. **Deploy** → `npm run production` (on their servers)
4. **Access** → On their network (inside firewall)

### Key Points

- **Dev** = Your coding environment (local, fast)
- **Staging** = What boys see, demo environment
- **Production** = Customer's deployment (they run it themselves)
- **Promotion** = Easy scripts to move between environments
- **Customers** = Deploy their own instance (inside their firewall)

This gives you a clean, professional deployment workflow that scales from development to customer deployments!

