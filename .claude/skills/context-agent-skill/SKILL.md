---
name: context-agent-skill
description: How to build context agents - knowledge-based agents using markdown context files. Use when building context agents, creating agent definitions, or registering context agents in the database.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "builder"
type: "prescriptive"
used-by-agents: ["agent-builder-agent"]
related-skills: ["agent-builder-skill", "rag-agent-skill"]
---

# Context Agent Skill

## Purpose

This skill enables agents to build context agents - knowledge-based agents that use markdown context files and fetch contextual information (plans, deliverables, conversation history) to generate responses via LLM.

## When to Use

- **Building Context Agents**: When creating new context agents
- **Agent Definition**: When defining agent structure and requirements
- **Database Registration**: When registering context agents in the database
- **Validation**: When validating context agent definitions

## Core Principles

### 1. Context Agent Characteristics

**Knowledge-Driven:**
- Primary intelligence comes from structured markdown context
- Context stored in `context` column (markdown)
- Can fetch additional context from plans, deliverables, conversation history

**LLM-Based:**
- Uses LLM to generate responses
- Combines markdown context with fetched context
- Optimizes context to token budget

**No External APIs:**
- Does not call external HTTP APIs
- Does not generate media
- Pure LLM-based intelligence

### 2. Database Structure

**Required Fields:**
- `agent_type: 'context'`
- `context: string` - Markdown context file content
- `llm_config: JsonObject` - LLM provider, model, temperature, etc.
- `endpoint: null` - Context agents don't have endpoints

**Optional Fields:**
- `metadata: JsonObject` - Additional configuration (context sources, token budget, etc.)

### 3. Context Sources

**Available Context Sources:**
- `plans` - Project plans
- `deliverables` - Previous deliverables
- `conversation` - Conversation history
- `custom` - Custom context sources

**Pattern:**
```typescript
{
  metadata: {
    context: {
      sources: ['plans', 'deliverables', 'conversation'],
      systemPromptTemplate: 'Analyze: {{plan.content}}',
      tokenBudget: 8000,
    },
  },
}
```

## Agent Definition Pattern

### Basic Context Agent

```typescript
{
  slug: 'my-context-agent',
  organization_slug: ['demo-org'],
  name: 'My Context Agent',
  description: 'Expert in specific domain',
  agent_type: 'context',
  department: 'general',
  tags: ['expert', 'domain'],
  io_schema: {
    input: {
      type: 'object',
      properties: {
        question: { type: 'string' },
      },
      required: ['question'],
    },
    output: {
      type: 'object',
      properties: {
        answer: { type: 'string' },
      },
    },
  },
  capabilities: ['expert-advice', 'q-and-a'],
  context: '# My Context Agent\n\nYou are an expert in...',
  llm_config: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    temperature: 0.7,
    maxTokens: 4000,
  },
  endpoint: null,
  metadata: {
    context: {
      sources: ['conversation'],
      tokenBudget: 8000,
    },
  },
}
```

### Context Agent with Plan Analysis

```typescript
{
  slug: 'plan-analyzer',
  agent_type: 'context',
  context: '# Plan Analyzer\n\nYou analyze project plans...',
  llm_config: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
  },
  metadata: {
    context: {
      sources: ['plans', 'deliverables'],
      systemPromptTemplate: 'Analyze this plan: {{plan.content}}',
      tokenBudget: 10000,
    },
  },
}
```

## Execution Flow

### BUILD Mode

1. **Fetch Context**:
   - From configured sources (plans, deliverables, conversation)
   - From markdown context file

2. **Optimize Context**:
   - Reduce to token budget
   - Prioritize relevant information

3. **Combine Context**:
   - Merge markdown context with fetched context
   - Interpolate into system prompt template

4. **LLM Call**:
   - Single LLM call with optimized context
   - Generate response

5. **Save Deliverable**:
   - Store result as deliverable
   - Link to conversation

## Database Registration

### Registration Pattern

```typescript
await agentsRepository.upsert({
  slug: 'my-context-agent',
  organization_slug: ['demo-org'],
  name: 'My Context Agent',
  description: 'Agent description',
  agent_type: 'context',
  department: 'general',
  tags: ['tag1'],
  io_schema: { /* schema */ },
  capabilities: ['capability1'],
  context: '# Agent Context\n\n...',
  llm_config: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    temperature: 0.7,
  },
  endpoint: null, // Context agents don't have endpoints
  metadata: {
    context: {
      sources: ['conversation'],
    },
  },
});
```

## Common Patterns

### Expert Q&A Agent

```typescript
{
  slug: 'golf-rules-expert',
  agent_type: 'context',
  context: '# Golf Rules Expert\n\nYou are an expert in golf rules...',
  capabilities: ['golf-rules', 'q-and-a'],
  llm_config: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
  },
}
```

### Plan Analyzer Agent

```typescript
{
  slug: 'plan-analyzer',
  agent_type: 'context',
  context: '# Plan Analyzer\n\nYou analyze project plans...',
  capabilities: ['plan-analysis', 'quality-review'],
  metadata: {
    context: {
      sources: ['plans'],
      systemPromptTemplate: 'Analyze: {{plan.content}}',
    },
  },
}
```

## Violations

### ❌ Using Endpoint for Context Agent

```typescript
// ❌ WRONG: Context agents don't have endpoints
{
  agent_type: 'context',
  endpoint: { url: '...' }, // WRONG
}
```

**✅ FIX: Endpoint must be null**
```typescript
// ✅ CORRECT: Context agents don't have endpoints
{
  agent_type: 'context',
  endpoint: null, // CORRECT
}
```

### ❌ Missing LLM Config

```typescript
// ❌ WRONG: Context agents require LLM config
{
  agent_type: 'context',
  llm_config: null, // WRONG
}
```

**✅ FIX: Provide LLM config**
```typescript
// ✅ CORRECT: Context agents require LLM config
{
  agent_type: 'context',
  llm_config: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
  },
}
```

## Related

- **`agent-builder-agent.md`** - Main orchestrator
- **`execution-context-skill/`** - ExecutionContext validation
- **`transport-types-skill/`** - A2A compliance

## Self-Reporting

**When this skill is loaded, the agent using it should log the event:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('skill', 'context-agent-skill', 'loaded',
  '{\"loaded_by\": \"agent-name\", \"context\": \"description\"}'::jsonb);"
```

**After using the skill's patterns, log if they helped:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('skill', 'context-agent-skill', 'helped', true,
  '{\"outcome\": \"what the skill helped with\"}'::jsonb);"
```

