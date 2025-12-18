# N8N Development Patterns

Detailed examples of correct N8N workflow patterns for Orchestrator AI integration.

## Pattern 1: Basic Workflow with Helper LLM

**Use Case:** Simple workflow that calls LLM once and returns result.

**Structure:**
```
Webhook Trigger
  ↓
Extract Config
  ↓
Send Start Status
  ↓
Helper LLM Call (Execute Workflow)
  ↓
Send End Status
  ↓
Respond to Webhook
```

**Webhook Trigger Configuration:**
- **Method:** POST
- **Path:** `/webhook/my-workflow`
- **Response Mode:** Last Node

**Extract Config Node (Code):**
```javascript
// Validate ExecutionContext is present
if (!$input.body.context) {
  throw new Error('ExecutionContext is required in webhook body');
}

// Extract and validate context
const context = $input.body.context;
if (!context.userId || !context.conversationId || !context.taskId) {
  throw new Error('ExecutionContext missing required fields');
}

return {
  context: context,  // Pass through entire context
  userMessage: $input.body.userMessage || '',
  provider: context.provider || 'openai',
  model: context.model || 'gpt-4',
  // ... other workflow-specific parameters
};
```

**Send Start Status (HTTP Request):**
- **Method:** POST
- **URL:** `http://host.docker.internal:6100/webhooks/status`
- **Body:**
```json
{
  "taskId": "{{ $json.context.taskId }}",
  "status": "running",
  "timestamp": "{{ $now.toISO() }}",
  "context": {{ $json.context }},
  "step": "workflow_start",
  "message": "Starting workflow",
  "sequence": 0,
  "totalSteps": 2
}
```
- **Options:**
  - `continueOnFail: true` (observability should never break execution)
  - `ignoreResponseCode: true`

**Helper LLM Call (Execute Workflow):**
- **Source:** database
- **Workflow ID:** `9jxl03jCcqg17oOy` (Helper: LLM Task)
- **Field Mapping:**
```javascript
{
  "fields": [
    { "name": "provider", "value": "{{ $json.context.provider }}" },
    { "name": "model", "value": "{{ $json.context.model }}" },
    { "name": "prompt", "value": "Process this request: {{ $json.userMessage }}" },
    { "name": "temperature", "value": 0.7 },
    { "name": "maxTokens", "value": 1000 },
    { "name": "sendStartStatus", "value": true },
    { "name": "sendEndStatus", "value": true },
    { "name": "statusWebhook", "value": "http://host.docker.internal:6100/webhooks/status" },
    { "name": "taskId", "value": "{{ $json.context.taskId }}" },
    { "name": "conversationId", "value": "{{ $json.context.conversationId }}" },
    { "name": "userId", "value": "{{ $json.context.userId }}" },
    { "name": "stepName", "value": "llm_processing" },
    { "name": "sequence", "value": 1 },
    { "name": "totalSteps", "value": 2 }
  ]
}
```

**Send End Status (HTTP Request):**
- **Method:** POST
- **URL:** `http://host.docker.internal:6100/webhooks/status`
- **Body:**
```json
{
  "taskId": "{{ $json.context.taskId }}",
  "status": "completed",
  "timestamp": "{{ $now.toISO() }}",
  "context": {{ $json.context }},
  "step": "workflow_complete",
  "message": "Workflow completed successfully",
  "sequence": 2,
  "totalSteps": 2,
  "results": {{ $json }}
}
```

**Respond to Webhook:**
- **Response Code:** 200
- **Response Body:**
```json
{
  "success": true,
  "response": "{{ $json.text }}",
  "metadata": {
    "provider": "{{ $json.provider }}",
    "model": "{{ $json.model }}",
    "usage": {{ $json.usage }}
  }
}
```

## Pattern 2: Parallel LLM Execution (Marketing Swarm Pattern)

**Use Case:** Multiple independent LLM calls that can run in parallel.

**Structure:**
```
Webhook Trigger
  ↓
Extract Config
  ↓
Send Start Status
  ↓
├─→ Helper LLM Call #1 (parallel)
├─→ Helper LLM Call #2 (parallel)
└─→ Helper LLM Call #3 (parallel)
  ↓
Combine Results
  ↓
Send End Status
  ↓
Respond to Webhook
```

**Parallel Helper LLM Calls:**

**Call #1 Configuration:**
```javascript
{
  "fields": [
    { "name": "provider", "value": "{{ $json.context.provider }}" },
    { "name": "model", "value": "{{ $json.context.model }}" },
    { "name": "prompt", "value": "Generate web post: {{ $json.userMessage }}" },
    { "name": "temperature", "value": 0.7 },
    { "name": "maxTokens", "value": 1000 },
    { "name": "sendStartStatus", "value": true },
    { "name": "sendEndStatus", "value": true },
    { "name": "statusWebhook", "value": "http://host.docker.internal:6100/webhooks/status" },
    { "name": "taskId", "value": "{{ $json.context.taskId }}" },
    { "name": "conversationId", "value": "{{ $json.context.conversationId }}" },
    { "name": "userId", "value": "{{ $json.context.userId }}" },
    { "name": "stepName", "value": "web_post" },
    { "name": "sequence", "value": 1 },
    { "name": "totalSteps", "value": 4 }
  ]
}
```

**Call #2 Configuration:**
```javascript
{
  "fields": [
    // ... same as Call #1, but:
    { "name": "prompt", "value": "Generate SEO content: {{ $json.userMessage }}" },
    { "name": "temperature", "value": 0.5 },  // Lower for factual
    { "name": "maxTokens", "value": 800 },
    { "name": "stepName", "value": "seo_content" },
    { "name": "sequence", "value": 2 }
  ]
}
```

