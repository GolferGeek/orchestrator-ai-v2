# N8N Development Violations

Common violations of N8N development patterns and how to fix them.

## Violation 1: Creating ExecutionContext in N8N

**❌ WRONG:**
```javascript
// In N8N Code node
const context = {
  userId: $json.userId,
  conversationId: $json.conversationId,
  taskId: $json.taskId,
  // ... manually constructing context
};
```

**✅ CORRECT:**
```javascript
// Receive context from webhook body
const context = $input.body.context;

// Validate it exists
if (!context || !context.userId || !context.conversationId) {
  throw new Error('ExecutionContext is required in webhook body');
}

// Use it as-is
return { context: context };
```

**Why:** ExecutionContext is created on the frontend and flows through the system. N8N should only receive and pass it through, never construct it.

## Violation 2: Cherry-Picking ExecutionContext Fields

**❌ WRONG:**
```javascript
// Passing individual fields to API
{
  "userId": "{{ $json.context.userId }}",
  "conversationId": "{{ $json.context.conversationId }}",
  "taskId": "{{ $json.context.taskId }}"
}
```

**✅ CORRECT:**
```javascript
// Pass entire context object
{
  "context": {{ $json.context }}
}
```

**Why:** The ExecutionContext capsule must flow whole. Cherry-picking fields loses information and breaks observability.

## Violation 3: Direct LLM Provider API Calls

**❌ WRONG:**
```javascript
// HTTP Request to OpenAI directly
{
  "url": "https://api.openai.com/v1/chat/completions",
  "headers": {
    "Authorization": "Bearer sk-..."
  },
  "body": {
    "model": "gpt-4",
    "messages": [...]
  }
}
```

**✅ CORRECT:**
```javascript
// Use Orchestrator AI LLM endpoint
{
  "url": "http://host.docker.internal:6100/llm/generate",
  "body": {
    "systemPrompt": "You are a helpful assistant.",
    "userPrompt": "{{ $json.userMessage }}",
    "context": {{ $json.context }},
    "options": {
      "temperature": 0.7,
      "maxTokens": 1000,
      "callerType": "n8n",
      "callerName": "my-workflow"
    }
  }
}
```

**Or use Helper LLM:**
```javascript
// Execute Workflow node calling Helper LLM (9jxl03jCcqg17oOy)
{
  "workflowId": "9jxl03jCcqg17oOy",
  "fieldMapping": {
    "fields": [
      { "name": "prompt", "value": "{{ $json.userMessage }}" },
      { "name": "provider", "value": "{{ $json.context.provider }}" },
      // ... other fields
    ]
  }
}
```

**Why:** Direct provider calls bypass observability, PII handling, usage tracking, and provider routing. Always use Orchestrator AI endpoints.

## Violation 4: Missing ExecutionContext in Status Updates

**❌ WRONG:**
```javascript
// Status update without context
{
  "taskId": "{{ $json.taskId }}",
  "status": "running",
  "userId": "{{ $json.userId }}",
  "conversationId": "{{ $json.conversationId }}"
}
```

**✅ CORRECT:**
```javascript
// Status update with full context
{
  "taskId": "{{ $json.context.taskId }}",
  "status": "running",
  "timestamp": "{{ $now.toISO() }}",
  "context": {{ $json.context }},
  "step": "processing",
  "message": "Starting workflow"
}
```

**Why:** The observability endpoint requires the full ExecutionContext. Individual fields are extracted from context, not passed separately.

## Violation 5: Missing Observability Events

**❌ WRONG:**
```javascript
// Workflow with no status updates
Webhook → Helper LLM → Respond to Webhook
```

**✅ CORRECT:**
```javascript
// Workflow with status tracking
Webhook → Send Start Status → Helper LLM → Send End Status → Respond to Webhook
```

**Why:** Observability events provide visibility into workflow execution. Without them, users can't track progress or debug issues.

## Violation 6: Not Using Helper LLM Pattern

**❌ WRONG:**
```javascript
// Custom LLM node for each workflow
// Duplicates logic, inconsistent behavior
```

**✅ CORRECT:**
```javascript
// Use Helper LLM sub-workflow (9jxl03jCcqg17oOy)
// Consistent behavior, easier maintenance
```

**Why:** Helper LLM provides consistent LLM handling, status tracking, and error handling. Custom nodes duplicate logic and create inconsistencies.

## Violation 7: Hardcoding API URLs

**❌ WRONG:**
```javascript
// Hardcoded URL
"url": "http://localhost:6100/webhooks/status"
```

**✅ CORRECT:**
```javascript
// Use environment variable or expression
"url": "{{ $env.API_URL }}/webhooks/status"
// Or
"url": "http://host.docker.internal:6100/webhooks/status"  // Docker hostname
```

**Why:** Hardcoded URLs break in different environments (local, Docker, production). Use environment variables or consistent hostnames.

## Violation 8: Missing Error Handling

**❌ WRONG:**
```javascript
// No error handling - workflow fails silently
Helper LLM Call → Respond to Webhook
```

**✅ CORRECT:**
```javascript
// Error handling with status updates
Helper LLM Call
  ├─→ Success → Send Success Status → Respond to Webhook
  └─→ Error → Send Error Status → Respond with Error
```

**Why:** Errors should be reported to observability and returned to the caller. Silent failures make debugging impossible.

## Violation 9: Not Passing Context Through Nodes

**❌ WRONG:**
```javascript
// Context lost between nodes
Node 1: Extract context
Node 2: Process data (context not passed)
Node 3: Call API (no context available)
```

**✅ CORRECT:**
```javascript
// Context preserved through all nodes
Node 1: Extract context → { context, data }
Node 2: Process data → { context, processedData }
Node 3: Call API → { context, result }
```

**Why:** Every node that might need context (especially API calls) must receive it. Don't assume context is available - explicitly pass it.

## Violation 10: Using Wrong Status Webhook Format

**❌ WRONG:**
```javascript
// Missing required fields
{
  "status": "running"
}
```

**✅ CORRECT:**
```javascript
// Complete status update
{
  "taskId": "{{ $json.context.taskId }}",
  "status": "running",
  "timestamp": "{{ $now.toISO() }}",
  "context": {{ $json.context }},
  "step": "processing",
  "message": "Starting workflow",
  "sequence": 1,
  "totalSteps": 4
}
```

**Why:** The observability endpoint requires `taskId`, `status`, `timestamp`, and `context` at minimum. Missing fields cause validation failures.

## Fix Checklist

When reviewing N8N workflows, check:

- [ ] ExecutionContext is received from webhook, not created
- [ ] ExecutionContext is passed whole to all API calls
- [ ] LLM calls use Orchestrator AI endpoint or Helper LLM
- [ ] Status updates include full ExecutionContext
- [ ] Workflow emits start, progress, and end status updates
- [ ] Helper LLM pattern is used for LLM calls
- [ ] API URLs use environment variables or consistent hostnames
- [ ] Error handling sends error status to observability
- [ ] Context is preserved through all workflow nodes
- [ ] Status updates include all required fields

## Related Documentation

- **PATTERNS.md**: Correct patterns to follow
- **WORKFLOWS.md**: Complete workflow examples
- **HELPER_LLM.md**: Helper LLM usage guide

