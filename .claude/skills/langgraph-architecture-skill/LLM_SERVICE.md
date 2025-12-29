# LLM Service Integration

LangGraph integrates with the LLM service via HTTP client to the API endpoint.

## Overview

LangGraph workflows call the LLM service through `LLMHttpClientService`, which makes HTTP requests to the API's `/llm/generate` endpoint. This provides automatic usage tracking, cost calculation, PII processing, and observability.

## LLM Service Endpoint

### Endpoint: `POST /llm/generate`

**Location**: API app (`apps/api/`)  
**Called From**: LangGraph app (`apps/langgraph/`) via HTTP client

**Request Format**:
```typescript
POST http://localhost:6100/llm/generate
Content-Type: application/json

{
  systemPrompt: string;
  userPrompt: string;
  context: ExecutionContext; // REQUIRED - full ExecutionContext
  options?: {
    temperature?: number;
    maxTokens?: number;
    provider?: 'openai' | 'anthropic' | 'ollama' | 'google';
    providerName?: string;
    modelName?: string;
    callerType?: string; // Track caller for analytics
    callerName?: string; // Track caller name for analytics
    dataClassification?: string;
  };
}
```

**Response Format**:
```typescript
{
  response: string;
  content?: string;
  sanitizationMetadata?: Record<string, unknown>;
  piiMetadata?: Record<string, unknown>;
  metadata?: {
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost?: number;
    };
  };
}
```

## LLMHttpClientService

### Service Location

**File**: `apps/langgraph/src/services/llm-http-client.service.ts`

**Purpose**: HTTP client for calling LLM service endpoint

### Usage Pattern

```typescript
import { LLMHttpClientService } from "../../services/llm-http-client.service";

// In node function
const response = await llmClient.callLLM({
  context: state.executionContext, // REQUIRED - full ExecutionContext
  systemMessage: "System prompt",
  userMessage: "User message",
  temperature: 0.7,
  maxTokens: 3500,
  callerName: "workflow-name", // Track caller for analytics
});

// Response includes:
// - text: LLM response
// - usage: Token counts and cost
```

### Key Requirements

**✅ Always Pass ExecutionContext**:
```typescript
// REQUIRED - ExecutionContext must be passed
await llmClient.callLLM({
  context: state.executionContext, // REQUIRED
  systemMessage: "System prompt",
  userMessage: "User message",
});
```

**✅ Track Caller**:
```typescript
// Track caller for analytics
await llmClient.callLLM({
  context: state.executionContext,
  systemMessage: "System prompt",
  userMessage: "User message",
  callerName: "workflow-name", // Track caller
});
```

## Automatic Features

### Usage Tracking

**Via API's `RunMetadataService`**:
- Tracks input/output tokens
- Tracks request/response timing
- Tracks provider/model selection
- Tracks caller type/name for analytics

**Pattern**:
```typescript
// Usage tracked automatically by API service
const response = await llmClient.callLLM({
  context: state.executionContext,
  callerName: "data-analyst", // Tracked for analytics
});

// Usage available in response.metadata.usage
console.log(response.usage?.promptTokens);
console.log(response.usage?.completionTokens);
console.log(response.usage?.cost);
```

### Cost Calculation

**Via API's `LLMPricingService`**:
- Calculates cost based on token counts
- Supports cached input tokens
- Supports thinking tokens (for reasoning models)
- Provider-specific pricing

**Pattern**:
```typescript
// Cost calculated automatically by API service
const response = await llmClient.callLLM({
  context: state.executionContext,
  systemMessage: "System prompt",
  userMessage: "User message",
});

// Cost available in response.metadata.usage.cost
console.log(response.usage?.cost);
```

### PII Processing

**Automatic Processing by API Service**:
- Dictionary pseudonymization
- Pattern-based redaction
- PII metadata tracking
- Output de-pseudonymization

**Pattern**:
```typescript
// PII processing handled automatically by API service
const response = await llmClient.callLLM({
  context: state.executionContext,
  systemMessage: "System prompt",
  userMessage: "User message with PII",
});

// PII metadata available in response
console.log(response.piiMetadata);
console.log(response.sanitizationMetadata);
```

### Observability Events

**Automatic Emission by API Service**:
- `agent.llm.started` - LLM call started
- `agent.llm.completed` - LLM call completed
- Events include ExecutionContext for all identity fields

**Pattern**:
```typescript
// Observability events emitted automatically by API service
const response = await llmClient.callLLM({
  context: state.executionContext,
  systemMessage: "System prompt",
  userMessage: "User message",
});

// Events automatically sent to observability service
// No additional code needed
```

## Configuration

### Environment Variables

**Required**:
```bash
API_PORT=6100  # Port of API server (REQUIRED - no default)
API_HOST=localhost  # Host of API server (default: localhost)
LLM_ENDPOINT=/llm/generate  # LLM endpoint (default: /llm/generate)
```

**Pattern**:
```typescript
// Service reads from environment
const apiPort = this.configService.get<string>("API_PORT");
if (!apiPort) {
  throw new Error("API_PORT environment variable is required");
}

const apiHost = this.configService.get<string>("API_HOST") || "localhost";
const llmEndpoint = this.configService.get<string>("LLM_ENDPOINT") || "/llm/generate";
const llmServiceUrl = `http://${apiHost}:${apiPort}`;
```

## Error Handling

### Error Pattern

```typescript
try {
  const response = await llmClient.callLLM({
    context: state.executionContext,
    systemMessage: "System prompt",
    userMessage: "User message",
  });
} catch (error) {
  // Handle LLM service errors
  // Error includes detailed information from API
  throw new Error(`LLM call failed: ${error.message}`);
}
```

## Common Violations

### ❌ Not Passing ExecutionContext

```typescript
// ❌ WRONG: Missing ExecutionContext
await llmClient.callLLM({
  systemMessage: "System prompt",
  userMessage: "User message",
  // Missing context!
});
```

**✅ FIX: Always pass ExecutionContext**
```typescript
// ✅ CORRECT: ExecutionContext required
await llmClient.callLLM({
  context: state.executionContext, // REQUIRED
  systemMessage: "System prompt",
  userMessage: "User message",
});
```

### ❌ Cherry-Picking ExecutionContext Fields

```typescript
// ❌ WRONG: Cherry-picking fields
await llmClient.callLLM({
  userId: state.executionContext.userId,
  taskId: state.executionContext.taskId,
  // ...
});
```

**✅ FIX: Pass full ExecutionContext**
```typescript
// ✅ CORRECT: Pass full ExecutionContext
await llmClient.callLLM({
  context: state.executionContext, // Full ExecutionContext
  systemMessage: "System prompt",
  userMessage: "User message",
});
```

### ❌ Not Tracking Caller

```typescript
// ❌ WRONG: Missing caller tracking
await llmClient.callLLM({
  context: state.executionContext,
  systemMessage: "System prompt",
  userMessage: "User message",
  // Missing callerName!
});
```

**✅ FIX: Track caller for analytics**
```typescript
// ✅ CORRECT: Track caller
await llmClient.callLLM({
  context: state.executionContext,
  systemMessage: "System prompt",
  userMessage: "User message",
  callerName: "workflow-name", // Track caller
});
```

## Related

- **`OBSERVABILITY.md`**: Observability integration
- **`PATTERNS.md`**: LangGraph patterns
- **`ARCHITECTURE.md`**: Architecture overview

