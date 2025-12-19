---
name: external-agent-skill
description: How to build external agents - agents that use A2A protocol to communicate with external services. Use when building external agents, configuring A2A discovery, or registering external agents in the database.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "builder"
type: "prescriptive"
used-by-agents: ["agent-builder-agent"]
related-skills: ["agent-builder-skill", "transport-types-skill"]
---

# External Agent Skill

## Purpose

This skill enables agents to build external agents - agents that use the Agent-to-Agent (A2A) protocol to communicate with external services.

## When to Use

- **Building External Agents**: When creating new external A2A agents
- **A2A Configuration**: When configuring A2A protocol and discovery
- **Agent Definition**: When defining external agent structure
- **Database Registration**: When registering external agents in the database

## Core Principles

### 1. External Agent Characteristics

**A2A Protocol:**
- Uses JSON-RPC 2.0 format
- Implements `.well-known/agent.json` discovery
- Follows transport type contracts

**External Service Integration:**
- Calls external HTTP endpoints
- Handles authentication
- Processes A2A responses

**No Direct LLM:**
- External agents don't use LLM directly
- External service handles its own logic
- A2A protocol for communication

### 2. Database Structure

**Required Fields:**
- `agent_type: 'external'`
- `context: string` - Markdown context file content
- `endpoint: JsonObject` - External service endpoint configuration
- `llm_config: null` - External agents don't use LLM
- `metadata: JsonObject` - A2A discovery and protocol configuration

**Endpoint Configuration:**
```typescript
{
  endpoint: {
    url: 'https://external-service.com/agent',
    protocol: 'a2a',
    authentication: {
      type: 'bearer',
      token: '${EXTERNAL_API_KEY}',
    },
    timeout: 30000,
  },
}
```

### 3. A2A Discovery

**Discovery Pattern:**
- `.well-known/agent.json` endpoint
- Agent metadata and capabilities
- Transport type information

**Metadata:**
```typescript
{
  metadata: {
    discoveryUrl: 'https://external-service.com/.well-known/agent.json',
    a2aProtocol: 'json-rpc-2.0',
    transportTypes: ['plan', 'build', 'converse'],
    expectedCapabilities: ['capability1', 'capability2'],
  },
}
```

## Agent Definition Pattern

### Basic External Agent

```typescript
{
  slug: 'my-external-agent',
  organization_slug: ['demo-org'],
  name: 'My External Agent',
  description: 'External A2A agent',
  agent_type: 'external',
  department: 'general',
  tags: ['external', 'a2a'],
  io_schema: {
    input: {
      type: 'object',
      properties: {
        method: { type: 'string' },
        params: { type: 'object' },
      },
      required: ['method', 'params'],
    },
    output: {
      type: 'object',
      properties: {
        result: { type: 'object' },
        error: { type: 'object' },
      },
    },
  },
  capabilities: ['external-integration'],
  context: '# My External Agent\n\nExternal service description...',
  endpoint: {
    url: 'https://external-service.com/agent',
    protocol: 'a2a',
    authentication: {
      type: 'bearer',
      token: '${EXTERNAL_API_KEY}',
    },
    timeout: 30000,
  },
  llm_config: null,
  metadata: {
    discoveryUrl: 'https://external-service.com/.well-known/agent.json',
    a2aProtocol: 'json-rpc-2.0',
    transportTypes: ['plan', 'build', 'converse'],
  },
}
```

## Execution Flow

### BUILD Mode

1. **Discover Agent**:
   - Fetch `.well-known/agent.json` from discovery URL
   - Validate agent capabilities
   - Check transport types

2. **A2A Call**:
   - Format JSON-RPC 2.0 request
   - Include authentication
   - Send request to external endpoint

3. **Process Response**:
   - Parse JSON-RPC 2.0 response
   - Handle errors
   - Extract result

4. **Save Deliverable**:
   - Store result as deliverable
   - Include metadata

## Database Registration

### Registration Pattern

```typescript
await agentsRepository.upsert({
  slug: 'my-external-agent',
  organization_slug: ['demo-org'],
  name: 'My External Agent',
  description: 'External agent description',
  agent_type: 'external',
  department: 'general',
  tags: ['external'],
  io_schema: { /* schema */ },
  capabilities: ['external-integration'],
  context: '# External Agent Context\n\n...',
  endpoint: {
    url: 'https://external-service.com/agent',
    protocol: 'a2a',
    authentication: { type: 'bearer' },
  },
  llm_config: null, // External agents don't use LLM
  metadata: {
    discoveryUrl: 'https://external-service.com/.well-known/agent.json',
  },
});
```

## Common Patterns

### External A2A Agent

```typescript
{
  slug: 'external-service',
  agent_type: 'external',
  context: '# External Service\n\nA2A agent for external service...',
  endpoint: {
    url: 'https://external-service.com/agent',
    protocol: 'a2a',
  },
  metadata: {
    discoveryUrl: 'https://external-service.com/.well-known/agent.json',
  },
}
```

## Violations

### ❌ Missing Endpoint

```typescript
// ❌ WRONG: External agents require endpoint
{
  agent_type: 'external',
  endpoint: null, // WRONG
}
```

**✅ FIX: Provide endpoint configuration**
```typescript
// ✅ CORRECT: External agents require endpoint
{
  agent_type: 'external',
  endpoint: {
    url: 'https://external-service.com/agent',
    protocol: 'a2a',
  },
}
```

### ❌ Missing A2A Protocol

```typescript
// ❌ WRONG: External agents should specify A2A protocol
{
  agent_type: 'external',
  endpoint: {
    url: 'https://external-service.com/agent',
    // Missing protocol
  },
}
```

**✅ FIX: Specify A2A protocol**
```typescript
// ✅ CORRECT: External agents should specify A2A protocol
{
  agent_type: 'external',
  endpoint: {
    url: 'https://external-service.com/agent',
    protocol: 'a2a', // CORRECT
  },
}
```

## Related

- **`agent-builder-agent.md`** - Main orchestrator
- **`transport-types-skill/`** - A2A protocol details (MANDATORY)
- **`execution-context-skill/`** - ExecutionContext validation

