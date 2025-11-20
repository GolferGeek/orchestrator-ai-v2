# Phase 0 Implementation Plan: Port & Environment Configuration

## Overview

Phase 0 establishes consistent port assignments and comprehensive environment configuration across all services. This must be completed first to prevent breaking changes during development.

## Port Assignments (Target State)

| Service | Current Port | New Port | Purpose |
|---------|--------------|----------|---------|
| API (NestJS) | 7100 | **6100** | Main Orchestrator AI API |
| Web/Frontend | 7101 | 6101 | Vue + Ionic frontend |
| LangGraph | 7200 | **6200** | LangGraph agents service |
| Supabase API | 7010 | **6010** | Local Supabase API |
| Supabase Studio | 7011 | 6011 | Supabase Studio UI |
| Supabase DB | 7012 | 6012 | PostgreSQL database |
| N8n | 5678 | 5678 | N8n workflows (keep same) |
| Observability | ? | 6300 | Observability server (if needed) |

## Files to Update

### 1. Root `.env` and `.env.example`
**Locations:**
- `/Users/golfergeek/projects/orchAI/orchestrator-ai-v2/.env` (active environment file)
- `/Users/golfergeek/projects/orchAI/orchestrator-ai-v2/.env.example` (template for users)

**Current Issues:**
- Duplicate sections (API keys repeated, Helicone repeated)
- Disorganized structure
- Port 7100 used throughout
- Missing clear categories
- **Both files need same organization and structure**

**Important:** Update BOTH `.env` and `.env.example` with same structure

**Required Changes:**
```env
# ===== PORT CONFIGURATION =====
API_PORT=6100
WEB_PORT=6101
VITE_WEB_PORT=6101

# ===== SUPABASE LOCAL CONFIGURATION =====
SUPABASE_URL=http://127.0.0.1:6010
# ... rest of Supabase config

# ===== VITE CONFIGURATION =====
VITE_API_BASE_URL=http://localhost:6100
VITE_API_NESTJS_BASE_URL=http://localhost:6100
VITE_SUPABASE_URL=http://127.0.0.1:6010

# ===== N8N CONFIGURATION =====
N8N_HOST=localhost
N8N_PORT=5678
N8N_WEBHOOK_URL=http://localhost:5678

# ... rest of config
```

**Cleanup Tasks:**
- Remove duplicate API key sections
- Remove duplicate Helicone sections
- Remove duplicate Voice/Notion sections
- Organize by clear categories
- Add comments explaining each section
- Mark required vs optional variables

### 2. LangGraph `.env.example`
**Location:** `/Users/golfergeek/projects/orchAI/orchestrator-ai-v2/apps/langgraph/.env.example`

**Required Changes:**
```env
# LangGraph Application
LANGGRAPH_PORT=6200
LANGGRAPH_HOST=0.0.0.0

# LLM Service Integration
LLM_SERVICE_URL=http://localhost:6100
LLM_ENDPOINT=/llm/generate

# Webhook Configuration
WEBHOOK_STATUS_URL=http://localhost:6100/webhooks/status

# Optional
NODE_ENV=development
LOG_LEVEL=debug
```

### 3. N8n `.env.example`
**Location:** `/Users/golfergeek/projects/orchAI/orchestrator-ai-v2/apps/n8n/.env.example`

**Current:** Minimal, needs expansion

**Required Changes:**
```env
# N8n Configuration
N8N_HOST=localhost
N8N_PORT=5678
N8N_WEBHOOK_URL=http://localhost:5678

# N8n API (for MCP integration)
N8N_API_URL=localhost:5678
N8N_PROTOCOL=http
N8N_API_KEY=your-n8n-api-key-here

# Orchestrator AI API Integration
ORCHESTRATOR_API_URL=http://localhost:6100
ORCHESTRATOR_WEBHOOK_STATUS_URL=http://localhost:6100/webhooks/status

# Note: N8n is for intern prototype development only
# Not part of v2-start user-facing features
```

