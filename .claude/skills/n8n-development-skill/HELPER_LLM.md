# Helper LLM Sub-Workflow

The "Helper: LLM Task" sub-workflow is the standard building block for all LLM calls in N8N workflows.

## Overview

**Workflow ID:** `9jxl03jCcqg17oOy`  
**Name:** "Helper: LLM Task"  
**Type:** Execute Workflow (called by other workflows)

This reusable sub-workflow handles:
- Multi-provider support (OpenAI, Anthropic, Ollama)
- Status tracking via webhooks
- Normalized output format
- Error handling

## How to Use

### Execute Workflow Node Configuration

**Source:** database  
**Workflow ID:** `9jxl03jCcqg17oOy`

### Required Parameters

- `prompt` (string) - The prompt to send to LLM

### Optional Parameters

- `provider` (string) - "openai" | "ollama" | "anthropic" (default: "openai")
- `model` (string) - Model name (defaults: "gpt-4", "llama2", "claude-3-sonnet-20240229")
- `temperature` (number) - 0.0 to 1.0 (default: 0.7)
- `maxTokens` (number) - Max completion tokens (default: 1000)

### Status Tracking Parameters

- `sendStartStatus` (boolean) - Send start status webhook (default: false)
- `sendEndStatus` (boolean) - Send end status webhook (default: false)
- `statusWebhook` (string) - Webhook URL (default: "http://host.docker.internal:6100/webhooks/status")
- `taskId` (string) - Task identifier for tracking
- `conversationId` (string) - Conversation context
- `userId` (string) - User identifier
- `stepName` (string) - Name of this step in larger workflow
- `sequence` (number) - Step number in sequence
- `totalSteps` (number) - Total steps in parent workflow

## Field Mapping Example

```javascript
{
  "source": "database",
  "workflowId": "9jxl03jCcqg17oOy",
  "fieldMapping": {
    "fields": [
      // LLM Configuration
      { "name": "provider", "value": "{{ $json.context.provider }}" },
      { "name": "model", "value": "{{ $json.context.model }}" },
      { "name": "prompt", "value": "Your task-specific prompt here" },
      { "name": "temperature", "value": 0.7 },
      { "name": "maxTokens", "value": 1000 },
      
      // Status Tracking
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

## Output Format

The Helper LLM returns a normalized format regardless of provider:

```json
{
  "text": "LLM response content",
  "provider": "openai|ollama|anthropic",
  "model": "actual-model-used",
  "usage": {
    "prompt_tokens": 123,
    "completion_tokens": 456
  }
}
```

**Key Feature:** All three providers return the SAME normalized format!

## Provider Defaults

- **OpenAI:** `gpt-4`
- **Ollama:** `llama2`
- **Anthropic:** `claude-3-sonnet-20240229`

## Temperature Guidelines

- **0.5** - Factual, precise (SEO, analysis, data extraction)
- **0.7** - General purpose (default, most use cases)
- **0.8** - Creative (social media, marketing, storytelling)

## Max Tokens Guidelines

- **800** - Short responses (summaries, brief answers)
- **1000** - General purpose (default)
- **1200** - Longer content (blog posts, detailed analysis)
- **1500+** - Extended content (comprehensive documents)

## Status Tracking

When `sendStartStatus: true` and `sendEndStatus: true`, the Helper LLM automatically sends status updates to the observability endpoint.

**Start Status:**
```json
{
  "taskId": "uuid",
  "status": "running",
  "timestamp": "2025-01-12T10:00:00.000Z",
  "step": "stepName",
  "message": "Starting stepName",
  "sequence": 1,
  "totalSteps": 4,
  "conversationId": "uuid",
  "userId": "uuid"
}
```

**End Status:**
```json
{
  "taskId": "uuid",
  "status": "completed",
  "timestamp": "2025-01-12T10:01:00.000Z",
  "step": "stepName",
  "message": "Completed stepName",
  "sequence": 1,
  "totalSteps": 4,
  "conversationId": "uuid",
  "userId": "uuid"
}
```

## Usage Examples

### Example 1: Simple LLM Call

```javascript
{
  "fields": [
    { "name": "prompt", "value": "Summarize this: {{ $json.userMessage }}" },
    { "name": "provider", "value": "{{ $json.context.provider }}" },
    { "name": "model", "value": "{{ $json.context.model }}" },
    { "name": "temperature", "value": 0.5 },
    { "name": "maxTokens", "value": 500 }
  ]
}
```

### Example 2: With Status Tracking

```javascript
{
  "fields": [
    { "name": "prompt", "value": "Generate content: {{ $json.userMessage }}" },
    { "name": "provider", "value": "{{ $json.context.provider }}" },
    { "name": "model", "value": "{{ $json.context.model }}" },
    { "name": "sendStartStatus", "value": true },
    { "name": "sendEndStatus", "value": true },
    { "name": "statusWebhook", "value": "http://host.docker.internal:6100/webhooks/status" },
    { "name": "taskId", "value": "{{ $json.context.taskId }}" },
    { "name": "conversationId", "value": "{{ $json.context.conversationId }}" },
    { "name": "userId", "value": "{{ $json.context.userId }}" },
    { "name": "stepName", "value": "content_generation" },
    { "name": "sequence", "value": 1 },
    { "name": "totalSteps", "value": 3 }
  ]
}
```

### Example 3: Parallel Calls

```javascript
// Call #1: Web Post
{
  "fields": [
    { "name": "prompt", "value": "Write web post: {{ $json.userMessage }}" },
    { "name": "stepName", "value": "web_post" },
    { "name": "sequence", "value": 1 },
    { "name": "totalSteps", "value": 3 }
    // ... other fields
  ]
}

