# Phase 1.5 PRD: Agent Discovery & Runner Cleanup

## Overview

Phase 1.5 cleans up agent discovery, execution, and frontend components based on the new agent table structure from Phase 1. This includes updating agent runners, removing deprecated tool agent code, implementing the external agent runner for A2A protocol compliance, and updating frontend components.

## Goals

1. Update agent discovery to read from new agent table structure
2. Clean up and consolidate agent runners (context, api, external)
3. Implement external agent runner with A2A protocol discovery
4. Remove tool agent runner and all related code
5. Update frontend for new agent structure
6. Ensure proper routing based on agent_type

## Agent Runners Architecture

### Three Agent Runners

**1. Context Agent Runner** (Existing - Update)
- For `agent_type = 'context'`
- Uses `context` column as full system prompt
- Executes via Orchestrator AI API (local agent execution)
- Uses `llm_config` for LLM selection
- Supports `mode_profile` (plan-build-converse)

**2. API Agent Runner** (Existing - Update)
- For `agent_type = 'api'`
- Internal/local APIs (LangGraph, N8n on our infrastructure)
- Uses `context` column for prompt enhancement/transformation
- Uses `endpoint` JSONB for routing and authentication
- Simple API calls with optional streaming
- No A2A discovery needed

**3. External Agent Runner** (New - Implement)
- For `agent_type = 'external'`
- External A2A-compliant agents (hosted elsewhere)
- Uses `context` column for prompt enhancement/transformation
- Uses `endpoint` JSONB with A2A discovery URL
- **A2A Protocol Support:**
  - Discovery: Fetch `.well-known/agent.json` from external agent
  - Cache agent card locally
  - Follow A2A protocol for task submission
  - Handle A2A response format
  - Support A2A authentication patterns
- **Very similar to API Agent Runner** except for A2A discovery

**Tool Agent Runner** (Remove)
- ❌ Remove entirely
- ❌ Remove all related code and references

### Runner Selection Logic

```typescript
function selectRunner(agent: Agent): AgentRunner {
  switch (agent.agent_type) {
    case 'context':
      return contextAgentRunner;
    case 'api':
      return apiAgentRunner;
    case 'external':
      return externalAgentRunner; // New!
    default:
      throw new Error(`Unknown agent type: ${agent.agent_type}`);
  }
}
```

## External Agent Runner Implementation

### A2A Discovery Flow

1. **Agent Registration:**
   - Agent record created with `agent_type = 'external'`
   - `endpoint` JSONB contains discovery URL:
     ```json
     {
       "discovery_url": "https://external-agent.example.com/.well-known/agent.json",
       "base_url": "https://external-agent.example.com",
       "authentication": {
         "type": "bearer",
         "token_env": "EXTERNAL_AGENT_API_KEY"
       }
     }
     ```

2. **Initial Discovery:**
   - Fetch `.well-known/agent.json` from `discovery_url`
   - Parse and validate agent card
   - Cache agent card in database (optional: add `cached_agent_card` JSONB column to agents table)
   - Extract task submission endpoint from agent card

3. **Task Execution:**
   - Use cached agent card to determine task endpoint
   - Transform user prompt using agent's `context` (prompt enhancement)
   - Submit task following A2A protocol
   - Handle authentication per `endpoint.authentication`
   - Process A2A response format

4. **Card Refresh:**
   - Re-fetch agent card periodically or on-demand
   - Update cache if card changes

### External Agent Runner Features

- **Discovery:** Automatic `.well-known/agent.json` fetching
- **Caching:** Cache external agent cards locally
- **Authentication:** Support bearer, API key, OAuth2 via `endpoint.authentication`
- **Protocol Compliance:** Follow A2A JSON-RPC 2.0 protocol
- **Error Handling:** Handle external agent failures gracefully
- **Timeout/Retry:** Use `timeout_ms` and `retry_config` from agent table

### Implementation Note