### 4. Observability `.env.example`
**Location:** `/Users/golfergeek/projects/orchAI/orchestrator-ai-v2/apps/observability/server/.env.example`

**Check if this exists and needs port updates**

### 5. Web/Frontend `.env` files
**Location:** `/Users/golfergeek/projects/orchAI/orchestrator-ai-v2/apps/web/`

**Check for:**
- `.env`
- `.env.example`
- `tests/.env.test`

**Required Changes:**
```env
VITE_API_BASE_URL=http://localhost:6100
VITE_API_NESTJS_BASE_URL=http://localhost:6100
VITE_SUPABASE_URL=http://127.0.0.1:6010
```

### 6. Supabase Configuration
**Location:** `/Users/golfergeek/projects/orchAI/orchestrator-ai-v2/apps/api/supabase/config.toml` (if exists)

**Required Changes:**
- Update API port to 6010
- Update Studio port to 6011
- Update DB port to 6012

### 7. Docker Compose Files
**Location:** Search for `docker-compose.yml` files

**Required Changes:**
- Update port mappings to new port scheme
- Note: These will be removed in Phase 10, but update for now

### 8. Package.json Scripts
**Locations:**
- Root `package.json`
- `apps/api/package.json`
- `apps/langgraph/package.json`
- `apps/web/package.json`

**Update any hardcoded ports in npm scripts**

## Code Files to Update

### Search for Hardcoded Ports

**Search patterns:**
```bash
# Search for port 7100
grep -r "7100" --include="*.ts" --include="*.js" --exclude-dir=node_modules

# Search for port 7200
grep -r "7200" --include="*.ts" --include="*.js" --exclude-dir=node_modules

# Search for port 7010
grep -r "7010" --include="*.ts" --include="*.js" --exclude-dir=node_modules
```

**Common locations:**
- API configuration files
- LangGraph configuration files
- Frontend service files
- Test files
- Example/demo files

## Implementation Steps

### Step 1: Create Comprehensive Root .env and .env.example
1. Read current `.env` and `.env.example`
2. Remove duplicates from both files
3. Organize by categories (same structure in both files):
   - Port Configuration
   - Supabase Configuration
   - N8n Configuration (mark as optional)
   - LangGraph Configuration
   - LLM Providers (Anthropic, OpenAI, Google, etc.)
   - Additional Services (Helicone, Deepgram, ElevenLabs, Notion, Firecrawl)
   - Agent Configuration
   - A2A Protocol Configuration
   - Feature Flags
   - Sovereign Mode Configuration
   - Development/Testing
4. Add clear comments for each section (both files)
5. Mark required vs optional variables (both files)
6. Update all ports to new scheme (both files)
7. Add section headers with visual separators (both files)
8. **`.env`** - Keep actual values (for local development)
9. **`.env.example`** - Use placeholder/example values (for distribution)

### Step 2: Update Service-Specific .env.example Files
1. **LangGraph** - Update ports, add clear comments
2. **N8n** - Expand with all needed variables, mark as optional/intern-only
3. **Observability** - Update if exists
4. **Web** - Update Vite variables

### Step 3: Update Supabase Configuration
1. Check for `config.toml` or equivalent
2. Update ports: API 6010, Studio 6011, DB 6012
3. Document Supabase setup process

### Step 4: Search and Replace Hardcoded Ports
1. Run grep searches for 7100, 7200, 7010
2. Update TypeScript/JavaScript files
3. Update configuration files
4. Update test files
5. **DO NOT update:**
   - Dependencies in node_modules
   - Generated files
   - Lock files

### Step 5: Update Package.json Scripts
1. Check all package.json files
2. Update any scripts with hardcoded ports
3. Ensure consistency across all apps

### Step 6: Update Docker Compose (if exists)
1. Find docker-compose files
2. Update port mappings
3. Add note that these will be removed in Phase 10

