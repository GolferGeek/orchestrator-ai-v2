# Phase 1 PRD: Agent Infrastructure & Table Design

## Overview

Phase 1 establishes the foundational agent infrastructure for Orchestrator AI v2. This includes finalizing the agent table structure, eliminating agent JSON files in favor of database-as-source-of-truth, creating the organizations table, and establishing seed files for initialization.

## Goals

1. Finalize normalized agent table structure with all required columns
2. Establish database as single source of truth (no agent JSON files)
3. Create organizations table for multi-tenancy
4. Create comprehensive seed files for initialization
5. Document agent table structure and usage patterns

## Key Decisions Made

### Agent Table Philosophy
- **Database is source of truth** - No agent JSON files needed
- **Normalized structure** - Break out known fields into columns instead of hiding in YAML/JSON blobs
- **Multi-org support** - Agents can belong to multiple organizations via TEXT[] array
- **Both io_schema AND capabilities required** - These are different and both essential

### Column Usage by Agent Type

**Context Agents:**
- Use: `yaml`, `context`, `io_schema`, `capabilities`, `llm_config`, `mode_profile`
- Ignore: `endpoint`
- `context` = full system prompt defining agent behavior

**API/External Agents:**
- Use: `yaml`, `context`, `endpoint`, `io_schema`, `capabilities`, `timeout_ms`, `retry_config`
- `context` = prompt enhancement instructions (transform user prompt before sending to API)
- `endpoint` JSONB = routing configuration with authentication

## Final Agent Table Structure

```sql
CREATE TABLE agents (
  -- Identity & Organization
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_slug TEXT[] NOT NULL, -- Array of org slugs (multi-org support)
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
  llm_config JSONB,                   -- Default LLM (provider, model, temperature) - UI pre-fills, user can override
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

  -- Constraints & Indexes
  CONSTRAINT unique_slug_per_org UNIQUE (slug, (organization_slug[1]))
);

-- Indexes for query performance
CREATE INDEX idx_agents_org_slug ON agents USING GIN (organization_slug);
CREATE INDEX idx_agents_status ON agents (status);
CREATE INDEX idx_agents_type ON agents (agent_type);
CREATE INDEX idx_agents_department ON agents (department);
```

## Column Descriptions

### Identity & Organization

- **id**: UUID primary key, auto-generated
- **organization_slug**: Array of organization slugs (TEXT[]) - agent can belong to multiple orgs
- **slug**: Agent identifier, unique within first org in array
- **display_name**: Human-readable name for UI display
- **description**: Agent description for discovery and UI
- **version**: Version string (default '1.0')
- **status**: Agent status (active, inactive, archived)

### Discovery / Agent Card

- **io_schema** (JSONB): Input/output JSON schemas defining data contracts
  ```json
  {
    "input": { "type": "object", "properties": {...}, "required": [...] },
    "output": { "type": "object", "properties": {...}, "required": [...] }
  }
  ```

- **capabilities** (JSONB): Functional capabilities for discovery
  ```json
  {
    "can_generate": ["blog_posts", "articles"],
    "supports_modes": ["plan", "build", "converse"],
    "languages": ["english"],
    "output_formats": ["markdown", "html"],
    "features": ["seo_optimization"]
  }
  ```

- **tags** (TEXT[]): Categorization tags (e.g., ["content", "writing", "marketing"])

### Operational Config

- **context** (TEXT):
  - For context agents: Full system prompt
  - For API agents: Prompt enhancement/transformation instructions

- **endpoint** (JSONB): API routing and authentication config (NULL for context agents)
  ```json
  {
    "url": "http://localhost:7200/workflows/marketing-swarm",
    "method": "POST",
    "authentication": {
      "type": "bearer",
      "token_env": "LANGGRAPH_API_KEY",
      "header": "Authorization"
    },
    "webhooks": {
      "status": "{{env.AGENT_BASE_URL}}:{{env.API_PORT}}/webhooks/status"
    },
    "timeout": 180000,
    "retry": {
      "max_attempts": 3,
      "backoff": "exponential"
    }
  }
  ```

- **mode_profile** (TEXT): Supported modes (e.g., "plan-build-converse", "build", "converse")
- **llm_config** (JSONB): Default LLM configuration (provider, model, temperature) - UI pre-fills from this
- **timeout_ms** (INTEGER): Request timeout in milliseconds (default 120000)
- **retry_config** (JSONB): Retry configuration (max_attempts, backoff strategy)

### Metadata

- **department** (TEXT): Agent department/category (marketing, hr, engineering, etc.)
- **agent_type** (TEXT): Agent type (context, api, external) - mutually exclusive
- **metadata** (JSONB): Catch-all for agent-specific extras

### Optional/Extended

- **plan_structure** (TEXT): Template for plan mode (if agent supports planning)
- **deliverable_structure** (JSONB): Template/schema for deliverables (if agent produces structured output)

