---
description: How to build orchestrator agents - agents that coordinate multiple agents and manage workflows. Use when building orchestrator agents, configuring multi-agent coordination, or registering orchestrator agents in the database.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Orchestrator Agent Skill

## Purpose

This skill enables agents to build orchestrator agents - agents that coordinate multiple agents, manage workflows, and orchestrate complex multi-agent tasks.

## When to Use

- **Building Orchestrator Agents**: When creating new orchestrator agents
- **Multi-Agent Coordination**: When configuring agent coordination patterns
- **Agent Definition**: When defining orchestrator agent structure
- **Database Registration**: When registering orchestrator agents in the database

## Core Principles

### 1. Orchestrator Agent Characteristics

**Multi-Agent Coordination:**
- Coordinates multiple agents
- Manages agent execution order
- Aggregates agent results

**Workflow Management:**
- Manages complex workflows
- Handles workflow state
- Coordinates workflow execution

**Delegation Patterns:**
- Delegates tasks to specialized agents
- Routes requests to appropriate agents
- Manages agent dependencies

### 2. Database Structure

**Required Fields:**
- `agent_type: 'orchestrator'`
- `context: string` - Markdown context file content
- `endpoint: null` - Orchestrator agents don't have HTTP endpoints (or use internal endpoints)
- `llm_config: JsonObject | null` - Optional LLM for orchestration logic
- `metadata: JsonObject` - Orchestration configuration

**Orchestration Metadata:**
```typescript
{
  metadata: {
    orchestration: {
      agents: ['agent1', 'agent2', 'agent3'],
      executionOrder: 'sequential' | 'parallel',
      dependencies: {
        agent2: ['agent1'],
        agent3: ['agent1', 'agent2'],
      },
    },
  },
}
```

### 3. Orchestration Patterns

**Sequential Execution:**
- Execute agents in order
- Pass results between agents
- Handle dependencies

**Parallel Execution:**
- Execute agents in parallel
- Aggregate results
- Handle failures

**Conditional Execution:**
- Execute agents based on conditions
- Route based on results
- Handle branching logic

## Agent Definition Pattern

### Basic Orchestrator Agent

```typescript
{
  slug: 'my-orchestrator',
  organization_slug: ['demo-org'],
  name: 'My Orchestrator',
  description: 'Coordinates multiple agents',
  agent_type: 'orchestrator',
  department: 'general',
  tags: ['orchestrator', 'coordination'],
  io_schema: {
    input: {
      type: 'object',
      properties: {
        task: { type: 'string' },
      },
      required: ['task'],
    },
    output: {
      type: 'object',
      properties: {
        result: { type: 'object' },
        agentsExecuted: { type: 'array' },
      },
    },
  },
  capabilities: ['orchestration', 'multi-agent-coordination'],
  context: '# My Orchestrator\n\nCoordinates agents for complex tasks...',
  endpoint: null, // Orchestrator uses internal coordination
  llm_config: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
  },
  metadata: {
    orchestration: {
      agents: ['agent1', 'agent2'],
      executionOrder: 'sequential',
    },
  },
}
```

## Execution Flow

### BUILD Mode

1. **Plan Execution**:
   - Analyze task requirements
   - Determine which agents to coordinate
   - Plan execution order

2. **Execute Agents**:
   - Call agents in planned order
   - Pass results between agents
   - Handle agent failures

3. **Aggregate Results**:
   - Combine agent results
   - Format final output
   - Save deliverable

## Database Registration

### Registration Pattern

```typescript
await agentsRepository.upsert({
  slug: 'my-orchestrator',
  organization_slug: ['demo-org'],
  name: 'My Orchestrator',
  description: 'Orchestrator description',
  agent_type: 'orchestrator',
  department: 'general',
  tags: ['orchestrator'],
  io_schema: { /* schema */ },
  capabilities: ['orchestration'],
  context: '# Orchestrator Context\n\n...',
  endpoint: null, // Orchestrator uses internal coordination
  llm_config: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
  },
  metadata: {
    orchestration: {
      agents: ['agent1', 'agent2'],
    },
  },
});
```

## Common Patterns

### Sequential Orchestrator

```typescript
{
  slug: 'sequential-orchestrator',
  agent_type: 'orchestrator',
  context: '# Sequential Orchestrator\n\nExecutes agents in sequence...',
  metadata: {
    orchestration: {
      agents: ['plan-agent', 'build-agent', 'review-agent'],
      executionOrder: 'sequential',
    },
  },
}
```

### Parallel Orchestrator

```typescript
{
  slug: 'parallel-orchestrator',
  agent_type: 'orchestrator',
  context: '# Parallel Orchestrator\n\nExecutes agents in parallel...',
  metadata: {
    orchestration: {
      agents: ['agent1', 'agent2', 'agent3'],
      executionOrder: 'parallel',
    },
  },
}
```

## Violations

### ❌ Missing Orchestration Config

```typescript
// ❌ WRONG: Orchestrator agents should have orchestration config
{
  agent_type: 'orchestrator',
  metadata: {}, // Missing orchestration config
}
```

**✅ FIX: Provide orchestration configuration**
```typescript
// ✅ CORRECT: Orchestrator agents should have orchestration config
{
  agent_type: 'orchestrator',
  metadata: {
    orchestration: {
      agents: ['agent1', 'agent2'], // REQUIRED
    },
  },
}
```

## Related

- **`agent-builder-agent.md`** - Main orchestrator
- **`execution-context-skill/`** - ExecutionContext validation
- **`transport-types-skill/`** - A2A compliance