**Status:** Implement without test case
- External agent runner should be implemented following A2A protocol specification
- No external A2A agent available for testing yet
- Implementation based on A2A protocol documentation
- Will be tested when external agents become available
- Similar to API Agent Runner but with discovery step

### Endpoint JSONB Structure for External Agents

```json
{
  "discovery_url": "https://external-agent.example.com/.well-known/agent.json",
  "base_url": "https://external-agent.example.com",
  "authentication": {
    "type": "bearer",
    "token_env": "EXTERNAL_AGENT_API_KEY",
    "header": "Authorization"
  },
  "timeout": 180000,
  "retry": {
    "max_attempts": 3,
    "backoff": "exponential"
  }
}
```

## Backend API Changes

### Agent Discovery Service

**Updates Required:**
- Read agents from `agents` table (not JSON files)
- Generate agent cards from normalized columns:
  - `slug`, `display_name`, `description`
  - `io_schema`, `capabilities`, `tags`
  - `version`
- Filter by `organization_slug` (multi-org support)
- Filter by `agent_type`, `department`, `status`

**New Methods:**
```typescript
class AgentDiscoveryService {
  // Generate agent card from agent record
  async generateAgentCard(agent: Agent): Promise<AgentCard>;

  // Discover external agent (fetch .well-known/agent.json)
  async discoverExternalAgent(discoveryUrl: string): Promise<AgentCard>;

  // Cache external agent card
  async cacheExternalAgentCard(agentId: string, card: AgentCard): Promise<void>;
}
```

### Agent Execution Service

**Updates Required:**
- Route based on `agent_type`:
  - `context` → Context Agent Runner
  - `api` → API Agent Runner
  - `external` → External Agent Runner
- Remove tool agent routing
- Pass agent record (with all columns) to runners
- Runners read `context`, `endpoint`, `llm_config`, etc. from agent record

**Cleanup:**
- Remove all tool agent execution code
- Remove tool agent endpoint handlers
- Remove tool agent configuration code

### Endpoints to Update

- `POST /api/agents/{slug}/tasks` - Update to work with new agent structure
- `GET /api/agents` - Return agents from table with new structure
- `GET /api/agents/cards` - Generate cards from normalized columns
- `GET /api/agents/{slug}` - Return agent with full details
- `DELETE /api/agents/tools/*` - Remove all tool-related endpoints

## Frontend Changes

### Agent Discovery/List View

**Updates Required:**
- Fetch agents from updated API
- Display based on new structure:
  - `display_name`, `description`
  - `capabilities` (show key capabilities)
  - `agent_type` badge (context, api, external)
  - `department` category
- Filters:
  - By agent_type
  - By department
  - By organization
  - By status

**Components to Update:**
- `AgentList.vue` (or similar)
- `AgentCard.vue` (or similar)
- Agent filter components

### Agent Detail View

**Updates Required:**
- Display agent details from new structure:
  - Core info: `display_name`, `description`, `version`
  - Capabilities: List from `capabilities` JSONB
  - IO Schema: Show `io_schema` structure
  - Configuration: `mode_profile`, `timeout_ms`
  - Endpoint: Show `endpoint` config (if api/external)
  - Context: Preview `context` (system prompt or enhancement)
- Agent card preview (A2A format)
- Test agent button

**Components to Update:**
- `AgentDetail.vue` (or similar)
- Agent card preview component

### Agent Execution UI

**Updates Required:**
- Remove tool agent execution flows
- Support context agent execution
- Support API agent execution
- Support external agent execution
- Handle transport types (Full API, Simple API)
- Display execution results
- Show streaming events

**Components to Update:**
- Agent execution/chat components
- Task submission forms
- Result display components

### Agent Configuration UI

**Updates Required:**
- Forms for creating/editing agents
- Agent type selector (context, api, external)
- JSONB editors:
  - `io_schema` editor with validation
  - `capabilities` editor
  - `endpoint` editor (for api/external)
  - `llm_config` editor
- Text editors:
  - `context` editor (markdown/text)
  - `yaml` editor (optional)
