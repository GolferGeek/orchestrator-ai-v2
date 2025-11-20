# Phase 2: Agent Management - Continuation Plan

## Current Status (Completed)

✅ **Phase 0: Port & Environment Configuration** - Committed and pushed
✅ **Phase 1: LLM Providers and Models** - Updated to 7 providers, 45 models
✅ **Phase 2 Part 1: Data Layer Updates** - Committed and pushed
  - Updated `AgentRecord` interface to v2 schema
  - Updated `AgentsRepository` to use slug as PK and organization_slug as TEXT[]
  - All database queries now use new schema

## Breaking Changes Summary

The v2 schema removes several fields that the current runtime depends on:

### Removed Fields
| Old Field | v2 Replacement | Impact |
|-----------|----------------|--------|
| `id` | `slug` (PK) | All lookups now by slug |
| `yaml` | Database fields | No YAML storage/parsing |
| `display_name` | `name` | Direct rename |
| `mode_profile` | Removed | New execution model needed |
| `status` | `metadata.status` | Moved to metadata JSONB |
| `function_code` | `context` (for function agents) | Stored as markdown |
| `agent_card` | `metadata.agent_card` | Moved to metadata JSONB |
| `plan_structure` | Removed | Changed architecture |
| `deliverable_structure` | Removed | Changed architecture |
| `config` | Split into multiple fields | Distributed to metadata, llm_config, endpoint |

### New Fields
| Field | Type | Purpose |
|-------|------|---------|
| `department` | TEXT | Agent organizational grouping |
| `tags` | TEXT[] | Categorization and search |
| `capabilities` | TEXT[] | What the agent can do |
| `context` | TEXT | Markdown context (replaces YAML) |
| `endpoint` | JSONB | API/external agent configuration |
| `llm_config` | JSONB | Context agent LLM settings |
| `metadata` | JSONB | Flexible additional data |

## Phase 2 Part 2: Service Layer Updates (TODO)

### Critical Path - Must Be Done In Order

#### 1. Update AgentRuntimeDefinitionService (HIGH PRIORITY)
**File:** `apps/api/src/agent-platform/services/agent-runtime-definition.service.ts`

**Current Issues:**
- Parses `record.yaml` field (no longer exists)
- Uses `record.id`, `record.display_name`, `record.mode_profile` (removed)
- References `record.plan_structure`, `record.deliverable_structure`, `record.config` (removed)

**Required Changes:**
```typescript
// OLD (v1)
buildDefinition(record: AgentRecord): AgentRuntimeDefinition {
  const descriptor = this.parseDescriptor(record.yaml); // YAML parsing
  const metadata = this.extractMetadata(record, descriptor);
  // ... uses record.id, record.display_name, record.mode_profile
}

// NEW (v2)
buildDefinition(record: AgentRecord): AgentRuntimeDefinition {
  // No YAML parsing - use database fields directly
  const metadata = this.buildMetadata(record);
  const execution = this.buildExecution(record);
  const llmConfig = record.agent_type === 'context' ? record.llm_config : null;
  const endpoint = ['api', 'external'].includes(record.agent_type) ? record.endpoint : null;
  // ... uses record.slug, record.name, record.capabilities
}
```

**Strategy:**
- Remove all YAML parsing logic
- Build `AgentRuntimeDefinition` directly from database fields
- Map `context` (markdown) to runtime context structure
- Handle agent type-specific fields (llm_config vs endpoint)

#### 2. Update AgentRuntimeDefinition Interface
**File:** `apps/api/src/agent-platform/interfaces/agent.interface.ts`

**Current Structure:**
```typescript
export interface AgentRuntimeDefinition {
  id: string;  // Remove
  slug: string;
  organizationSlug: string | null;  // Change to string[]
  displayName: string;  // Change to name
  modeProfile: string;  // Remove or redesign
  // ...
}
```

**Required Changes:**
- Remove `id` field
- Change `organizationSlug` to `string[]`
- Rename `displayName` to `name`
- Remove or redesign `modeProfile` (execution model changed)
- Add `department`, `tags`, `capabilities` fields

#### 3. Update Agent Runner Services
**Files:**
- `apps/api/src/agent2agent/services/context-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/api-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/external-agent-runner.service.ts`

**Current Issues:**
- Use `runtime.modeProfile` to determine execution behavior
- Reference `runtime.config.plan_structure` and `runtime.config.deliverable_structure`

**Required Changes:**
- Replace `modeProfile` checks with `agent_type` and `capabilities` checks
- Use `io_schema` instead of separate plan/deliverable structures
- Update LLM configuration access (now in `llm_config` field)
- Update endpoint access (now in `endpoint` field)

#### 4. Update Agent Builder/Promotion Services
**Files:**
- `apps/api/src/agent-platform/services/agent-builder.service.ts`
- `apps/api/src/agent-platform/services/agent-promotion.service.ts`

**Current Issues:**
- Create agents from YAML files
- Generate `yaml` field for storage

**Required Changes:**
- Accept structured input (JSON) instead of YAML
- Populate database fields directly (no YAML generation)
- Validate agent type-specific requirements (context must have llm_config, api must have endpoint)

