# Agent Builder Architecture

This document explains how agents are built and registered in the Orchestrator AI system.

## Overview

The agent builder system provides a structured way to create agents of different types, with extensible support for multiple frameworks (LangGraph, N8N, and future frameworks).

## Components

### Main Orchestrator
**`agent-builder-agent.md`** - Main agent builder that:
- Determines agent type (context, rag, media, API, external, orchestrator)
- Routes to appropriate agent-type skill
- Coordinates the full agent creation workflow
- Handles database registration

### Agent Type Skills (One Per Type)
Each agent type has its own skill with type-specific knowledge:

- **`context-agent-skill/`** - How to build context agents
  - Knowledge-based intelligence patterns
  - Context retrieval patterns
  - Database requirements

- **`rag-agent-skill/`** - How to build RAG agents
  - RAG collection setup
  - Embedding patterns
  - Retrieval patterns

- **`media-agent-skill/`** - How to build media agents
  - Image generation patterns
  - Video generation patterns
  - Media storage patterns

- **`api-agent-skill/`** - How to build API agents
  - Determines framework (LangGraph, N8N, future frameworks)
  - Routes to appropriate framework-specific builder
  - API endpoint patterns
  - Database registration requirements

- **`external-agent-skill/`** - How to build external agents
  - External service integration
  - A2A protocol for external calls
  - Discovery patterns

- **`orchestrator-agent-skill/`** - How to build orchestrator agents (if needed)
  - Workflow coordination patterns
  - Multi-agent orchestration

### Framework-Specific Sub-Agents (Extensible Pattern)

For API agents, separate sub-agents handle framework-specific building:

- **`langgraph-api-agent-builder.md`** - Builds LangGraph API agents
  - Delegates to `langgraph-architecture-agent` to build workflows
  - `langgraph-architecture-agent` uses `langgraph-development-skill` for patterns
  - Handles LangGraph-specific database registration
  - **Also maintains** existing LangGraph agents (updates, fixes, refactors)

- **`n8n-api-agent-builder.md`** - Builds N8N API agents
  - Uses N8N MCP to create workflows
  - Uses `n8n-development-skill` for patterns (via n8n workflows)
  - Handles N8N-specific database registration
  - **Also maintains** existing N8N agents (updates, fixes, refactors)

- **Future frameworks** (extensible):
  - `crewai-api-agent-builder.md` - For CrewAI framework
  - `autogen-api-agent-builder.md` - For AutoGen framework
  - etc.

## The Workflow

### Scenario 1: Building via agent-builder-agent

```
User: "Create a new blog writer agent"

agent-builder-agent:
  1. Analyzes requirements
  2. Determines: This is an API agent
  3. Loads: api-agent-skill
  4. api-agent-skill analyzes requirements:
     - Determines: LangGraph (or N8N, or future framework)
  5. Routes to framework-specific builder:
     - langgraph-api-agent-builder (if LangGraph)
     - n8n-api-agent-builder (if N8N)
  6. Framework builder:
     - Delegates to appropriate architecture agent (langgraph-architecture-agent)
     - Architecture agent uses development skill (langgraph-development-skill)
     - Architecture agent builds the workflow code
  7. Framework builder registers agent in database
  8. Returns agent details to user
```

### Scenario 2: Building via Architecture Agent

```
User: "Build a LangGraph workflow for data analysis"

langgraph-architecture-agent:
  1. Builds LangGraph workflow code
  2. Validates against langgraph-development-skill
  3. Validates ExecutionContext and A2A compliance
  4. Completes code
  5. Calls: agent-builder-agent to register
     - agent-builder-agent determines: API agent type
     - Routes to: langgraph-api-agent-builder
     - langgraph-api-agent-builder handles registration
  6. Returns agent details
```

## Framework Decision Logic

**`api-agent-skill` determines framework based on:**

1. **User preference** - Explicitly stated (LangGraph, N8N, etc.)
2. **Requirements analysis**:
   - LangGraph: Complex workflows, HITL, state management
   - N8N: Drag-and-drop, visual workflows, simpler integrations
   - Future frameworks: Based on their strengths
