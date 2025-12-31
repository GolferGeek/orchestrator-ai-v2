---
name: rag-agent-skill
description: How to build RAG agents - agents that query RAG collections and augment LLM responses with retrieved context. Use when building RAG agents, setting up RAG collections, or registering RAG agents in the database.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "builder"
type: "prescriptive"
used-by-agents: ["agent-builder-agent"]
related-skills: ["agent-builder-skill", "context-agent-skill"]
---

# RAG Agent Skill

## Purpose

This skill enables agents to build RAG (Retrieval-Augmented Generation) agents - agents that query RAG collections, retrieve relevant documents, and augment LLM responses with retrieved context.

## When to Use

- **Building RAG Agents**: When creating new RAG agents
- **RAG Collection Setup**: When setting up RAG collections for agents
- **Agent Definition**: When defining RAG agent structure
- **Database Registration**: When registering RAG agents in the database

## Core Principles

### 1. RAG Agent Characteristics

**RAG Collection Integration:**
- Queries RAG collections for relevant documents
- Uses embeddings for semantic search
- Retrieves top-k relevant documents

**LLM Augmentation:**
- Augments LLM prompt with retrieved context
- Combines retrieved context with markdown context
- Generates responses using augmented context

**No External APIs:**
- Does not call external HTTP APIs (except RAG service)
- Does not generate media
- RAG + LLM based intelligence

### 2. Database Structure

**Required Fields:**
- `agent_type: 'rag-runner'`
- `context: string` - Markdown context file content
- `llm_config: JsonObject` - LLM provider, model, etc.
- `endpoint: null` - RAG agents don't have HTTP endpoints
- `metadata: JsonObject` - RAG collection configuration

**RAG Metadata:**
```typescript
{
  metadata: {
    ragCollection: 'collection-name',
    embeddingModel: 'text-embedding-3-large',
    topK: 5,
    similarityThreshold: 0.7,
  },
}
```

### 3. RAG Collection Setup

**Collection Requirements:**
- RAG collection must exist
- Collection must have embeddings
- Collection must be queryable

**Pattern:**
```typescript
{
  metadata: {
    ragCollection: 'my-collection',
    embeddingModel: 'text-embedding-3-large',
    retrievalConfig: {
      topK: 5,
      similarityThreshold: 0.7,
      rerank: true,
    },
  },
}
```

## Agent Definition Pattern

### Basic RAG Agent

```typescript
{
  slug: 'my-rag-agent',
  organization_slug: ['demo-org'],
  name: 'My RAG Agent',
  description: 'RAG-based agent with document retrieval',
  agent_type: 'rag-runner',
  department: 'general',
  tags: ['rag', 'document-retrieval'],
  io_schema: {
    input: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
    output: {
      type: 'object',
      properties: {
        answer: { type: 'string' },
        sources: { type: 'array' },
      },
    },
  },
  capabilities: ['document-retrieval', 'q-and-a'],
  context: '# My RAG Agent\n\nUses RAG collection to answer questions...',
  llm_config: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    temperature: 0.7,
  },
  endpoint: null,
  metadata: {
    ragCollection: 'my-collection',
    embeddingModel: 'text-embedding-3-large',
    topK: 5,
    similarityThreshold: 0.7,
  },
}
```

## Execution Flow

### BUILD Mode

1. **Query RAG Collection**:
   - Generate query embedding
   - Search collection for relevant documents
   - Retrieve top-k documents

2. **Augment Context**:
   - Combine retrieved documents with markdown context
   - Format retrieved context for LLM

3. **LLM Call**:
   - Augment prompt with retrieved context
   - Generate response using augmented context

4. **Save Deliverable**:
   - Store result as deliverable
   - Include source citations

## Database Registration

### Registration Pattern

```typescript
await agentsRepository.upsert({
  slug: 'my-rag-agent',
  organization_slug: ['demo-org'],
  name: 'My RAG Agent',
  description: 'RAG-based agent',
  agent_type: 'rag-runner',
  department: 'general',
  tags: ['rag'],
  io_schema: { /* schema */ },
  capabilities: ['document-retrieval'],
  context: '# RAG Agent Context\n\n...',
  llm_config: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
  },
  endpoint: null, // RAG agents don't have HTTP endpoints
  metadata: {
    ragCollection: 'my-collection',
    embeddingModel: 'text-embedding-3-large',
    topK: 5,
  },
});
```

## Common Patterns

### Document Q&A Agent

```typescript
{
  slug: 'document-qa',
  agent_type: 'rag-runner',
  context: '# Document Q&A Agent\n\nAnswers questions using document collection...',
  capabilities: ['document-qa', 'citation'],
  metadata: {
    ragCollection: 'documents',
    topK: 10,
    rerank: true,
  },
}
```

### Knowledge Base Agent

```typescript
{
  slug: 'knowledge-base',
  agent_type: 'rag-runner',
  context: '# Knowledge Base Agent\n\nSearches knowledge base...',
  capabilities: ['knowledge-retrieval'],
  metadata: {
    ragCollection: 'knowledge-base',
    embeddingModel: 'text-embedding-3-large',
    similarityThreshold: 0.8,
  },
}
```

## Violations

### ❌ Missing RAG Collection

```typescript
// ❌ WRONG: RAG agents require collection
{
  agent_type: 'rag-runner',
  metadata: {}, // Missing ragCollection
}
```

**✅ FIX: Provide RAG collection**
```typescript
// ✅ CORRECT: RAG agents require collection
{
  agent_type: 'rag-runner',
  metadata: {
    ragCollection: 'my-collection', // REQUIRED
  },
}
```

### ❌ Using Endpoint for RAG Agent

```typescript
// ❌ WRONG: RAG agents don't have HTTP endpoints
{
  agent_type: 'rag-runner',
  endpoint: { url: '...' }, // WRONG
}
```

**✅ FIX: Endpoint must be null**
```typescript
// ✅ CORRECT: RAG agents don't have HTTP endpoints
{
  agent_type: 'rag-runner',
  endpoint: null, // CORRECT
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
VALUES ('skill', 'rag-agent-skill', 'loaded',
  '{\"loaded_by\": \"agent-name\", \"context\": \"description\"}'::jsonb);"
```

**After using the skill's patterns, log if they helped:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('skill', 'rag-agent-skill', 'helped', true,
  '{\"outcome\": \"what the skill helped with\"}'::jsonb);"
```
