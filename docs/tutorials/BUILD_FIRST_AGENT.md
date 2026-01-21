# Build Your First Agent Tutorial

This tutorial will guide you through creating your first Orchestrator AI agent from scratch.

## Prerequisites

- Orchestrator AI platform running (see [Quick Start Guide](../QUICK_START_STUDENTS.md))
- Logged in with demo credentials or your own account
- Basic understanding of JSON and APIs

## What You'll Build

A simple "Hello World" agent that greets users and responds to basic questions.

## Step 1: Understand Agent Structure

An Orchestrator AI agent has these key components:

1. **Metadata**: Name, description, version, type
2. **IO Schema**: Input/output structure (JSON Schema)
3. **Context**: System prompt that defines agent behavior
4. **Capabilities**: What the agent can do
5. **LLM Config**: Which model to use

## Step 2: Understand Agent Structure

In Orchestrator AI v2, agents are stored in the database, not as static files. An agent has these key components:

1. **Metadata**: slug, name, description, version, type
2. **IO Schema**: Input/output structure (JSON Schema)
3. **Context**: System prompt that defines agent behavior
4. **Capabilities**: What the agent can do
5. **LLM Config**: Which model to use (for context agents)

**Note**: You can reference the `demo-agents/hello-world/` example to see a sample agent structure, but agents are created directly in the database.

## Step 3: Create the Agent

### Option A: Using the Web UI (Recommended)

1. Log in to http://localhost:7101
2. Navigate to "Agents" → "Create Agent"
3. Fill in the form with:
   - **Slug**: `hello-world`
   - **Name**: `Hello World Agent`
   - **Description**: `A simple greeting agent that demonstrates basic agent creation`
   - **Agent Type**: `context`
   - **Department**: `general`
   - **Tags**: `tutorial`, `beginner`, `greeting`
   - **IO Schema**: 
     ```json
     {
       "input": {
         "type": "object",
         "properties": {
           "name": {"type": "string", "description": "The user's name"},
           "question": {"type": "string", "description": "A question or message"}
         },
         "required": ["question"]
       },
       "output": {
         "type": "object",
         "properties": {
           "greeting": {"type": "string"},
           "response": {"type": "string"}
         },
         "required": ["greeting", "response"]
       }
     }
     ```
   - **Capabilities**: `greeting`, `basic-qa`
   - **Context**: `You are a friendly assistant named Hello World Agent. Your purpose is to greet users warmly and answer simple questions in a helpful, concise manner. Always be polite and enthusiastic.`
   - **LLM Config**: 
     ```json
     {
       "provider": "ollama",
       "model": "llama3.2:1b",
       "parameters": {
         "temperature": 0.7,
         "maxTokens": 500
       }
     }
     ```
4. Select your organization (e.g., `demo-org`)
5. Click "Create"

### Option B: Using the API

```bash
curl -X POST http://localhost:6100/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "slug": "hello-world",
    "organization_slug": ["demo-org"],
    "name": "Hello World Agent",
    "description": "A simple greeting agent",
    "agent_type": "context",
    "department": "general",
    "tags": ["tutorial", "beginner"],
    "io_schema": {
      "input": {
        "type": "object",
        "properties": {
          "question": {"type": "string"}
        },
        "required": ["question"]
      },
      "output": {
        "type": "object",
        "properties": {
          "greeting": {"type": "string"},
          "response": {"type": "string"}
        }
      }
    },
    "capabilities": ["greeting", "basic-qa"],
    "context": "You are a friendly assistant...",
    "llm_config": {
      "provider": "ollama",
      "model": "llama3.2:1b",
      "parameters": {"temperature": 0.7, "maxTokens": 500}
    }
  }'
```

### Option C: Using SQL (Direct Database)

