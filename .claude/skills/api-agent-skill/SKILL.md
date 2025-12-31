---
name: api-agent-skill
description: How to build API agents - agents that call external HTTP APIs or wrap LangGraph/N8N workflows. Use when building API agents, determining framework (LangGraph vs N8N), or registering API agents in the database.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "builder"
type: "prescriptive"
used-by-agents: ["agent-builder-agent", "langgraph-api-agent-builder", "n8n-api-agent-builder"]
related-skills: ["agent-builder-skill", "langgraph-architecture-skill"]
---

# API Agent Skill

## Purpose

This skill enables agents to build API agents - agents that call external HTTP APIs or wrap workflow frameworks (LangGraph, N8N, future frameworks).

## When to Use

- **Building API Agents**: When creating new API agents
- **Framework Selection**: When determining LangGraph vs N8N vs other frameworks
- **Agent Definition**: When defining API agent structure
- **Database Registration**: When registering API agents in the database

## Core Principles

### 1. API Agent Characteristics

**HTTP API Integration:**
- Calls external HTTP APIs (GET, POST, PUT, DELETE, PATCH)
- Handles request/response transformation
- Supports authentication

**Workflow Framework Wrapping:**
- Wraps LangGraph workflows
- Wraps N8N workflows
- Future: Wraps CrewAI, AutoGen, etc.

**No Direct LLM:**
- API agents don't use LLM directly
- LangGraph/N8N workflows use LLM internally
- External APIs handle their own logic

### 2. Database Structure

**Required Fields:**
- `agent_type: 'api'`
- `context: string` - Markdown context file content
- `endpoint: JsonObject` - API endpoint configuration
- `llm_config: null` - API agents don't use LLM directly
- `metadata: JsonObject` - Framework-specific metadata

**Endpoint Configuration:**
```typescript
{
  endpoint: {
    url: 'http://localhost:6200/my-workflow',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000,
    responseTransform: {
      content: '$.data.result',
      metadata: { taskId: '$.data.taskId' },
    },
  },
}
```

### 3. Framework Decision Logic

**LangGraph** (Default for complex workflows):
- ✅ Complex multi-phase workflows
- ✅ HITL (Human-in-the-Loop) support
- ✅ State management and checkpointing
- ✅ Database-driven state machines
- ✅ Custom tools and services

**N8N** (For simpler integrations):
- ✅ Drag-and-drop visual workflows
- ✅ Webhook-based triggers
- ✅ Simpler integrations
- ✅ Visual workflow builder

**Decision Factors:**
1. **User preference** - Explicitly stated
2. **Workflow complexity** - Complex → LangGraph, Simple → N8N
3. **HITL requirements** - HITL → LangGraph
4. **State management** - Complex state → LangGraph
5. **Default**: LangGraph (primary framework)

## Agent Definition Pattern

### LangGraph API Agent

```typescript
{
  slug: 'my-langgraph-agent',
  organization_slug: ['demo-org'],
  name: 'My LangGraph Agent',
  description: 'LangGraph-powered workflow agent',
  agent_type: 'api',
  department: 'general',
  tags: ['langgraph', 'workflow'],
  io_schema: {
    input: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
      },
      required: ['prompt'],
    },
    output: {
      type: 'object',
      properties: {
        result: { type: 'string' },
        taskId: { type: 'string' },
      },
    },
  },
  capabilities: ['workflow-execution', 'hitl'],
  context: '# My LangGraph Agent\n\nWorkflow description...',
  endpoint: {
    url: 'http://localhost:6200/my-workflow',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000,
    responseTransform: {
      content: '$.data.result',
      metadata: { taskId: '$.data.taskId' },
    },
  },
  llm_config: null, // API agents don't use LLM directly
  metadata: {
    provider: 'langgraph',
    langgraphEndpoint: 'http://localhost:6200',
    features: ['hitl', 'checkpointing'],
    statusEndpoint: '/my-workflow/status/{taskId}',
    historyEndpoint: '/my-workflow/history/{taskId}',
  },
}
```

### N8N API Agent

```typescript
{
  slug: 'my-n8n-agent',
  agent_type: 'api',
  context: '# My N8N Agent\n\nN8N workflow description...',
  endpoint: {
    url: 'http://localhost:5678/webhook/my-workflow',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  llm_config: null,
  metadata: {
    provider: 'n8n',
    n8nWorkflowId: 'workflow-id',
    n8nWebhookPath: '/my-workflow',
  },
}
```

