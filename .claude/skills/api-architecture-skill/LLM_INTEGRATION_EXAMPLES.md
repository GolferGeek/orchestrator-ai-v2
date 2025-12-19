# LLM Service Integration Examples

Examples demonstrating how to integrate with the LLM service from API code.

---

## Example 1: Basic LLM Call

**Simple LLM generation call from a service.**

```typescript
// apps/api/src/services/content.service.ts
import { Injectable } from '@nestjs/common';
import { LLMHttpClientService } from '../llm/llm-http-client.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

@Injectable()
export class ContentService {
  constructor(
    private readonly llmService: LLMHttpClientService // ✅ Inject LLM service
  ) {}

  async generateContent(context: ExecutionContext, prompt: string): Promise<string> {
    // Call LLM service - NO MOCKS
    const response = await this.llmService.generate({
      prompt,
      model: 'claude-3-sonnet-20240229',
      maxTokens: 1000,
      context // ✅ Pass whole ExecutionContext
    });

    // Usage and cost automatically tracked
    // PII processing handled automatically
    // Provider routing handled automatically

    return response.content;
  }
}
```

---

## Example 2: LLM Call with Custom Parameters

**LLM call with custom temperature, max tokens, and system prompt.**

```typescript
// apps/api/src/services/blog-post.service.ts
import { Injectable } from '@nestjs/common';
import { LLMHttpClientService } from '../llm/llm-http-client.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

@Injectable()
export class BlogPostService {
  constructor(
    private readonly llmService: LLMHttpClientService
  ) {}

  async generateBlogPost(
    context: ExecutionContext,
    topic: string,
    tone: 'professional' | 'casual' = 'professional'
  ): Promise<string> {
    const systemPrompt = `You are a professional blog writer. Write in a ${tone} tone.`;

    // LLM call with custom parameters
    const response = await this.llmService.generate({
      prompt: `Write a blog post about ${topic}`,
      systemPrompt,
      model: 'claude-3-sonnet-20240229',
      maxTokens: 2000,
      temperature: tone === 'casual' ? 0.8 : 0.7,
      context // ✅ Pass whole ExecutionContext
    });

    return response.content;
  }
}
```

---

## Example 3: LLM Call in Agent Runner

**LLM call from an agent runner with observability.**

```typescript
// apps/api/src/agents/marketing/blog-post.runner.ts
import { Injectable } from '@nestjs/common';
import { BaseAgentRunner } from '../../agent2agent/services/base-agent-runner/base-agent-runner';
import { LLMHttpClientService } from '../../llm/llm-http-client.service';
import { ObservabilityService } from '../../observability/observability.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

@Injectable()
export class BlogPostRunner extends BaseAgentRunner {
  constructor(
    private readonly llmService: LLMHttpClientService, // ✅ Inject LLM service
    private readonly observabilityService: ObservabilityService
  ) {
    super();
  }

  async execute(context: ExecutionContext, input: string): Promise<string> {
    // Emit start event
    await this.observabilityService.emit({
      eventType: 'agent_execution_started',
      context, // ✅ Pass whole context
      data: { agent: 'blog_post', input }
    });

    try {
      // LLM call with context
      const response = await this.llmService.generate({
        prompt: `Write a blog post: ${input}`,
        model: 'claude-3-sonnet-20240229',
        maxTokens: 1500,
        context // ✅ Pass whole ExecutionContext
      });

      // Emit success event
      await this.observabilityService.emit({
        eventType: 'agent_execution_completed',
        context, // ✅ Pass whole context
        data: { agent: 'blog_post', output: response.content }
      });

      return response.content;
    } catch (error) {
      // Emit error event
      await this.observabilityService.emit({
        eventType: 'agent_execution_failed',
        context, // ✅ Pass whole context
        error: error.message
      });

      throw error;
    }
  }
}
```

---

## Example 4: Multiple LLM Calls in Sequence

**Service that makes multiple LLM calls in sequence.**