// Call #2: SEO Content
{
  "fields": [
    { "name": "prompt", "value": "Create SEO content: {{ $json.userMessage }}" },
    { "name": "temperature", "value": 0.5 },
    { "name": "stepName", "value": "seo_content" },
    { "name": "sequence", "value": 2 },
    { "name": "totalSteps", "value": 3 }
    // ... other fields
  ]
}

// Call #3: Social Media
{
  "fields": [
    { "name": "prompt", "value": "Create social posts: {{ $json.userMessage }}" },
    { "name": "temperature", "value": 0.8 },
    { "name": "stepName", "value": "social_media" },
    { "name": "sequence", "value": 3 },
    { "name": "totalSteps", "value": 3 }
    // ... other fields
  ]
}
```

## Best Practices

1. **Always Use Helper LLM**: Don't create custom LLM nodes - use Helper LLM for consistency.
2. **Pass ExecutionContext Fields**: Extract `taskId`, `conversationId`, `userId` from `context` object.
3. **Set Appropriate Temperature**: Use 0.5 for factual, 0.7 for general, 0.8 for creative.
4. **Enable Status Tracking**: Set `sendStartStatus: true` and `sendEndStatus: true` for visibility.
5. **Use Descriptive Step Names**: Make `stepName` clear and descriptive for observability.
6. **Set Sequence Numbers**: Use `sequence` and `totalSteps` for progress tracking.

## Troubleshooting

### Helper LLM Not Found

**Error:** Workflow ID `9jxl03jCcqg17oOy` not found

**Solution:**
1. Verify Helper LLM workflow exists in N8N
2. Check workflow ID is correct
3. Ensure workflow is activated

### Status Updates Not Sending

**Error:** Status webhooks failing

**Solution:**
1. Verify `statusWebhook` URL is correct: `http://host.docker.internal:6100/webhooks/status`
2. Check `sendStartStatus` and `sendEndStatus` are set to `true`
3. Ensure `taskId`, `conversationId`, `userId` are provided
4. Use `continueOnFail: true` on status webhook nodes

### Provider Not Supported

**Error:** Provider not in switch statement

**Solution:**
1. Use one of: "openai", "ollama", "anthropic"
2. Check provider name matches exactly (case-sensitive)
3. Verify provider is configured in Orchestrator AI

## Related Documentation

- **PATTERNS.md**: Complete workflow patterns
- **WORKFLOWS.md**: Full workflow examples
- **VIOLATIONS.md**: Common mistakes to avoid