## Framework Routing

### Route to LangGraph Builder

**When to route to `langgraph-api-agent-builder.md`:**
- ✅ User explicitly requests LangGraph
- ✅ Complex workflow requirements
- ✅ HITL support needed
- ✅ State management required
- ✅ Default choice

**Pattern:**
```
1. Load api-agent-skill
2. Determine: LangGraph framework
3. Route to: langgraph-api-agent-builder.md
4. langgraph-api-agent-builder:
   - Delegates to langgraph-architecture-agent
   - langgraph-architecture-agent builds workflow
   - Registers agent in database
```

### Route to N8N Builder

**When to route to `n8n-api-agent-builder.md`:**
- ✅ User explicitly requests N8N
- ✅ Simpler workflow requirements
- ✅ Visual workflow preferred
- ✅ Webhook-based triggers

**Pattern:**
```
1. Load api-agent-skill
2. Determine: N8N framework
3. Route to: n8n-api-agent-builder.md
4. n8n-api-agent-builder:
   - Uses N8N MCP to create workflow
   - Uses n8n-development-skill for patterns
   - Registers agent in database
```

## Database Registration

### Registration Pattern

```typescript
await agentsRepository.upsert({
  slug: 'my-api-agent',
  organization_slug: ['demo-org'],
  name: 'My API Agent',
  description: 'API agent description',
  agent_type: 'api',
  department: 'general',
  tags: ['api'],
  io_schema: { /* schema */ },
  capabilities: ['workflow-execution'],
  context: '# API Agent Context\n\n...',
  endpoint: {
    url: 'http://localhost:6200/workflow',
    method: 'POST',
  },
  llm_config: null, // API agents don't use LLM directly
  metadata: {
    provider: 'langgraph', // or 'n8n'
    // Framework-specific metadata
  },
});
```

## Common Patterns

### LangGraph Workflow Agent

```typescript
{
  slug: 'data-analyst',
  agent_type: 'api',
  context: '# Data Analyst\n\nLangGraph workflow for data analysis...',
  endpoint: {
    url: 'http://localhost:6200/data-analyst/analyze',
    method: 'POST',
  },
  metadata: {
    provider: 'langgraph',
    langgraphEndpoint: 'http://localhost:6200',
    features: ['tool-calling', 'checkpointing'],
  },
}
```

### N8N Webhook Agent

```typescript
{
  slug: 'n8n-workflow',
  agent_type: 'api',
  context: '# N8N Workflow\n\nN8N workflow description...',
  endpoint: {
    url: 'http://localhost:5678/webhook/workflow',
    method: 'POST',
  },
  metadata: {
    provider: 'n8n',
    n8nWorkflowId: 'workflow-id',
  },
}
```

## Violations

### ❌ Missing Endpoint

```typescript
// ❌ WRONG: API agents require endpoint
{
  agent_type: 'api',
  endpoint: null, // WRONG
}
```

**✅ FIX: Provide endpoint configuration**
```typescript
// ✅ CORRECT: API agents require endpoint
{
  agent_type: 'api',
  endpoint: {
    url: 'http://localhost:6200/workflow',
    method: 'POST',
  },
}
```

### ❌ Using LLM Config for API Agent

```typescript
// ❌ WRONG: API agents don't use LLM directly
{
  agent_type: 'api',
  llm_config: { provider: '...' }, // WRONG
}
```

**✅ FIX: LLM config must be null**
```typescript
// ✅ CORRECT: API agents don't use LLM directly
{
  agent_type: 'api',
  llm_config: null, // CORRECT
}
```

## Related

- **`agent-builder-agent.md`** - Main orchestrator
- **`langgraph-api-agent-builder.md`** - LangGraph framework builder
- **`n8n-api-agent-builder.md`** - N8N framework builder
- **`execution-context-skill/`** - ExecutionContext validation
- **`transport-types-skill/`** - A2A compliance

## Self-Reporting

**When this skill is loaded, the agent using it should log the event:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('skill', 'api-agent-skill', 'loaded',
  '{\"loaded_by\": \"agent-name\", \"context\": \"description\"}'::jsonb);"
```

**After using the skill's patterns, log if they helped:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('skill', 'api-agent-skill', 'helped', true,
  '{\"outcome\": \"what the skill helped with\"}'::jsonb);"
```

