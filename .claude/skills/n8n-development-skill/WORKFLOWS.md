# N8N Workflow Examples

Complete examples of N8N workflows following Orchestrator AI integration patterns.

## Example 1: Simple Content Generator

**Purpose:** Generate content from a user message using LLM.

**Workflow Structure:**
```
Webhook Trigger (/webhook/content-generator)
  ↓
Extract Config
  ↓
Send Start Status
  ↓
Helper LLM Call
  ↓
Send End Status
  ↓
Respond to Webhook
```

**Complete Node Configuration:**

**1. Webhook Trigger:**
- **Method:** POST
- **Path:** `/webhook/content-generator`
- **Response Mode:** Last Node

**2. Extract Config (Code Node):**
```javascript
// Validate ExecutionContext
if (!$input.body.context) {
  throw new Error('ExecutionContext is required');
}

const context = $input.body.context;
if (!context.userId || !context.conversationId || !context.taskId) {
  throw new Error('ExecutionContext missing required fields');
}

return {
  context: context,
  userMessage: $input.body.userMessage || '',
  contentType: $input.body.contentType || 'general'
};
```

**3. Send Start Status (HTTP Request):**
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
  "message": "Starting content generation",
  "sequence": 0,
  "totalSteps": 2
}
```
- **Options:**
  - `continueOnFail: true`
  - `ignoreResponseCode: true`

**4. Helper LLM Call (Execute Workflow):**
- **Source:** database
- **Workflow ID:** `9jxl03jCcqg17oOy`
- **Field Mapping:**
```javascript
{
  "fields": [
    { "name": "provider", "value": "{{ $json.context.provider }}" },
    { "name": "model", "value": "{{ $json.context.model }}" },
    { "name": "prompt", "value": "Generate {{ $json.contentType }} content: {{ $json.userMessage }}" },
    { "name": "temperature", "value": 0.7 },
    { "name": "maxTokens", "value": 1000 },
    { "name": "sendStartStatus", "value": true },
    { "name": "sendEndStatus", "value": true },
    { "name": "statusWebhook", "value": "http://host.docker.internal:6100/webhooks/status" },
    { "name": "taskId", "value": "{{ $json.context.taskId }}" },
    { "name": "conversationId", "value": "{{ $json.context.conversationId }}" },
    { "name": "userId", "value": "{{ $json.context.userId }}" },
    { "name": "stepName", "value": "content_generation" },
    { "name": "sequence", "value": 1 },
    { "name": "totalSteps", "value": 2 }
  ]
}
```

**5. Send End Status (HTTP Request):**
- **Method:** POST
- **URL:** `http://host.docker.internal:6100/webhooks/status`
- **Body:**
```json
{
  "taskId": "{{ $('Extract Config').item.json.context.taskId }}",
  "status": "completed",
  "timestamp": "{{ $now.toISO() }}",
  "context": {{ $('Extract Config').item.json.context }},
  "step": "workflow_complete",
  "message": "Content generation completed",
  "sequence": 2,
  "totalSteps": 2,
  "results": {
    "content": "{{ $json.text }}",
    "provider": "{{ $json.provider }}",
    "model": "{{ $json.model }}"
  }
}
```

**6. Respond to Webhook:**
- **Response Code:** 200
- **Response Body:**
```json
{
  "success": true,
  "response": "{{ $json.text }}",
  "metadata": {
    "provider": "{{ $json.provider }}",
    "model": "{{ $json.model }}",
    "usage": {{ $json.usage }},
    "contentType": "{{ $('Extract Config').item.json.contentType }}"
  }
}
```

## Example 2: Marketing Swarm (Parallel Execution)

**Purpose:** Generate multiple marketing content types in parallel.

**Workflow Structure:**
```
Webhook Trigger (/webhook/marketing-swarm)
  ↓
Extract Config
  ↓
Send Start Status
  ↓
├─→ Helper LLM: Web Post (parallel)
├─→ Helper LLM: SEO Content (parallel)
└─→ Helper LLM: Social Media (parallel)
  ↓
Combine Results
  ↓
Send End Status
  ↓
Respond to Webhook
```

**Key Nodes:**

**Extract Config:**
```javascript
const context = $input.body.context;
return {
  context: context,
  userMessage: $input.body.userMessage || $input.body.announcement || '',
  provider: context.provider || 'openai',
  model: context.model || 'gpt-4'
};
```

**Helper LLM: Web Post (Execute Workflow):**
```javascript
{
  "fields": [
    { "name": "provider", "value": "{{ $json.provider }}" },
    { "name": "model", "value": "{{ $json.model }}" },
    { "name": "prompt", "value": "Write a compelling web post announcement: {{ $json.userMessage }}" },
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

**Helper LLM: SEO Content (Execute Workflow):**
```javascript
{
  "fields": [
    // ... same as Web Post, but:
    { "name": "prompt", "value": "Create SEO-optimized content: {{ $json.userMessage }}" },
    { "name": "temperature", "value": 0.5 },
    { "name": "maxTokens", "value": 800 },
    { "name": "stepName", "value": "seo_content" },
    { "name": "sequence", "value": 2 }
  ]
}
```

**Helper LLM: Social Media (Execute Workflow):**
```javascript
{
  "fields": [
    // ... same as Web Post, but:
    { "name": "prompt", "value": "Create social media posts (Twitter 280, LinkedIn 1300, Facebook 500): {{ $json.userMessage }}" },
    { "name": "temperature", "value": 0.8 },
    { "name": "maxTokens", "value": 1200 },
    { "name": "stepName", "value": "social_media" },
    { "name": "sequence", "value": 3 }
  ]
}
```

**Combine Results (Code Node):**
```javascript
const items = $input.all();
const context = items[0].context || $('Extract Config').item.json.context;

