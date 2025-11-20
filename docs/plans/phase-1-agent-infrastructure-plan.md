# Phase 1 Implementation Plan: Agent Infrastructure

## Overview

Phase 1 establishes the core agent infrastructure with a normalized database schema AND restructures files for better organization. This includes creating the agents table, organizations table, seed files, and consolidating all database and workflow files into their proper locations.

## Goals

1. **File Restructuring:**
   - Move all database snapshots/scripts to `apps/api/supabase/`
   - Create `apps/n8n/workflows/` for N8n workflow backups
   - Consolidate all database-related files under Supabase

2. **Database Schema:**
   - Create agents table migration with all normalized columns
   - Create organizations table migration
   - Create seed files for organizations and initial agents

3. **Documentation:**
   - Document the schema and usage patterns
   - Update script references to new paths

## Database Schema Design

### Agents Table

**Final Schema:**
```sql
CREATE TABLE agents (
  -- Identity & Organization
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_slug TEXT[] NOT NULL,  -- Array of org slugs (multi-org support)
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),

  -- Discovery / Agent Card (External)
  io_schema JSONB NOT NULL,           -- Input/output schemas
  capabilities JSONB NOT NULL,         -- What the agent can do
  tags TEXT[],                         -- Categorization tags

  -- Operational Config (Internal)
  context TEXT,                        -- System prompt OR prompt enhancement
  endpoint JSONB,                      -- NULL for context agents, routing + auth for API agents
  mode_profile TEXT NOT NULL DEFAULT 'converse', -- plan-build-converse, build-only, etc.
  llm_config JSONB,                   -- Default LLM config (provider, model, temperature)
  timeout_ms INTEGER NOT NULL DEFAULT 120000,
  retry_config JSONB,                 -- max_attempts, backoff strategy

  -- Metadata & Organization
  department TEXT,                    -- marketing, hr, engineering, etc.
  agent_type TEXT NOT NULL CHECK (agent_type IN ('context', 'api', 'external')),
  metadata JSONB,                     -- Catch-all for agent-specific extras

  -- Optional/Extended
  plan_structure TEXT,                -- Template for plan mode
  deliverable_structure JSONB,        -- Template for deliverables

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_slug_per_org UNIQUE (slug, (organization_slug[1]))
);

-- Indexes for query performance
CREATE INDEX idx_agents_org_slug ON agents USING GIN (organization_slug);
CREATE INDEX idx_agents_status ON agents (status);
CREATE INDEX idx_agents_type ON agents (agent_type);
CREATE INDEX idx_agents_department ON agents (department);
```

### Organizations Table

**Final Schema:**
```sql
CREATE TABLE organizations (
  slug TEXT PRIMARY KEY,              -- Organization identifier (not UUID)
  name TEXT NOT NULL,                 -- Display name
  description TEXT,                   -- Optional description
  url TEXT,                           -- Optional organization URL/website
  settings JSONB,                     -- Organization-level settings
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Design Decisions:**
- `slug` is PRIMARY KEY (not UUID) for simplicity and readability
- Agents reference orgs via TEXT[] array containing org slugs
- No foreign key constraints initially (may add later)
- JSONB settings for future extensibility

## Implementation Steps

### Step 0: File Restructuring (Do First)

#### Step 0.1: Consolidate Supabase Files

**Tasks:**
1. Create `apps/api/supabase/seeds/` directory
2. Create `apps/api/supabase/snapshots/` directory
3. Move `storage/snapshots/` → `apps/api/supabase/snapshots/`
4. Move `storage/scripts/` → `apps/api/supabase/scripts/`
5. Update any script references to new paths

**Commands:**
```bash
# Create directories
mkdir -p apps/api/supabase/seeds
mkdir -p apps/api/supabase/snapshots

