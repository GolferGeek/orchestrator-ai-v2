# Database Schema Documentation

**Orchestrator AI v2-start**
**Phase 1: Agent Infrastructure**
**Last Updated:** 2025-01-20

## Overview

The v2-start database schema is a clean, normalized design focused on multi-tenant agent management. It eliminates agent JSON files in favor of a database-as-single-source-of-truth approach.

## Schema Design Principles

1. **Normalized Structure**: All agent configuration in structured columns, not JSON blobs
2. **Multi-Tenancy**: Organizations as first-class entities with array-based membership
3. **Type Safety**: Explicit agent types (context, api, external) with constraints
4. **Flexibility**: JSONB for truly variable data (settings, metadata, endpoints)
5. **Auditability**: Timestamps and versioning on all entities

## Tables

### `public.organizations`

Multi-tenant organization management. Each organization can have multiple agents and users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `slug` | TEXT | PRIMARY KEY | Human-readable unique identifier (e.g., "acme-corp", "demo-org") |
| `name` | TEXT | NOT NULL | Display name of the organization |
| `description` | TEXT | NULL | Optional description of the organization |
| `url` | TEXT | NULL | Optional organization website URL |
| `settings` | JSONB | NOT NULL, DEFAULT '{}' | Flexible JSONB settings for organization preferences, features, and limits |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Timestamp when organization was created |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Auto-maintained timestamp of last update |

**Indexes:**
- `idx_organizations_name` - Lookup by name
- `idx_organizations_created_at` - Sorting by creation date
- `idx_organizations_settings` - GIN index for JSONB queries

**Settings JSONB Structure:**
```json
{
  "theme": "light|dark",
  "features": ["context-agents", "api-agents", "external-agents"],
  "limits": {
    "max_agents": 100,
    "max_conversations": 1000
  },
  "preferences": {
    "default_llm_provider": "anthropic",
    "default_llm_model": "claude-3-5-sonnet-20241022"
  }
}
```

### `public.agents`

Normalized agent configurations - single source of truth (no JSON files). Supports three agent types: context (LLM-based), api (webhook/HTTP), and external (A2A protocol).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `slug` | TEXT | PRIMARY KEY | Globally unique identifier (e.g., "blog-post-writer") |
| `organization_slug` | TEXT[] | NOT NULL, DEFAULT ARRAY['demo-org'] | Array of organization slugs (supports multi-org agents) |
| `name` | TEXT | NOT NULL | Human-readable agent name |
| `description` | TEXT | NOT NULL | Detailed description of agent purpose and capabilities |
| `version` | TEXT | NOT NULL, DEFAULT '1.0.0' | Semantic version of agent configuration |
| `agent_type` | TEXT | NOT NULL, CHECK IN ('context', 'api', 'external') | Type of agent |
| `department` | TEXT | NOT NULL | Department or category (e.g., "marketing", "hr", "engineering") |
| `tags` | TEXT[] | DEFAULT ARRAY[] | Array of tags for discovery and filtering |
| `io_schema` | JSONB | NOT NULL | JSON schema defining input and output structure |
| `capabilities` | TEXT[] | NOT NULL | Array of capability identifiers |
| `context` | TEXT | NOT NULL | System prompt (context agents) or prompt enhancement (API agents) |
| `endpoint` | JSONB | NULL | API endpoint configuration with authentication (API/external only) |
| `llm_config` | JSONB | NULL | LLM provider and parameters (context agents only) |
| `metadata` | JSONB | DEFAULT '{}' | Flexible extended metadata (author, license, docs, etc.) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Timestamp when agent was created |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Auto-maintained timestamp of last update |

**Indexes:**
- `idx_agents_organization_slug` - GIN index for organization membership queries
- `idx_agents_department` - Filtering by department
- `idx_agents_agent_type` - Filtering by type
- `idx_agents_tags` - GIN index for tag queries
- `idx_agents_capabilities` - GIN index for capability queries
- `idx_agents_io_schema` - GIN index for schema queries
- `idx_agents_endpoint` - GIN index for endpoint queries
- `idx_agents_llm_config` - GIN index for LLM config queries
- `idx_agents_metadata` - GIN index for metadata queries
- `idx_agents_created_at` - Sorting by creation date
- `idx_agents_name` - Sorting by name

**Constraints:**
- Context agents: Must have `llm_config`, must NOT have `endpoint`
- API/External agents: Must have `endpoint`, must NOT have `llm_config`

**IO Schema JSONB Structure:**
```json
{
  "input": {
    "type": "object",
    "required": ["field1", "field2"],
    "properties": {
      "field1": {
        "type": "string",
        "description": "Description of field1"
      }
    }
  },
  "output": {
    "type": "object",
    "required": ["result"],
    "properties": {
      "result": {
        "type": "string",
        "description": "Description of result"
      }
    }
  }
}
```

**Endpoint JSONB Structure (API/External agents only):**
```json
{
  "url": "http://localhost:8000/webhook",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "authentication": {
    "type": "bearer|api-key|basic",
    "config": {
      "token": "${API_TOKEN}",
      "header": "Authorization"
    }
  },
  "request_transform": "template for request body",
  "response_transform": "jq filter for response extraction",
  "status_webhook": "${ORCHESTRATOR_WEBHOOK_STATUS_URL}"
}
```