### Step 7: Update Documentation
1. Create port assignment reference doc
2. Update any existing setup docs
3. Document environment variable categories

### Step 8: Verification
1. Start each service with new ports
2. Verify services can communicate
3. Test frontend → API → database flow
4. Test LangGraph → API flow
5. Test N8n → API flow (if applicable)

## Environment Variable Categories

### Required Variables (for v2-start)
```env
# Ports
API_PORT=6100
WEB_PORT=6101
LANGGRAPH_PORT=6200

# Supabase (local)
SUPABASE_URL=http://127.0.0.1:6010
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# At least one LLM provider
ANTHROPIC_API_KEY=... # OR
OPENAI_API_KEY=... # OR
OLLAMA_BASE_URL=http://localhost:11434 # (local)

# Agent Base URL
AGENT_BASE_URL=http://localhost
```

### Optional Variables
```env
# N8n (for intern prototypes only, not v2-start)
N8N_HOST=localhost
N8N_PORT=5678

# Additional LLM providers
PERPLEXITY_API_KEY=...
GROK_API_KEY=...
GOOGLE_API_KEY=...

# Additional services
HELICONE_API_KEY=...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
NOTION_API_KEY=...
FIRECRAWL_API_KEY=...

# Feature flags
ENABLE_EXTERNAL_AGENTS=false
FEATURE_FLAG_SOVEREIGN_ROUTING_ENABLED=false
```

## Acceptance Criteria

- [ ] Root `.env` cleaned up, organized, and documented
- [ ] Root `.env.example` cleaned up, organized, and documented (same structure as `.env`)
- [ ] All duplicate sections removed from both `.env` and `.env.example`
- [ ] Both files have identical structure and categories
- [ ] `.env.example` has placeholder values, `.env` has actual values
- [ ] LangGraph `.env.example` updated with port 6200
- [ ] N8n `.env.example` expanded and documented
- [ ] Web `.env` files updated
- [ ] Supabase configuration updated for ports 6010/6011/6012
- [ ] All hardcoded port references updated in code
- [ ] Package.json scripts updated
- [ ] Docker compose files updated (if exist)
- [ ] Port assignment reference doc created
- [ ] All services start successfully on new ports
- [ ] Services can communicate with each other
- [ ] No port conflicts

## Testing Plan

### Manual Testing
1. **API Service:**
   ```bash
   cd apps/api
   npm run dev
   # Should start on port 6100
   ```

2. **LangGraph Service:**
   ```bash
   cd apps/langgraph
   npm run dev
   # Should start on port 6200
   ```

3. **Web Frontend:**
   ```bash
   cd apps/web
   npm run dev
   # Should start on port 6101
   ```

4. **Supabase:**
   ```bash
   supabase start
   # API should be on 6010
   # Studio should be on 6011
   # DB should be on 6012
   ```

5. **Cross-Service Communication:**
   - Frontend can call API
   - API can query Supabase
   - LangGraph can call API LLM service
   - LangGraph can send webhooks to API

## Risks & Mitigation

**Risk:** Breaking running services during port changes
- **Mitigation:** Update all configs together, test incrementally

**Risk:** Missing hardcoded port references
- **Mitigation:** Comprehensive grep search, manual code review

**Risk:** Port conflicts with other services
- **Mitigation:** Document port assignments, check for conflicts before starting

## Notes

- Phase 0 is critical - all subsequent phases depend on this
- Take time to get environment configuration right
- Comprehensive .env.example is essential for educational purposes
- Clear comments and organization help learners understand the system
- N8n configuration should be marked as optional/intern-only
- **Important:** Both `.env` and `.env.example` must have identical structure
  - `.env` = working file with actual values (gitignored)
  - `.env.example` = template with placeholder values (committed to repo)
- Keep `.env` and `.env.example` in sync throughout development

## Next Steps

After Phase 0 completion:
- Phase 1: Agent Infrastructure (agent table, organizations)
- All services will use consistent, documented port scheme