```sql
INSERT INTO public.agents (
  slug, organization_slug, name, description, version,
  agent_type, department, tags, io_schema, capabilities,
  context, llm_config
) VALUES (
  'hello-world',
  ARRAY['demo-org']::TEXT[],
  'Hello World Agent',
  'A simple greeting agent',
  '1.0.0',
  'context',
  'general',
  ARRAY['tutorial', 'beginner', 'greeting']::TEXT[],
  '{"input": {...}, "output": {...}}'::jsonb,
  ARRAY['greeting', 'basic-qa']::TEXT[],
  'You are a friendly assistant...',
  '{"provider": "ollama", "model": "llama3.2:1b", "parameters": {...}}'::jsonb
);
```

## Step 4: Test Your Agent

### Via Web UI

1. Go to the agent catalog
2. Find "Hello World Agent"
3. Click "Start Conversation"
4. Try: "Hello! My name is Alice. What can you do?"

### Via API

```bash
curl -X POST http://localhost:6100/agents/hello-world/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "taskId": "test-123",
    "conversationId": "conv-123",
    "content": {
      "name": "Alice",
      "question": "Hello! What can you do?"
    }
  }'
```

## Step 5: Understand the Response

Your agent should return:

```json
{
  "greeting": "Hello Alice! Nice to meet you!",
  "response": "I'm the Hello World Agent, and I'm here to help you with basic questions and provide friendly greetings. What would you like to know?"
}
```

## Understanding Each Component

### IO Schema

The `io_schema` defines what your agent expects and returns:

- **Input**: What data the user provides
- **Output**: What the agent returns
- Uses JSON Schema format for validation

### Context (System Prompt)

The `context` field is the agent's "personality" and instructions. This is sent to the LLM as the system prompt.

### Capabilities

Capabilities are tags that describe what the agent can do. They're used for:
- Agent discovery
- Filtering in the catalog
- Understanding agent purpose

### LLM Config

Defines which language model to use:

- **provider**: `ollama` (local), `anthropic`, `openai`, etc.
- **model**: Specific model name
- **temperature**: Creativity (0.0 = deterministic, 1.0 = creative)
- **max_tokens**: Maximum response length

## Common Issues

### Agent Not Found

**Problem**: Agent doesn't appear in catalog

**Fix**: 
- Verify agent was created successfully
- Check organization assignment
- Refresh the web page

### Invalid Schema Error

**Problem**: "Invalid IO schema" error

**Fix**:
- Validate JSON syntax
- Ensure required fields are present
- Check JSON Schema format

### LLM Not Responding

**Problem**: Agent times out or returns errors

**Fix**:
- Check if Ollama is running: `curl http://localhost:11434/api/tags`
- Verify model exists: `ollama list`
- Pull model if missing: `ollama pull llama3.2:1b`

## Next Steps

Now that you've built your first agent:

1. **Experiment**: Modify the context prompt and see how behavior changes
2. **Add Capabilities**: Try adding more complex capabilities
3. **Build More Agents**: Use this pattern to create your own agents
4. **Read Documentation**: See `docs/EXAMPLES.md` for advanced patterns

## Advanced: Adding More Features

### Add Memory

Enable conversation memory by adding to your agent:

```json
{
  "metadata": {
    "enable_memory": true,
    "memory_window": 10
  }
}
```

### Add Streaming

Enable real-time response streaming:

```json
{
  "metadata": {
    "streaming": true
  }
}
```

### Add RAG (Retrieval-Augmented Generation)

Connect your agent to a knowledge base:

```json
{
  "rag_config": {
    "collection_slug": "my-knowledge-base",
    "max_results": 5
  }
}
```

## Resources

- **Example Agent**: `demo-agents/hello-world/` - Reference example showing agent structure
- **Database Schema**: See `apps/api/supabase/migrations/` for agent table structure
- **API Documentation**: See API endpoints in `apps/api/src/agents/`
- **Architecture Guide**: `ARCHITECTURE.md`
- **Examples Guide**: `docs/EXAMPLES.md` - Real-world examples from the codebase

---

Congratulations! You've built your first agent. 🎉