# Move existing files
mv storage/snapshots/* apps/api/supabase/snapshots/ 2>/dev/null || true
mv storage/scripts/* apps/api/supabase/scripts/ 2>/dev/null || true
```

**Final Structure:**
```
apps/api/supabase/
├── migrations/          # Schema migrations (already exists)
├── seeds/              # Initial data seeds (NEW)
├── snapshots/          # Database snapshots/backups (MOVED)
├── scripts/            # Database utility scripts (MOVED)
└── config.toml         # Supabase configuration
```

#### Step 0.2: Create N8n Workflows Directory

**Tasks:**
1. Create `apps/n8n/workflows/` directory
2. Add README explaining purpose
3. Optionally move existing N8n workflow files from storage

**Commands:**
```bash
# Create directory
mkdir -p apps/n8n/workflows

# Create README
cat > apps/n8n/workflows/README.md << 'EOF'
# N8n Workflows

This directory contains N8n workflow backups (JSON exports).

## Purpose
- Backup and version control N8n workflows
- Reference implementations for agents
- Manual import when setting up new N8n instances

## Note
N8n workflow migrations are complex. These files are for backup and reference only.
Workflows must be imported manually into N8n instances.

## Workflow Files
- Each workflow is a JSON export from N8n
- File naming: `workflow-name.json`
- Include version and description in workflow JSON
EOF
```

**Final Structure:**
```
apps/n8n/
├── workflows/          # N8n workflow backups (NEW)
│   └── README.md
├── docker-compose.yml  # Already exists
├── .env               # Already exists
└── .env.example       # Already exists
```

#### Step 0.3: Update Script References

**Tasks:**
1. Check package.json scripts for references to `storage/scripts/`
2. Update all references to `apps/api/supabase/scripts/`
3. Test scripts still work

**Scripts to Update:**
```json
// In package.json, update paths like:
"db:export-snapshot": "bash apps/api/supabase/scripts/export-snapshot.sh",
"db:apply-snapshot": "bash apps/api/supabase/scripts/apply-snapshot.sh",
// etc.
```

#### Step 0.4: Document for Phase 7

**Note for Phase 7 (Cleanup):**
- Remove `storage/` directory entirely (or archive)
- All database files now in `apps/api/supabase/`
- All N8n workflow backups in `apps/n8n/workflows/`

---

### Step 1: Create Organizations Table Migration

**File:** `apps/api/supabase/migrations/YYYYMMDDHHMMSS_create_organizations_table.sql`

**Tasks:**
1. Create migration file with proper timestamp
2. Add organizations table schema
3. Add comments documenting each column
4. Test migration locally

**Migration Content:**
```sql
-- Create organizations table
-- Organizations are identified by slug (not UUID)
-- Agents can belong to multiple organizations

CREATE TABLE organizations (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add helpful comments
COMMENT ON TABLE organizations IS 'Organizations that own agents';
COMMENT ON COLUMN organizations.slug IS 'Unique organization identifier (used in URLs and agent references)';
COMMENT ON COLUMN organizations.name IS 'Display name for the organization';
COMMENT ON COLUMN organizations.settings IS 'Organization-level settings and configuration';
```

### Step 2: Create Agents Table Migration

**File:** `apps/api/supabase/migrations/YYYYMMDDHHMMSS_create_agents_table.sql`

**Tasks:**
1. Create migration file with proper timestamp (after organizations)
2. Add agents table schema
3. Add indexes
4. Add constraints
5. Add comments documenting each column and design decisions
6. Test migration locally

**Migration Content:**
See full schema above, plus comments:
```sql
-- Add helpful comments
COMMENT ON TABLE agents IS 'Agent definitions - normalized structure with all config in columns';
COMMENT ON COLUMN agents.organization_slug IS 'Array of organization slugs (multi-org support)';
COMMENT ON COLUMN agents.context IS 'System prompt for context agents, prompt enhancement for API agents';
COMMENT ON COLUMN agents.endpoint IS 'API endpoint config for api/external agents (NULL for context agents)';
COMMENT ON COLUMN agents.io_schema IS 'Input/output JSON schemas (required for agent card)';
COMMENT ON COLUMN agents.capabilities IS 'Functional capabilities (required for agent card)';
COMMENT ON COLUMN agents.llm_config IS 'Default LLM config - UI pre-fills from this, user can override';
```

### Step 3: Create Organizations Seed File

**File:** `apps/api/supabase/seeds/01_organizations.sql`

**Tasks:**
1. Create seed file for default organizations
2. Include demo organization
3. Include global organization (if needed)
4. Document what each organization is for

**Seed Content:**
```sql
-- Default organizations for development and testing
-- These are created on initial setup

INSERT INTO organizations (slug, name, description, url, settings) VALUES
  ('demo', 'Demo Organization', 'Default organization for demo and testing', NULL, '{}'::jsonb),
  ('global', 'Global Organization', 'Shared global resources', NULL, '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
```

### Step 4: Create Agents Seed File

**File:** `apps/api/supabase/seeds/02_agents.sql`

**Tasks:**
1. Create seed file with placeholder agents
2. Define 3 core starting agents:
   - Blog Post Writer (context agent)
   - Marketing Swarm (placeholder for future LangGraph agent)
   - HR Assistant (placeholder for future LangGraph agent)
3. Ensure all required fields are populated
4. Use realistic example data

**Seed Content Example (Blog Post Writer):**
```sql
-- Blog Post Writer - Context Agent
INSERT INTO agents (
  organization_slug,
  slug,
  display_name,
  description,
  version,
  status,
  io_schema,
  capabilities,
  tags,
  context,
  endpoint,
  mode_profile,
  llm_config,
  timeout_ms,
  retry_config,
  department,
  agent_type,
  metadata,
  plan_structure,
  deliverable_structure
) VALUES (
  ARRAY['demo'],
  'blog-post-writer',
  'Blog Post Writer',
  'Creates SEO-friendly blog posts with engaging content and proper structure',
  '1.0',
  'active',
  '{
    "input": {
      "type": "object",
      "properties": {
        "topic": {"type": "string", "description": "Blog post topic"},
        "keywords": {"type": "array", "items": {"type": "string"}, "description": "SEO keywords to include"},
        "word_count": {"type": "number", "description": "Target word count", "default": 1000}
      },
      "required": ["topic"]
    },
    "output": {
      "type": "object",
      "properties": {
        "status": {"type": "string", "enum": ["success", "needs_revision", "failed"]},
        "blog_post": {
          "type": "object",
          "properties": {
            "title": {"type": "string"},
            "content": {"type": "string"},
            "meta_description": {"type": "string"},
            "seo_score": {"type": "number"}
          }
        }
      },
      "required": ["status", "blog_post"]
    }
  }'::jsonb,
  '{
    "can_generate": ["blog_posts", "articles", "content"],
    "supports_modes": ["plan", "build", "converse"],
    "languages": ["english"],
    "output_formats": ["markdown", "html"],
    "features": ["seo_optimization", "keyword_targeting", "readability_analysis"]
  }'::jsonb,
  ARRAY['content', 'writing', 'marketing'],
  'You are an expert blog post writer specializing in creating SEO-friendly, engaging content.

Your responsibilities:
- Create compelling, well-structured blog posts
- Optimize content for search engines using provided keywords
- Ensure proper readability and engagement
- Follow best practices for blog writing
- Structure content with clear headings and sections

Always provide:
1. A catchy, SEO-optimized title
2. Well-organized content with H2/H3 headings
3. Natural keyword integration
4. A meta description for SEO
5. Internal linking suggestions when relevant',
  NULL,
  'plan-build-converse',
  '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.7,
    "maxTokens": 4000
  }'::jsonb,
  180000,
  '{
    "max_attempts": 2,
    "backoff": "exponential"
  }'::jsonb,
  'marketing',
  'context',
  '{}'::jsonb,
  NULL,
  '{
    "format": "markdown",
    "type": "blog-post",
    "sections": ["title", "introduction", "body", "conclusion", "meta"]
  }'::jsonb
) ON CONFLICT (slug, (organization_slug[1])) DO NOTHING;
```

### Step 5: Create Master Seed Script

**File:** `apps/api/supabase/seed.sql`

**Tasks:**
1. Create master seed script that runs all seed files in order
2. Include both organizations and agents
3. Add clear comments

**Content:**
```sql
-- Master seed file - runs all seeds in order
-- This file is referenced in supabase/config.toml

-- 1. Organizations (must be first)
\i seeds/01_organizations.sql

-- 2. Agents (requires organizations)
\i seeds/02_agents.sql
```

### Step 6: Update Supabase Config

**File:** `apps/api/supabase/config.toml`

**Tasks:**
1. Verify seed file path is correct
2. Ensure migrations are enabled
3. Document seed process

**Check:**
```toml
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

### Step 7: Test Migrations and Seeds

**Tasks:**
1. Reset local Supabase: `cd apps/api && supabase db reset`
2. Verify organizations table created
3. Verify agents table created
4. Verify seed data inserted
5. Query data to confirm structure

**Test Commands:**
```bash
# Reset and apply migrations + seeds
cd apps/api
supabase db reset

# Check tables exist
psql $DATABASE_URL -c "\d organizations"
psql $DATABASE_URL -c "\d agents"

# Check seed data
psql $DATABASE_URL -c "SELECT * FROM organizations;"
psql $DATABASE_URL -c "SELECT slug, display_name, agent_type FROM agents;"
```

### Step 8: Document Schema

**File:** `docs/database/schema.md`

**Tasks:**
1. Document agents table structure
2. Document organizations table structure
3. Explain column usage by agent type
4. Provide examples of each agent type

## Acceptance Criteria

### File Restructuring
- [ ] `apps/api/supabase/seeds/` directory created
- [ ] `apps/api/supabase/snapshots/` directory created
- [ ] Files moved from `storage/snapshots/` to `apps/api/supabase/snapshots/`
- [ ] Files moved from `storage/scripts/` to `apps/api/supabase/scripts/`
- [ ] `apps/n8n/workflows/` directory created
- [ ] `apps/n8n/workflows/README.md` created
- [ ] package.json script paths updated to new locations
- [ ] All scripts tested and working with new paths

### Database Schema
- [ ] Organizations table migration created and tested
- [ ] Agents table migration created and tested
- [ ] Organizations seed file created (demo, global orgs)
- [ ] Agents seed file created (3 starting agents)
- [ ] Master seed.sql file created
- [ ] Supabase config references seed.sql correctly
- [ ] `supabase db reset` works successfully
- [ ] All seed data inserts correctly
- [ ] Indexes created and working
- [ ] Constraints enforce data integrity
- [ ] Schema documentation created
- [ ] Blog Post Writer agent fully defined in seed

## Files to Create/Move

### Directories to Create
1. `apps/api/supabase/seeds/`
2. `apps/api/supabase/snapshots/`
3. `apps/n8n/workflows/`

### Files to Move
1. `storage/snapshots/*` → `apps/api/supabase/snapshots/`
2. `storage/scripts/*` → `apps/api/supabase/scripts/`
3. Optionally: `storage/snapshots/n8n/*` → `apps/n8n/workflows/`

### Files to Create
1. `apps/n8n/workflows/README.md`
2. `apps/api/supabase/migrations/YYYYMMDDHHMMSS_create_organizations_table.sql`
3. `apps/api/supabase/migrations/YYYYMMDDHHMMSS_create_agents_table.sql`
4. `apps/api/supabase/seeds/01_organizations.sql`
5. `apps/api/supabase/seeds/02_agents.sql`
6. `apps/api/supabase/seed.sql`
7. `docs/database/schema.md`

### Files to Update
1. `package.json` - Update script paths from `storage/scripts/` to `apps/api/supabase/scripts/`

## Migration File Naming

Use timestamp format: `YYYYMMDDHHMMSS_description.sql`

Example:
- `20250120150000_create_organizations_table.sql`
- `20250120150100_create_agents_table.sql`

## Testing Plan

### Manual Testing

1. **Fresh Database:**
   ```bash
   cd apps/api
   supabase db reset
   ```

2. **Verify Organizations:**
   ```sql
   SELECT * FROM organizations;
   -- Should return: demo, global
   ```

3. **Verify Agents:**
   ```sql
   SELECT slug, display_name, agent_type FROM agents;
   -- Should return: blog-post-writer (context)
   ```

4. **Test Constraints:**
   ```sql
   -- Should fail (duplicate slug in same org)
   INSERT INTO agents (organization_slug, slug, ...)
   VALUES (ARRAY['demo'], 'blog-post-writer', ...);

   -- Should succeed (same slug in different org)
   INSERT INTO agents (organization_slug, slug, ...)
   VALUES (ARRAY['global'], 'blog-post-writer', ...);
   ```

5. **Test Indexes:**
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM agents WHERE 'demo' = ANY(organization_slug);
   -- Should use GIN index
   ```

## Notes

- Organizations table MUST be created before agents table
- Agent slugs are unique per organization (first org in array)
- All JSONB fields should have default values or be nullable
- Context agents have NULL endpoint
- API/external agents have NULL or optional context
- Blog Post Writer is fully defined and ready to use after Phase 2
- Marketing Swarm and HR Assistant are placeholders (implemented in later phases)

## Next Steps

After Phase 1 completion:
- Phase 1.5: Agent Discovery & Runner Cleanup
- Agents table ready for use
- Can build Blog Post Writer agent in Phase 2 validation checkpoint

## Questions to Resolve

1. Should we add foreign key constraints from agents to organizations now or later?
2. Do we need a trigger to update `updated_at` automatically?
3. Should we add any additional indexes based on expected query patterns?

## Dependencies

- Supabase running locally (port 6010)
- PostgreSQL 17 with JSONB support
- Migration tooling working
