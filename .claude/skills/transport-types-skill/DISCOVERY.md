# A2A Agent Discovery (.well-known/agent.json)

This document explains the `.well-known/agent.json` discovery mechanism for A2A compliance.

## Purpose

The `.well-known/agent.json` endpoint allows other A2A systems to **discover** agent capabilities without executing tasks. This is separate from the actual agent execution endpoints.

## Endpoint

**Path:** `GET /agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json`

**Example:**
```
GET /agent-to-agent/demo-org/blog-writer/.well-known/agent.json
```

**Response:** JSON object describing the agent's capabilities

## Agent Card Structure

```json
{
  "name": "agent-slug",
  "displayName": "Human Readable Name",
  "description": "Agent description",
  "version": "1.0.0",
  "protocol": "google/a2a",
  "url": "https://api.example.com/agent-to-agent/org/agent",
  "endpoints": {
    "health": "/health",
    "tasks": "/tasks",
    "card": "/.well-known/agent.json"
  },
  "capabilities": [
    "plan",
    "build",
    "converse"
  ],
  "skills": [
    {
      "id": "skill-id",
      "name": "Skill Name",
      "description": "Skill description",
      "tags": ["tag1", "tag2"],
      "examples": [
        "Example request 1",
        "Example request 2"
      ]
    }
  ],
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer"
    }
  },
  "metadata": {
    "agentType": "context",
    "organization": "org-slug",
    "modeProfile": {
      "plan": true,
      "build": true,
      "converse": true
    }
  }
}
```

## Key Fields

### Required Fields

- **`name`**: Agent slug (identifier)
- **`displayName`**: Human-readable name
- **`description`**: Agent description
- **`version`**: Agent version (semantic versioning)
- **`protocol`**: Must be `"google/a2a"` for A2A compliance
- **`url`**: Base URL for agent endpoints
- **`endpoints`**: Object with endpoint paths
  - `health`: Health check endpoint
  - `tasks`: Task execution endpoint
  - `card`: Agent card endpoint (this one)

### Optional Fields

- **`capabilities`**: Array of supported modes (plan, build, converse, hitl)
- **`skills`**: Array of agent skills with examples
- **`securitySchemes`**: Authentication/authorization schemes
- **`metadata`**: Additional agent-specific metadata

## Implementation

### Backend: Generating Agent Cards

**Location:** `apps/api/src/agent-platform/services/agent-card-builder.service.ts`

**How it works:**
1. Reads agent configuration from database
2. Generates agent card JSON from agent record
3. Includes all required fields
4. Adds agent-specific metadata

**Example:**
```typescript
@Get(':orgSlug/:agentSlug/.well-known/agent.json')
async getAgentCard(
  @Param('orgSlug') orgSlug: string,
  @Param('agentSlug') agentSlug: string,
): Promise<AgentCard> {
  const agent = await this.agentRegistry.getAgent(orgSlug, agentSlug);
  return this.agentCardBuilder.buildCard(agent);
}
```

### Frontend: Discovering Agents

**How to discover:**
1. Fetch `.well-known/agent.json` from agent URL
2. Parse agent card JSON
3. Extract capabilities, skills, endpoints
4. Use information to build UI or make decisions

**Example:**
```typescript
async function discoverAgent(agentUrl: string): Promise<AgentCard> {
  const response = await fetch(`${agentUrl}/.well-known/agent.json`);
  const card = await response.json();
  return card;
}

// Use discovered capabilities
const card = await discoverAgent('https://api.example.com/agent-to-agent/org/agent');
if (card.capabilities.includes('plan')) {
  // Agent supports planning
}
```

## Hierarchy Endpoint

**Path:** `GET /agent-to-agent/.well-known/hierarchy`

**Purpose:** Discover all available agents in the system

**Response:** Array of agent cards or hierarchy structure

**Example:**
```json
{
  "agents": [
    {
      "name": "agent-1",
      "url": "/agent-to-agent/org/agent-1",
      "capabilities": ["plan", "build"]
    },
    {
      "name": "agent-2",
      "url": "/agent-to-agent/org/agent-2",
      "capabilities": ["converse"]
    }
  ]
}
```

## Important Notes

### Discovery vs Execution

- **Discovery** (`.well-known/agent.json`): For finding out what an agent can do
- **Execution** (`/tasks` endpoint): For actually calling the agent

**They are separate!** Discovery uses agent cards, execution uses transport types.

### Public vs Authenticated

- **Basic agent card**: Public (no auth required) - for discovery
- **Extended agent card**: Authenticated - includes additional metadata

### Caching

Agent cards can be cached since they don't change frequently. Cache invalidation should happen when agent configuration changes.

## Common Issues

### Issue 1: Missing Protocol Field

**❌ Bad:**
```json
{
  "name": "agent",
  "description": "...",
  // Missing protocol field!
}
```

**✅ Good:**
```json
{
  "name": "agent",
  "description": "...",
  "protocol": "google/a2a"
}
```

### Issue 2: Wrong Endpoint URLs

**❌ Bad:**
```json
{
  "url": "https://api.example.com",
  "endpoints": {
    "tasks": "/tasks"  // Relative, but base URL might be wrong
  }
}
```

**✅ Good:**
```json
{
  "url": "https://api.example.com/agent-to-agent/org/agent",
  "endpoints": {
    "tasks": "/tasks",  // Relative to base URL
    "card": "/.well-known/agent.json"
  }
}
```

### Issue 3: Missing Capabilities

**❌ Bad:**
```json
{
  "name": "agent",
  // Missing capabilities array!
}
```

**✅ Good:**
```json
{
  "name": "agent",
  "capabilities": ["plan", "build", "converse"]
}
```

## Integration with Transport Types

Agent cards are **separate from transport types**:
- **Agent cards**: Describe what agent can do (discovery)
- **Transport types**: Define how to call agent (execution)

Both are required for full A2A compliance, but they serve different purposes.

## Testing Discovery

**Test agent card endpoint:**
```bash
curl https://api.example.com/agent-to-agent/demo-org/blog-writer/.well-known/agent.json
```

**Test hierarchy endpoint:**
```bash
curl https://api.example.com/agent-to-agent/.well-known/hierarchy
```

**Verify structure:**
- Check all required fields present
- Verify `protocol: "google/a2a"`
- Verify endpoint URLs are correct
- Verify capabilities match agent's actual capabilities