**LLM Config JSONB Structure (Context agents only):**
```json
{
  "provider": "anthropic|openai|google|ollama",
  "model": "claude-3-5-sonnet-20241022",
  "parameters": {
    "temperature": 0.7,
    "maxTokens": 4000,
    "topP": 1.0
  }
}
```

**Metadata JSONB Structure:**
```json
{
  "author": "Author Name",
  "license": "MIT|PROPRIETARY",
  "documentation_url": "https://docs.example.com/agent",
  "version_history": [
    {
      "version": "1.0.0",
      "date": "2025-01-20",
      "changes": "Initial release"
    }
  ],
  "usage_examples": [
    {
      "description": "Example use case",
      "input": { "...": "..." }
    }
  ],
  "performance_notes": "Performance characteristics",
  "limitations": [
    "Limitation 1",
    "Limitation 2"
  ]
}
```

## Agent Types

### Context Agents (LLM-based)

**Required Columns:**
- `agent_type` = 'context'
- `context` = System prompt/instructions
- `llm_config` = LLM configuration (provider, model, parameters)
- `endpoint` = NULL

**Use Cases:**
- Conversational agents
- Content generation
- Analysis and reasoning tasks
- Any LLM-powered functionality

**Example:** Blog Post Writer

### API Agents (Webhook/HTTP)

**Required Columns:**
- `agent_type` = 'api'
- `context` = Prompt enhancement / request documentation
- `endpoint` = API configuration with authentication
- `llm_config` = NULL

**Use Cases:**
- N8n workflow wrappers
- LangGraph endpoint wrappers
- Custom HTTP services
- Third-party API integrations

**Example:** N8n Blog Post Workflow Agent

### External Agents (A2A Protocol)

**Required Columns:**
- `agent_type` = 'external'
- `context` = Documentation / usage notes
- `endpoint` = A2A endpoint with authentication
- `llm_config` = NULL

**Use Cases:**
- Remote A2A-compliant agents
- External orchestrator systems
- Third-party agent frameworks
- Federated agent networks

**Example:** Remote CrewAI Agent

## Row Level Security (RLS)

### Current Policies (Phase 1)

**Organizations:**
- `Users can read their organizations` - Currently allows all reads (will be restricted in future phases)
- `Service role has full access to organizations` - Full CRUD for service role

**Agents:**
- `Users can read agents in their organizations` - Currently allows all reads (will be restricted in future phases)
- `Service role has full access to agents` - Full CRUD for service role

### Future RLS (User Management Phase)

When user management is implemented, RLS policies will be updated to:
- Check user-organization membership
- Enforce read/write permissions based on user roles
- Support organization admins vs. regular users

## Triggers

### `set_updated_at()`

Automatically maintains the `updated_at` timestamp on both tables:
- Fires BEFORE UPDATE
- Sets `updated_at = NOW()`
- Ensures accurate audit trails

## Seed Data

### Demo Organization

- **Slug:** `demo-org`
- **Name:** Demo Organization
- **Features:** Context agents, API agents, External agents
- **Limits:** 100 agents, 1000 conversations

### Blog Post Writer Agent

- **Slug:** `blog-post-writer`
- **Type:** Context agent
- **Department:** Marketing
- **Capabilities:** Blog writing, SEO optimization, content generation
- **LLM:** Claude 3.5 Sonnet (Anthropic)

## Migration Files

1. **`20250120000001_create_organizations_table.sql`**
   - Creates `organizations` table
   - Adds indexes
   - Enables RLS
   - Creates `set_updated_at()` trigger function

2. **`20250120000002_create_agents_table.sql`**
   - Creates `agents` table
   - Adds type-specific constraints
   - Adds indexes
   - Enables RLS
   - Attaches `set_updated_at` trigger

## Seed Files

- **`seeds/seed.sql`** - Master seed file (consolidated)
  - Seeds demo organization
  - Seeds blog post writer agent
  - Validates seed data

## Future Schema Extensions

### Phase 1.5: Agent Card UI
- No schema changes (YAML generated from agent table)

### Phase 2: Multi-Agent Orchestration
- `conversations` table
- `messages` table
- `conversation_participants` table (agent assignments)

### Phase 3: RAG System
- `document_collections` table
- `documents` table
- `document_chunks` table
- Vector extension configuration

### Phase 4: Human-in-the-Loop
- `tasks` table
- `task_assignments` table
- `task_comments` table
- `approvals` table

### Phase 7: Observability & Analytics
- `observability_events` table
- `agent_metrics` table
- `performance_logs` table

## Database Access

### Development Environment

- **API URL:** http://127.0.0.1:6010
- **Database URL:** postgresql://postgres:postgres@127.0.0.1:6012/postgres
- **Studio URL:** http://127.0.0.1:6015

### Common Operations

**Reset database with migrations and seeds:**
```bash
cd apps/api
npx supabase db reset
```

**Create new migration:**
```bash
cd apps/api
npx supabase migration new <migration_name>
```

**Apply migrations:**
```bash
cd apps/api
npx supabase db push
```

**Generate TypeScript types:**
```bash
cd apps/api
npx supabase gen types typescript --local > ../../types/database.types.ts
```

## Notes

- **No Agent JSON Files:** Database is single source of truth
- **Multi-Org Support:** Agents can belong to multiple organizations via array
- **Type Safety:** Database constraints enforce agent type rules
- **Versioning:** Agent version column for future version management
- **JSONB Flexibility:** Variable data (settings, metadata, configs) stored as JSONB
- **Future-Proof:** Schema designed to accommodate future phases with minimal changes