## Organizations Table

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

## Migration Strategy

### No Agent JSON Files
- ❌ No `apps/api/agents/` directory with JSON files
- ❌ No file ↔ database sync scripts needed
- ✅ Database is single source of truth
- ✅ Seed files for initial/demo agents
- ✅ Export script available for on-demand backups: `npm run export:agents`

### Migration Steps
1. Create agents table migration
2. Create organizations table migration
3. Create seed files (organizations + agents)
4. Run migrations
5. Run seeds

## Seed Files

### Organizations Seed
- Default organizations: `demo`, `global`
- Location: `apps/api/supabase/seeds/organizations.sql`

### Agents Seed
- Three core starting agents:
  1. Blog Post Writer (context agent)
  2. Marketing Swarm (LangGraph with HITL)
  3. HR Assistant (LangGraph with RAG)
- Optional agents:
  - Jokes Agent (N8n)
  - Metrics Agent (MCP/LangGraph tools)
- Location: `apps/api/supabase/seeds/agents.sql`

## API Service Layer

### Agent Service Methods
```typescript
class AgentService {
  // CRUD operations
  async create(agentData: CreateAgentDto): Promise<Agent>;
  async findAll(filters?: AgentFilters): Promise<Agent[]>;
  async findOne(id: string): Promise<Agent>;
  async findBySlug(orgSlug: string, slug: string): Promise<Agent>;
  async update(id: string, updates: UpdateAgentDto): Promise<Agent>;
  async delete(id: string): Promise<void>;

  // Agent card generation (for discovery)
  async getAgentCard(agentId: string): Promise<AgentCard>;
  async getAllAgentCards(orgSlug?: string): Promise<AgentCard[]>;

  // Org filtering
  async getAgentsByOrg(orgSlug: string): Promise<Agent[]>;
  async getAgentsByType(agentType: AgentType): Promise<Agent[]>;
}
```

### Agent Card Generation
Generate A2A-compliant agent cards from normalized columns:
```typescript
interface AgentCard {
  slug: string;
  display_name: string;
  description: string;
  io_schema: IOSchema;
  capabilities: Capabilities;
  tags?: string[];
  version: string;
}
```

## Frontend Integration

### Agent Management UI
- List agents (filterable by org, type, department)
- View agent details
- Create/edit agents
- Test agents
- View agent cards

### Agent Configuration Forms
- Context agent form (yaml, context, io_schema, capabilities)
- API agent form (endpoint, authentication, context for prompt enhancement)
- Validation for required fields
- JSONB editors for complex fields

## Permissions & Access Control

**Simple org-based isolation:**
- User logged in as org
- API guard: `WHERE :user_org = ANY(organization_slug)`
- User can only see/use agents for their org
- No complex RBAC for v2-start

## Acceptance Criteria

- [ ] Agents table migration created and tested
- [ ] Organizations table migration created and tested
- [ ] Seed files created (organizations + agents)
- [ ] Agent service implements all CRUD operations
- [ ] Agent card generation works correctly
- [ ] Frontend can list, view, create, edit agents
- [ ] Org-based permissions work correctly
- [ ] Three core starting agents seeded successfully
- [ ] Documentation complete (table structure, usage patterns, API)
- [ ] Export script works: `npm run export:agents`

## Success Metrics

1. Database is single source of truth for agents
2. No agent JSON files needed
3. Agent table supports all agent types (context, api, external)
4. Multi-org support works correctly
5. Agent cards can be generated for discovery
6. UI can manage agents without direct database access
7. Seed files initialize system correctly

## Dependencies

- PostgreSQL with JSONB support
- Supabase instance running
- Migration tooling (Supabase CLI or similar)

## Risks & Mitigation

**Risk:** Breaking changes to existing agents
- **Mitigation:** Start fresh - no migration of old agents, build new ones

**Risk:** JSONB fields become unmanageable
- **Mitigation:** Well-defined schemas, validation, TypeScript types

**Risk:** Multi-org array queries slow
- **Mitigation:** GIN index on organization_slug array

## Open Questions

1. Should we add foreign key constraints from agents to organizations now or later?
2. What should the default export format be for `npm run export:agents`? (JSON, YAML, SQL)
3. Should we add JSON Schema validation constraints on JSONB columns at DB level?

## Next Steps

After Phase 1 completion:
- Phase 2: Agent execution layer (context agent runner, API agent runner)
- Phase 3: LangGraph integration (HITL, RAG, streaming)
- Phase 4: Frontend polish and documentation

## Notes

- This PRD supersedes Section 1.1 and 1.2 of create-v2-start.md
- Agent JSON files eliminated entirely (not in PRD originally)
- Context column usage clarified for both context and API agents
- Multi-org support via TEXT[] array (simpler than join table)
