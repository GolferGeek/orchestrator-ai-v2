---
name: n8n-development-skill
description: Enforce prescriptive patterns for building N8N workflows that integrate with Orchestrator AI. N8N is an optional external workflow tool. Use when developing or reviewing N8N workflows.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "development"
type: "prescriptive"
used-by-agents: []
related-skills: ["api-agent-skill", "execution-context-skill"]
---

# N8N Development Skill

This skill enforces prescriptive patterns for building N8N workflows that integrate seamlessly with the Orchestrator AI ecosystem. **N8N runs externally** - it's an optional workflow tool that users install and run separately. The same integration patterns apply to LangGraph, CrewAI, or any other workflow system.

## N8N Setup (External)

N8N runs as a separate application on the standard port **5678**.

| Environment | N8N URL | Orchestrator API |
|-------------|---------|------------------|
| Local | `http://localhost:5678` | `http://localhost:6100` |
| Docker | `http://localhost:5678` | `http://host.docker.internal:6100` |
| Production | `https://n8n.yourdomain.com` | `https://api.yourdomain.com` |

**Quick Start (Docker with SQLite - Recommended):**
```bash
docker run -d --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n:latest
```

Then access N8N at http://localhost:5678

**Why SQLite (default)?**
- Simpler - one container, no database setup
- Self-contained - N8N data stays in `~/.n8n`
- Portable - just backup the folder
- Sufficient for single-instance use (local dev or production)

Only use Postgres if you need N8N clustering/HA.

## Core Principles

1. **N8N is External**: N8N is not part of this codebase. Users install and run it separately.
2. **ExecutionContext as Single Source of Truth**: The `ExecutionContext` capsule must flow through the entire workflow, never cherry-picked or partially passed. It is received, not constructed, within N8N.
3. **Prescriptive Integration**: All external interactions (LLM calls, observability events) must go through Orchestrator AI API endpoints, not direct provider APIs.
4. **Helper LLM Pattern**: Use the reusable "Helper: LLM Task" sub-workflow for all LLM calls to ensure consistency.
5. **Status Tracking**: All workflows must emit observability events via the status webhook endpoint.

## Key Areas of Enforcement

### 1. ExecutionContext Flow

- **Receive, Don't Create**: `ExecutionContext` is passed into the workflow via webhook body, never instantiated within N8N nodes.
- **Pass Whole Capsule**: Always pass the entire `ExecutionContext` object to API endpoints (LLM, Observability).
- **Extract from Webhook**: The webhook body should include the full `context` object from the A2A request.

**Example (Webhook Body):**
```json
{
  "context": {
    "orgSlug": "acme-corp",
    "userId": "user-uuid",
    "conversationId": "conv-uuid",
    "taskId": "task-uuid",
    "planId": "00000000-0000-0000-0000-000000000000",
    "deliverableId": "00000000-0000-0000-0000-000000000000",
    "agentSlug": "marketing-swarm",
    "agentType": "api",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "userMessage": "Generate marketing content",
  "payload": {
    "action": "generate",
    "contentType": "blog-post"
  }
}
```

**Example (Passing to API):**
```javascript
// In HTTP Request node to LLM endpoint
{
  "systemPrompt": "You are a helpful assistant.",
  "userPrompt": "{{ $json.userMessage }}",
  "context": {{ $json.context }},  // Pass entire context object
  "options": {
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

### 2. LLM Service Integration

- **Use Orchestrator AI LLM Endpoint**: All LLM calls must go through `POST /llm/generate` (not direct provider APIs).
- **Full Context Required**: The LLM endpoint requires the full `ExecutionContext` in the request body.
- **Helper LLM Pattern**: Use the reusable "Helper: LLM Task" workflow (`9jxl03jCcqg17oOy`) for all LLM calls.

**LLM Endpoint:**
```
POST http://localhost:6100/llm/generate
```

**Request Format:**
```json
{
  "systemPrompt": "You are a helpful assistant.",
  "userPrompt": "Generate content about...",
  "context": {
    // Full ExecutionContext object
    "orgSlug": "...",
    "userId": "...",
    "conversationId": "...",
    "taskId": "...",
    "planId": "...",
    "deliverableId": "...",
    "agentSlug": "...",
    "agentType": "...",
    "provider": "...",
    "model": "..."
  },
  "options": {
    "temperature": 0.7,
    "maxTokens": 1000,
    "callerType": "n8n",
    "callerName": "workflow-name"
  }
}
```

**Helper LLM Pattern:**
Use "Execute Workflow" node to call the Helper LLM sub-workflow:
```javascript
{
  "source": "database",
  "workflowId": "9jxl03jCcqg17oOy",  // Helper: LLM Task
  "fieldMapping": {
    "fields": [
      { "name": "provider", "value": "{{ $json.context.provider }}" },
      { "name": "model", "value": "{{ $json.context.model }}" },
      { "name": "prompt", "value": "Your task-specific prompt" },
      { "name": "temperature", "value": 0.7 },
      { "name": "maxTokens", "value": 1000 },
      { "name": "sendStartStatus", "value": true },
      { "name": "sendEndStatus", "value": true },
      { "name": "statusWebhook", "value": "http://host.docker.internal:6100/webhooks/status" },
      { "name": "taskId", "value": "{{ $json.context.taskId }}" },
      { "name": "conversationId", "value": "{{ $json.context.conversationId }}" },
      { "name": "userId", "value": "{{ $json.context.userId }}" },
      { "name": "stepName", "value": "descriptive_step_name" },
      { "name": "sequence", "value": 1 },
      { "name": "totalSteps", "value": 3 }
    ]
  }
}
```

### 3. Observability Service Integration

- **Status Webhook Endpoint**: All workflow status updates must be sent to `POST /webhooks/status`.
- **Full Context Required**: Status updates must include the full `ExecutionContext` in the `context` field.
- **Progress Tracking**: Use `sequence` and `totalSteps` for multi-step workflows.

**Observability Endpoint:**
```
POST http://localhost:6100/webhooks/status
```

**Status Update Format:**
```json
{
  "taskId": "task-uuid",
  "status": "running|completed|failed",
  "timestamp": "2025-01-12T10:00:00.000Z",
  "context": {
    // Full ExecutionContext object - REQUIRED
    "orgSlug": "...",
    "userId": "...",
    "conversationId": "...",
    "taskId": "...",
    "planId": "...",
    "deliverableId": "...",
    "agentSlug": "...",
    "agentType": "...",
    "provider": "...",
    "model": "..."
  },
  "step": "step-name",
  "message": "Processing step...",
  "sequence": 1,
  "totalSteps": 4,
  "percent": 25
}
```

**Example (HTTP Request Node):**
```javascript
// URL: http://host.docker.internal:6100/webhooks/status
// Method: POST
// Body:
{
  "taskId": "{{ $json.context.taskId }}",
  "status": "running",
  "timestamp": "{{ $now.toISO() }}",
  "context": {{ $json.context }},  // Pass entire context
  "step": "processing",
  "message": "Starting workflow",
  "sequence": 1,
  "totalSteps": 4
}
```

### 4. Workflow Structure Patterns

**Standard Workflow Structure:**
```
Webhook Trigger (POST /webhook/workflow-name)
  ↓