3. **Default**: LangGraph (primary framework)

## Database Registration

All agents must be registered in the `public.agents` table with:
- `agent_slug` - Unique identifier
- `agent_type` - context, rag, media, api, external, orchestrator
- `organization_slug` - Organization context
- `source` - 'database' for registered agents
- Framework-specific metadata (for API agents)

**Registration handled by:**
- `agent-builder-agent` - Main orchestrator
- Framework-specific builders - For API agents
- Agent-type skills - For non-API agents

## Extensibility Pattern

### Adding a New Framework

1. **Create framework-specific builder:**
   - `[framework]-api-agent-builder.md`
   - Follows same pattern as LangGraph/N8N builders

2. **Update api-agent-skill:**
   - Add framework to decision logic
   - Add routing to new builder

3. **Create framework development skill (if needed):**
   - `[framework]-development-skill/`
   - Documents framework-specific patterns

4. **Create framework architecture agent (if needed):**
   - `[framework]-architecture-agent.md`
   - For complex framework-specific building

**Example: Adding CrewAI**
```
1. Create: crewai-api-agent-builder.md
2. Update: api-agent-skill (add CrewAI decision logic)
3. Create: crewai-development-skill/ (if needed)
4. Create: crewai-architecture-agent.md (if needed)
```

## Integration with Architecture Agents

**Architecture agents can build agents in their domain:**

- **langgraph-architecture-agent** - Builds LangGraph workflows
  - Then calls `agent-builder-agent` to register as API agent

- **api-architecture-agent** - Builds API endpoints
  - Then calls `agent-builder-agent` to register

- **web-architecture-agent** - Builds web components
  - Then calls `agent-builder-agent` to register (if agent has UI)

## Critical Skills (Always Used)

**Agent builders delegate to architecture agents, which use:**
- **execution-context-skill** - ExecutionContext flow validation (via architecture agents)
- **transport-types-skill** - A2A protocol compliance (via architecture agents)

**Architecture agents use framework-specific skills:**
- **langgraph-development-skill** - Used by langgraph-architecture-agent
- **n8n-development-skill** - Used by N8N workflows
- **Future framework skills** - Used by future architecture agents

**Note:** Agent builders don't directly use development skills - they delegate to architecture agents, which use the skills. However, if the agent builder is also the maintainer (updating existing agents), it would use the same architecture agents and skills for maintenance tasks.

## Benefits

- ✅ **Extensible**: Easy to add new frameworks
- ✅ **Structured**: Clear separation of concerns
- ✅ **Reusable**: Architecture agents can build, then register
- ✅ **Type-safe**: Each agent type has its own skill
- ✅ **Framework-agnostic**: Main builder doesn't need to know frameworks
- ✅ **Growth pattern**: New frameworks fit naturally into structure

## Agent Builder vs Maintainer

**Key Question:** Is the agent builder also the maintainer?

**Answer:** Yes - framework-specific builders handle both:
- **Building** new agents
- **Maintaining** existing agents (updates, fixes, refactors)

**How it works:**
- **Building:** Delegates to architecture agents, which use development skills
- **Maintaining:** Uses same architecture agents and skills to update existing agents
- **No separate skills needed:** Architecture agents already have the development skills

**Example:**
```
langgraph-api-agent-builder:
  Building new agent:
    1. Delegates to langgraph-architecture-agent
    2. langgraph-architecture-agent uses langgraph-development-skill
    3. Registers agent
  
  Maintaining existing agent:
    1. Loads existing agent code
    2. Delegates to langgraph-architecture-agent for updates
    3. langgraph-architecture-agent uses langgraph-development-skill
    4. Updates agent in database
```

## Summary

- **agent-builder-agent** = Main orchestrator
- **Agent-type skills** = Type-specific knowledge (context, rag, media, api, external)
- **Framework builders** = Framework-specific building AND maintenance (LangGraph, N8N, future)
- **Architecture agents** = Do the actual building/maintenance work
- **Development skills** = Used by architecture agents (not directly by builders)
- **Extensible** = New frameworks add new builders, not modify existing ones

