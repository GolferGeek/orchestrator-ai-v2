# LLM Service Patterns

The LLM service is a critical external API endpoint that handles LLM calls from LangGraph, N8N, and other external systems, with automatic usage tracking, cost calculation, and observability.

## LLM Service Endpoint

### Endpoint: `POST /llm/generate`

**Purpose**: External API endpoint for LLM calls.

**Required**: ExecutionContext in request body

**Request Format**:
```typescript
POST /llm/generate
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
  metadata?: Record<string, unknown>;
}
```

## Automatic Tracking

### Usage Tracking

**Via `RunMetadataService`**:
- Tracks input/output tokens
- Tracks request/response timing
- Tracks provider/model selection
- Tracks caller type/name for analytics

**Pattern**:
```typescript
// LLM service automatically tracks usage
const result = await llmService.generateResponse(
  systemPrompt,
  userPrompt,
  {
    executionContext: context,
    callerType: 'langgraph',
    callerName: 'marketing-swarm',
  },
);

// Usage tracked automatically:
// - Input/output tokens
// - Request/response timing
// - Provider/model selection
// - Caller tracking
```

### Cost Calculation

**Via `LLMPricingService`**:
- Calculates cost based on token counts
- Supports cached input tokens
- Supports thinking tokens (for reasoning models)
- Provider-specific pricing

**Pattern**:
```typescript
// Cost calculated automatically
const cost = await llmPricingService.calculateCost(
  provider,
  model,
  inputTokens,
  outputTokens,
  {
    cachedInputTokens?: number,
    thinkingTokens?: number,
  },
);
```

### PII Processing

**Automatic Processing**:
- Dictionary pseudonymization
- Pattern-based redaction
- PII metadata tracking
- Output de-pseudonymization

**Pattern**:
```typescript
// PII processing handled automatically
// - Dictionary pseudonymization applied before LLM call
// - Pattern-based redaction applied after pseudonymization
// - PII metadata tracked in response
// - Output de-pseudonymized before returning
```

### Observability Events

**Automatic Emission**:
- `agent.llm.started` - LLM call started
- `agent.llm.completed` - LLM call completed
- Events include ExecutionContext for all identity fields

**Pattern**:
```typescript
// Observability events emitted automatically
// - Event emitted when LLM call starts
// - Event emitted when LLM call completes
// - Events include full ExecutionContext
```

## Usage in Services/Runners

### Injecting LLM Service

**Pattern**:
```typescript
import { LLMService } from '@/llms/llm.service';

@Injectable()
export class CustomService {
  constructor(
    private readonly llmService: LLMService,
  ) {}
  
  async callLLM(
    context: ExecutionContext,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const result = await this.llmService.generateResponse(
      systemPrompt,
      userPrompt,
      {
        executionContext: context, // REQUIRED
        callerType: 'api',
        callerName: 'custom-service',
      },
    );
    
    return typeof result === 'string' ? result : result.content;
  }
}
```

### Key Requirements

**✅ Always Pass ExecutionContext**:
```typescript
// REQUIRED - ExecutionContext must be passed
await llmService.generateResponse(
  systemPrompt,
  userPrompt,
  {
    executionContext: context, // REQUIRED
  },
);
```

**✅ Track Caller**:
```typescript
// Track caller for analytics
await llmService.generateResponse(
  systemPrompt,
  userPrompt,
  {
    executionContext: context,
    callerType: 'api', // Track caller type
    callerName: 'custom-service', // Track caller name
  },
);
```

## Usage Recording Endpoint

### Endpoint: `POST /llm/usage`

**Purpose**: For external callers that call specialized LLMs directly (e.g., Ollama/SQLCoder) to report usage for tracking and billing.

**Request Format**:
```typescript
POST /llm/usage
Content-Type: application/json

{
  provider: string;
  model: string;
  userId: string;
  conversationId?: string;
  callerType: string;
  callerName: string;
  promptTokens: number;
  completionTokens: number;
  timestamp?: string;
  latencyMs?: number;
}
```

**Response Format**:
```typescript
{
  success: boolean;
  message: string;
}
```

**Pattern**:
```typescript
// External caller reports usage
await fetch('/llm/usage', {
  method: 'POST',
  body: JSON.stringify({
    provider: 'ollama',
    model: 'sqlcoder',
    userId: context.userId,
    conversationId: context.conversationId,
    callerType: 'langgraph',
    callerName: 'data-analyst',
    promptTokens: 1000,
    completionTokens: 500,
  }),
});
```

## Related

- **`PATTERNS.md`**: API-specific patterns
- **`ARCHITECTURE.md`**: Module/controller/service architecture
- **`OBSERVABILITY.md`**: Observability patterns