**Call #3 Configuration:**
```javascript
{
  "fields": [
    // ... same as Call #1, but:
    { "name": "prompt", "value": "Generate social media posts: {{ $json.userMessage }}" },
    { "name": "temperature", "value": 0.8 },  // Higher for creativity
    { "name": "maxTokens", "value": 1200 },
    { "name": "stepName", "value": "social_media" },
    { "name": "sequence", "value": 3 }
  ]
}
```

**Combine Results Node (Code):**
```javascript
// Combine results from parallel LLM calls
return {
  context: $input.all()[0].context,  // Preserve context from first item
  webPost: $input.all()[0].text,     // From Call #1
  seoContent: $input.all()[1].text,   // From Call #2
  socialMedia: $input.all()[2].text,  // From Call #3
  metadata: {
    provider: $input.all()[0].provider,
    model: $input.all()[0].model,
    usage: {
      total_prompt_tokens: $input.all().reduce((sum, item) => sum + (item.usage?.prompt_tokens || 0), 0),
      total_completion_tokens: $input.all().reduce((sum, item) => sum + (item.usage?.completion_tokens || 0), 0)
    }
  }
};
```

## Pattern 3: Sequential Multi-Step Workflow

**Use Case:** Workflow with multiple dependent steps that must run in sequence.

**Structure:**
```
Webhook Trigger
  ↓
Extract Config
  ↓
Send Start Status
  ↓
Step 1: Helper LLM Call (analysis)
  ↓
Step 2: Helper LLM Call (generation)
  ↓
Step 3: Helper LLM Call (refinement)
  ↓
Combine Results
  ↓
Send End Status
  ↓
Respond to Webhook
```

**Sequential Helper LLM Calls:**

Each step passes results to the next:
```javascript
// Step 1 Output → Step 2 Input
// Step 2 Output → Step 3 Input
// Final: Combine all results
```

**Step 1 Configuration:**
```javascript
{
  "fields": [
    { "name": "prompt", "value": "Analyze this request: {{ $json.userMessage }}" },
    { "name": "stepName", "value": "analysis" },
    { "name": "sequence", "value": 1 },
    { "name": "totalSteps", "value": 3 }
    // ... other fields same as Pattern 1
  ]
}
```

**Step 2 Configuration:**
```javascript
{
  "fields": [
    { "name": "prompt", "value": "Based on this analysis: {{ $json.text }}, generate content for: {{ $('Extract Config').item.json.userMessage }}" },
    { "name": "stepName", "value": "generation" },
    { "name": "sequence", "value": 2 },
    { "name": "totalSteps", "value": 3 }
    // ... other fields
  ]
}
```

**Step 3 Configuration:**
```javascript
{
  "fields": [
    { "name": "prompt", "value": "Refine this content: {{ $json.text }}. Original request: {{ $('Extract Config').item.json.userMessage }}" },
    { "name": "stepName", "value": "refinement" },
    { "name": "sequence", "value": 3 },
    { "name": "totalSteps", "value": 3 }
    // ... other fields
  ]
}
```

## Pattern 4: Direct LLM API Call (When Helper LLM Not Available)

**Use Case:** When you need to call the LLM endpoint directly (not using Helper LLM).

**HTTP Request Node Configuration:**
- **Method:** POST
- **URL:** `http://host.docker.internal:6100/llm/generate`
- **Headers:**
```json
{
  "Content-Type": "application/json"
}
```
- **Body:**
```json
{
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
```

**Response Handling:**
```javascript
// Extract response
return {
  context: $json.context,  // Preserve context
  text: $json.response || $json.content,
  metadata: $json.metadata
};
```

## Pattern 5: Error Handling

**Error Handling Node (Code):**
```javascript
// Catch errors from previous nodes
const error = $input.error || $input.all()[0].error;

// Send error status to observability
return {
  context: $('Extract Config').item.json.context,
  error: {
    message: error.message,
    code: error.code,
    node: error.node
  },
  status: "failed",
  timestamp: $now.toISO()
};
```

**Error Status Update (HTTP Request):**
- **Method:** POST
- **URL:** `http://host.docker.internal:6100/webhooks/status`
- **Body:**
```json
{
  "taskId": "{{ $json.context.taskId }}",
  "status": "failed",
  "timestamp": "{{ $json.timestamp }}",
  "context": {{ $json.context }},
  "step": "{{ $json.error.node }}",
  "message": "Error: {{ $json.error.message }}",
  "error": {
    "message": "{{ $json.error.message }}",
    "code": "{{ $json.error.code }}"
  }
}
```

## Pattern 6: Conditional Routing

**Switch Node Configuration:**
```javascript
// Route based on ExecutionContext or workflow parameters
const mode = $json.context.agentType || $json.mode;

if (mode === 'plan') {
  return { route: 'planning_flow' };
} else if (mode === 'build') {
  return { route: 'building_flow' };
} else {
  return { route: 'default_flow' };
}
```

## Best Practices

1. **Always Validate ExecutionContext**: Check that `context` exists and has required fields before proceeding.
2. **Preserve Context Through Workflow**: Always pass the entire `context` object through all nodes.
3. **Use Helper LLM When Possible**: Prefer Helper LLM sub-workflow over direct API calls for consistency.
4. **Emit Status Updates**: Send start, progress, and end status updates for visibility.
5. **Handle Errors Gracefully**: Use `continueOnFail: true` on observability calls, but still send error status.
6. **Use Environment Variables**: Don't hardcode API URLs - use N8N expressions or environment variables.
7. **Test Workflows**: Use N8N's test mode to verify ExecutionContext flow and API integration.

## Related Documentation

- **HELPER_LLM.md**: Detailed Helper LLM sub-workflow usage
- **WORKFLOWS.md**: Complete workflow examples
- **VIOLATIONS.md**: Common mistakes and how to fix them