return {
  context: context,
  webPost: items[0].text,
  seoContent: items[1].text,
  socialMedia: items[2].text,
  metadata: {
    provider: items[0].provider,
    model: items[0].model,
    usage: {
      total_prompt_tokens: items.reduce((sum, item) => sum + (item.usage?.prompt_tokens || 0), 0),
      total_completion_tokens: items.reduce((sum, item) => sum + (item.usage?.completion_tokens || 0), 0)
    }
  }
};
```

**Respond to Webhook:**
```json
{
  "success": true,
  "response": {
    "webPost": "{{ $json.webPost }}",
    "seoContent": "{{ $json.seoContent }}",
    "socialMedia": "{{ $json.socialMedia }}"
  },
  "metadata": {{ $json.metadata }}
}
```

## Example 3: Sequential Analysis Workflow

**Purpose:** Multi-step workflow where each step depends on the previous.

**Workflow Structure:**
```
Webhook Trigger (/webhook/analyze-and-generate)
  ↓
Extract Config
  ↓
Send Start Status
  ↓
Step 1: Helper LLM (Analysis)
  ↓
Step 2: Helper LLM (Generation)
  ↓
Step 3: Helper LLM (Refinement)
  ↓
Combine Results
  ↓
Send End Status
  ↓
Respond to Webhook
```

**Step 1: Analysis (Execute Workflow):**
```javascript
{
  "fields": [
    { "name": "prompt", "value": "Analyze this request and identify key requirements: {{ $json.userMessage }}" },
    { "name": "stepName", "value": "analysis" },
    { "name": "sequence", "value": 1 },
    { "name": "totalSteps", "value": 4 }
    // ... other fields
  ]
}
```

**Step 2: Generation (Execute Workflow):**
```javascript
{
  "fields": [
    { "name": "prompt", "value": "Based on this analysis: {{ $json.text }}, generate content for: {{ $('Extract Config').item.json.userMessage }}" },
    { "name": "stepName", "value": "generation" },
    { "name": "sequence", "value": 2 },
    { "name": "totalSteps", "value": 4 }
    // ... other fields
  ]
}
```

**Step 3: Refinement (Execute Workflow):**
```javascript
{
  "fields": [
    { "name": "prompt", "value": "Refine this content: {{ $json.text }}. Original request: {{ $('Extract Config').item.json.userMessage }}" },
    { "name": "stepName", "value": "refinement" },
    { "name": "sequence", "value": 3 },
    { "name": "totalSteps", "value": 4 }
    // ... other fields
  ]
}
```

## Example 4: Error Handling Workflow

**Purpose:** Workflow with comprehensive error handling.

**Workflow Structure:**
```
Webhook Trigger
  ↓
Extract Config
  ↓
Send Start Status
  ↓
Try: Helper LLM Call
  ├─→ Success → Send Success Status → Respond
  └─→ Error → Send Error Status → Respond with Error
```

**Error Handling Node (Code):**
```javascript
// Check for errors
const error = $input.error || ($input.all && $input.all()[0]?.error);

if (error) {
  const context = $('Extract Config').item.json.context;
  
  return {
    context: context,
    error: {
      message: error.message || 'Unknown error',
      code: error.code || 'WORKFLOW_ERROR',
      node: error.node || 'unknown'
    },
    status: 'failed',
    timestamp: $now.toISO()
  };
}

// No error - pass through
return $input.all()[0];
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

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "{{ $json.error.message }}",
    "code": "{{ $json.error.code }}"
  }
}
```

## Testing Workflows

### Test Request Format

```bash
curl -X POST http://localhost:5678/webhook/workflow-name \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "orgSlug": "acme-corp",
      "userId": "user-uuid",
      "conversationId": "conv-uuid",
      "taskId": "task-uuid",
      "planId": "00000000-0000-0000-0000-000000000000",
      "deliverableId": "00000000-0000-0000-0000-000000000000",
      "agentSlug": "my-agent",
      "agentType": "api",
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514"
    },
    "userMessage": "Generate content about AI agents"
  }'
```

### Expected Response

```json
{
  "success": true,
  "response": "Generated content...",
  "metadata": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "usage": {
      "prompt_tokens": 123,
      "completion_tokens": 456
    }
  }
}
```

## Related Documentation

- **PATTERNS.md**: Detailed pattern examples
- **HELPER_LLM.md**: Helper LLM usage guide
- **VIOLATIONS.md**: Common mistakes to avoid