```typescript
// apps/api/src/services/content-workflow.service.ts
import { Injectable } from '@nestjs/common';
import { LLMHttpClientService } from '../llm/llm-http-client.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

@Injectable()
export class ContentWorkflowService {
  constructor(
    private readonly llmService: LLMHttpClientService
  ) {}

  async generateCompleteContent(context: ExecutionContext, topic: string): Promise<ContentPackage> {
    // Step 1: Generate outline
    const outlineResponse = await this.llmService.generate({
      prompt: `Create an outline for a blog post about ${topic}`,
      model: 'claude-3-sonnet-20240229',
      maxTokens: 500,
      context // ✅ Pass whole context
    });

    const outline = outlineResponse.content;

    // Step 2: Generate content based on outline
    const contentResponse = await this.llmService.generate({
      prompt: `Write a blog post based on this outline:\n\n${outline}`,
      model: 'claude-3-sonnet-20240229',
      maxTokens: 2000,
      context // ✅ Pass whole context
    });

    const content = contentResponse.content;

    // Step 3: Generate SEO meta description
    const seoResponse = await this.llmService.generate({
      prompt: `Write an SEO meta description for this blog post:\n\n${content}`,
      model: 'claude-3-sonnet-20240229',
      maxTokens: 200,
      context // ✅ Pass whole context
    });

    const seoDescription = seoResponse.content;

    return {
      outline,
      content,
      seoDescription,
      // Usage tracked for all three calls automatically
    };
  }
}
```

---

## Example 5: LLM Call with Streaming

**LLM call with streaming response (if supported).**

```typescript
// apps/api/src/services/streaming-content.service.ts
import { Injectable } from '@nestjs/common';
import { LLMHttpClientService } from '../llm/llm-http-client.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { Observable } from 'rxjs';

@Injectable()
export class StreamingContentService {
  constructor(
    private readonly llmService: LLMHttpClientService
  ) {}

  async generateStreaming(
    context: ExecutionContext,
    prompt: string
  ): Promise<Observable<string>> {
    // Stream LLM response
    return this.llmService.generateStream({
      prompt,
      model: 'claude-3-sonnet-20240229',
      maxTokens: 2000,
      context // ✅ Pass whole ExecutionContext
    });
  }
}
```

---

## Example 6: LLM Call with Error Handling

**LLM call with proper error handling and retries.**

```typescript
// apps/api/src/services/robust-content.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { LLMHttpClientService } from '../llm/llm-http-client.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

@Injectable()
export class RobustContentService {
  private readonly logger = new Logger(RobustContentService.name);

  constructor(
    private readonly llmService: LLMHttpClientService
  ) {}

  async generateWithRetry(
    context: ExecutionContext,
    prompt: string,
    maxRetries = 3
  ): Promise<string> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // LLM call with context
        const response = await this.llmService.generate({
          prompt,
          model: 'claude-3-sonnet-20240229',
          maxTokens: 1000,
          context // ✅ Pass whole ExecutionContext
        });

        return response.content;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `LLM call failed (attempt ${attempt}/${maxRetries}): ${error.message}`,
          { context, attempt }
        );

        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw new Error(`LLM call failed after ${maxRetries} attempts: ${lastError.message}`);
  }
}
```

---

## Key Principles

1. **Always Inject LLM Service** - Use dependency injection
2. **Pass ExecutionContext** - Always include context in LLM calls
3. **Automatic Tracking** - Usage and cost tracked automatically
4. **Automatic PII Processing** - PII handled automatically
5. **Automatic Provider Routing** - Provider selection handled automatically
6. **Error Handling** - Handle LLM errors gracefully
7. **Observability** - Emit events for LLM calls

---

## LLM Service Features

**Automatic Features:**
- ✅ Usage tracking (tokens, cost)
- ✅ PII processing (redaction/reversal)
- ✅ Provider routing (based on model)
- ✅ Error handling
- ✅ Rate limiting

**What You Need to Provide:**
- ✅ ExecutionContext (for tracking and observability)
- ✅ Prompt and parameters
- ✅ Model selection

---

## Related

- `SKILL.md` - Core API architecture principles
- `LLM_SERVICE.md` - LLM service documentation
- `OBSERVABILITY.md` - Observability integration
- `execution-context-skill/` - ExecutionContext patterns