Extract Config (parse input, validate ExecutionContext)
  ↓
Send Workflow Start Status (optional)
  ↓
[Workflow Steps - can be parallel or sequential]
  ├─→ Helper LLM Call #1 (Execute Workflow node)
  ├─→ Helper LLM Call #2 (Execute Workflow node)
  └─→ Helper LLM Call #3 (Execute Workflow node)
  ↓
Combine Results (if multiple LLM calls)
  ↓
Send Final Status
  ↓
Respond to Webhook (return results)
```

**Parallel Execution Pattern:**
Use N8N's parallel execution capabilities for independent tasks:
```javascript
// Multiple Execute Workflow nodes in parallel
// Each calls Helper LLM with different prompts
// Results are combined at the end
```

### 5. Error Handling

- **Continue on Fail**: Use `continueOnFail: true` on status webhook nodes (observability should never break execution).
- **Ignore Response Code**: Use `ignoreResponseCode: true` on optional notifications.
- **Error Status Updates**: Send failed status to observability endpoint when errors occur.

**Example (Error Handling):**
```javascript
// In error handling node
{
  "taskId": "{{ $json.context.taskId }}",
  "status": "failed",
  "timestamp": "{{ $now.toISO() }}",
  "context": {{ $json.context }},
  "step": "{{ $json.step }}",
  "message": "Error: {{ $json.error.message }}",
  "error": {
    "message": "{{ $json.error.message }}",
    "code": "{{ $json.error.code }}"
  }
}
```

## Anti-Patterns to Avoid

- **❌ Creating ExecutionContext in N8N**: Never construct `ExecutionContext` manually - only receive it from webhook.
- **❌ Cherry-picking ExecutionContext fields**: Always pass the whole `context` object to API endpoints.
- **❌ Direct LLM API calls**: Use Orchestrator AI LLM endpoint, not direct OpenAI/Anthropic/Ollama APIs.
- **❌ Missing Observability**: All workflows must emit status updates to `/webhooks/status`.
- **❌ Skipping Helper LLM**: Use the Helper LLM sub-workflow for consistency, don't create custom LLM nodes.
- **❌ Hardcoding API URLs**: Use environment variables or configuration for API endpoints.

## Related Files and Concepts

- **LLM Endpoint**: `apps/api/src/llms/llm.controller.ts` - `POST /llm/generate`
- **Observability Endpoint**: `apps/api/src/webhooks/webhooks.controller.ts` - `POST /webhooks/status`
- **ExecutionContext Definition**: `apps/transport-types/core/execution-context.ts`

For detailed examples of correct patterns, refer to `PATTERNS.md`.
For common violations and their fixes, refer to `VIOLATIONS.md`.
For workflow structure examples, refer to `WORKFLOWS.md`.
For Helper LLM usage, refer to `HELPER_LLM.md`.

## Self-Reporting

**When this skill is loaded, the agent using it should log the event:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('skill', 'n8n-development-skill', 'loaded',
  '{\"loaded_by\": \"agent-name\", \"context\": \"description\"}'::jsonb);"
```

**After using the skill's patterns, log if they helped:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('skill', 'n8n-development-skill', 'helped', true,
  '{\"outcome\": \"what the skill helped with\"}'::jsonb);"
```