#### 5. Update Controllers and DTOs
**Files:**
- `apps/api/src/agent-platform/controllers/agents-admin.controller.ts`
- `apps/api/src/agent-platform/controllers/agents-public.controller.ts`
- `apps/api/src/agent-platform/dto/agent-admin.dto.ts`

**Required Changes:**
- Update request/response DTOs to match new schema
- Remove YAML upload endpoints
- Add structured agent creation endpoints
- Update query parameters (organization_slug now array)

### Non-Critical Updates (Can Be Done Later)

#### 6. Agent Card Builder Service
**File:** `apps/api/src/agent2agent/services/agent-card-builder.service.ts`

Update to use new schema fields when generating agent cards.

#### 7. Test Files
Update all test files that reference old schema:
- `apps/api/src/agent-platform/services/__tests__/agent-runtime-definition.service.spec.ts`
- Agent runner test files
- Repository test files

## Phase 2 Part 3: Migration Strategy (TODO)

### Create Migration Script for Existing Agents

**Goal:** Import existing YAML-based agents into v2 database schema

**File to Create:** `apps/api/supabase/scripts/migrate-agents-yaml-to-v2.ts`

**Strategy:**
1. Read existing agent YAML files from `apps/api/src/agents/` directories
2. Parse YAML structure
3. Map to v2 schema:
   - Extract metadata → `name`, `description`, `version`
   - Determine `agent_type` (context/api/external)
   - Extract `department` from file path or metadata
   - Convert skills/capabilities → `capabilities` array
   - Store full YAML as markdown in `context` field
   - Extract LLM config → `llm_config` (if context agent)
   - Extract endpoint → `endpoint` (if api/external agent)
   - Set `organization_slug` based on file location
4. Insert into database using `AgentsRepository.upsert()`

**Example Mapping:**
```typescript
// YAML file: apps/api/src/agents/demo-org/engineering/blog-post-writer/agent.yaml
{
  metadata: { name: "Blog Post Writer", description: "...", version: "1.0.0" },
  agent_type: "context",
  skills: ["writing", "editing"],
  llm: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  context: "You are a professional blog post writer..."
}

// Maps to v2:
{
  slug: "blog-post-writer",
  organization_slug: ["demo-org"],
  name: "Blog Post Writer",
  description: "...",
  version: "1.0.0",
  agent_type: "context",
  department: "engineering",
  tags: [],
  capabilities: ["writing", "editing"],
  context: "# Blog Post Writer\n\nYou are a professional blog post writer...",
  llm_config: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  endpoint: null,
  io_schema: { /* inferred or default */ },
  metadata: {}
}
```

## Phase 2 Part 4: Testing Strategy (TODO)

### Unit Tests
1. Test `AgentsRepository` CRUD operations with new schema
2. Test `AgentRuntimeDefinitionService` builds definitions without YAML
3. Test agent runners work with new runtime structure

### Integration Tests
1. Create agent via API (structured JSON, not YAML)
2. List agents by organization (with multi-org support)
3. Execute agent task (ensure runtime works end-to-end)
4. Update agent metadata
5. Delete agent by slug

### Migration Tests
1. Import sample YAML agents
2. Verify database records match expected schema
3. Verify agents execute correctly after migration

## Expected Timeline

**Phase 2 Part 2: Service Layer Updates**
- AgentRuntimeDefinitionService: 2-3 hours
- AgentRuntimeDefinition interface: 30 minutes
- Agent runner services: 2-3 hours
- Builder/promotion services: 1-2 hours
- Controllers and DTOs: 1-2 hours
- **Total: ~8-12 hours of development**

**Phase 2 Part 3: Migration Strategy**
- Script development: 2-3 hours
- Testing and refinement: 1-2 hours
- **Total: ~3-5 hours**

**Phase 2 Part 4: Testing**
- Unit tests: 2-3 hours
- Integration tests: 2-3 hours
- **Total: ~4-6 hours**

**Overall Phase 2 Estimate: 15-23 hours**

## Risk Mitigation

### High Risk Areas
1. **Breaking existing API contracts** - Frontend may depend on old response structure
   - Mitigation: Version API endpoints (v1 vs v2) or add compatibility layer

2. **Agent execution failures** - Runtime definition changes may break agent execution
   - Mitigation: Extensive testing with sample agents before migration

3. **Data loss during migration** - YAML → database conversion may lose information
   - Mitigation: Backup strategy, reversibility plan, validation checks

### Rollback Plan
1. Keep v1 agent YAML files in place (don't delete after migration)
2. Create database snapshot before migration
3. Keep old service code commented out (not deleted) for quick rollback
4. Feature flag for v2 vs v1 agent loading

## Success Criteria

Phase 2 is complete when:
- [ ] All TypeScript compilation errors resolved
- [ ] All unit tests passing
- [ ] Integration tests passing (create, read, update, delete agents)
- [ ] Migration script successfully imports sample agents
- [ ] At least one agent executes successfully end-to-end using v2 schema
- [ ] Documentation updated to reflect new agent creation process
- [ ] Code reviewed and committed to main branch

## Next Session Starting Point

**Start with:** Step 1 - Update AgentRuntimeDefinitionService

**First Command:**
```bash
# Check current TypeScript compilation errors
cd apps/api && npm run build 2>&1 | grep -E "error TS|agent-runtime-definition"
```

This will show what needs to be fixed in the runtime definition service.