- Validation based on `agent_type`:
  - Context agents require `context`
  - API/external agents require `endpoint`

**Components to Create/Update:**
- `AgentForm.vue` (or similar)
- JSONB editor components
- Field validation logic

## Acceptance Criteria

### Backend
- [ ] Agent discovery reads from new agent table structure
- [ ] Context agent runner updated to use new columns
- [ ] API agent runner updated to use new columns
- [ ] **External agent runner implemented with A2A discovery**
- [ ] **External agent runner fetches `.well-known/agent.json`**
- [ ] **External agent runner caches agent cards**
- [ ] **External agent runner handles authentication**
- [ ] Tool agent runner removed completely
- [ ] Agent routing based on `agent_type`
- [ ] All tool agent endpoints removed
- [ ] Agent cards generated from normalized columns

### Frontend
- [ ] Agent list displays agents from new structure
- [ ] Agent detail view shows new agent structure
- [ ] Agent configuration UI works with new table
- [ ] Can create/edit context agents
- [ ] Can create/edit API agents
- [ ] Can create/edit external agents
- [ ] Agent execution works for context agents
- [ ] Agent execution works for API agents
- [ ] Agent execution works for external agents
- [ ] Tool agent UI removed
- [ ] Filters work (type, department, org)

### External Agent Runner
- [ ] Implements A2A protocol discovery
- [ ] Fetches and parses `.well-known/agent.json`
- [ ] Caches external agent cards
- [ ] Handles authentication (bearer, API key, OAuth2)
- [ ] Submits tasks following A2A protocol
- [ ] Processes A2A responses correctly
- [ ] Handles errors gracefully
- [ ] Note: Implementation without test case (no external agents available yet)

## Implementation Notes

### Runner Similarity

**API Runner vs External Runner:**
- **90% similar** - Both make HTTP calls to external endpoints
- **Key difference:** External runner adds A2A discovery step
- **Shared logic:** Authentication, timeout, retry, error handling
- **Consider:** Shared base class or utility functions

### Discovery Caching

**Options for caching external agent cards:**
1. Add `cached_agent_card` JSONB column to agents table
2. Store in separate `agent_card_cache` table
3. In-memory cache with TTL

**Recommendation:** Add `cached_agent_card` JSONB column to agents table for simplicity

### A2A Protocol Reference

External agent runner should follow A2A (Agent-to-Agent) protocol:
- Discovery: `.well-known/agent.json`
- JSON-RPC 2.0 format
- Task submission endpoint from agent card
- Response format compliance

## Success Metrics

1. All agents execute through correct runner based on type
2. External agents can be registered and discovered via A2A
3. No references to tool agents in codebase
4. Frontend works seamlessly with new agent structure
5. Agent cards generated correctly from database
6. Agent execution works for all three types

## Dependencies

- Phase 1 completed (agent table and organizations table)
- A2A protocol documentation
- Frontend component library

## Risks & Mitigation

**Risk:** External agent runner untested
- **Mitigation:** Implement based on A2A spec, mark as untested, test when external agents available

**Risk:** Breaking existing agent execution
- **Mitigation:** Update runners incrementally, test context and API agents thoroughly

**Risk:** Frontend requires significant rework
- **Mitigation:** Update components incrementally, keep UI simple initially

## Open Questions

1. Should we add `cached_agent_card` JSONB column to agents table now or later?
2. What's the cache TTL for external agent cards? (default: 1 hour, configurable?)
3. Should we validate external agent cards against A2A schema?

## Next Steps

After Phase 1.5 completion:
- Phase 2: Core Functionality (streaming, observability, PII, transport types)
- Phase 3: RAG Infrastructure
- Phase 4: HITL Implementation

## Notes

- External agent runner implemented without test case (noted in acceptance criteria)
- Tool agent runner removal may affect existing code - thorough cleanup required
- Frontend changes may be extensive - prioritize functional over polished UI
- External agent discovery is foundational for A2A compliance
