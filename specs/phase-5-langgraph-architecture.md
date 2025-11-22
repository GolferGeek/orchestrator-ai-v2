# Phase 5: LangGraph Advanced Architecture Plan

## Executive Summary

This plan establishes the **canonical LangGraph architecture** for Orchestrator AI. It transforms the current basic implementation into a production-ready system leveraging the full power of LangGraph.js TypeScript SDK. This architecture will serve as:

1. **The foundation for all LangGraph agents** in Orchestrator AI
2. **The reference implementation** for creating new agents
3. **The basis for Claude Code agents, skills, and commands** to automate agent creation

The current implementation uses manual webhook-based status tracking and sequential node execution. Phase 5 introduces proper graph-based execution with checkpointing, conditional routing, HITL workflows, and multi-agent patterns.

> **Important**: This phase establishes patterns that Claude Code agents will use to generate new LangGraph agents automatically. Every pattern must be clear, consistent, and well-documented.

---

## Current State Analysis

### What Exists (apps/langgraph/)
- **Manual "Graph" Execution**: Sequential function calls, not actual StateGraph
- **LLMNodeExecutor**: Basic LLM call wrapper with webhook notifications
- **Webhook Status Service**: Manual status reporting (started/progress/completed/failed)
- **Three Workflows**: marketing-swarm, requirements-writer, metrics-agent
- **No Checkpointing**: State lost if process crashes
- **No Conditional Routing**: Linear execution only
- **No HITL**: No interrupt/resume capability

### What's Missing
| Feature | Current | Phase 5 Target |
|---------|---------|----------------|
| State Management | Manual object passing | StateGraph + Annotations |
| Persistence | None | PostgresSaver (Supabase) |
| Long-term Memory | None | PostgresStore |
| Conditional Routing | None | addConditionalEdges |
| HITL | Webhook-only | interrupt/Command/resume |
| Tool Calling | None | bind_tools + tools_condition |
| Multi-Agent | Sequential | Supervisor + Subgraphs |
| Streaming | None | stream(mode: "updates") |

---

## Phase 5 Architecture

### 5.0 Shared Services Module (PRD Section 11.1)

> **Aligns with**: PRD Section 11.1 - Shared Services Module

The shared services module provides singleton services available to all LangGraph agents. These services handle communication with the Orchestrator AI API.

#### 5.0.1 LLM HTTP Client Service (EXISTS)

**File: `apps/langgraph/src/services/llm-http-client.service.ts`**

This service already exists and routes all LLM calls through the Orchestrator AI API. Key features:
- Calls `/llm/generate` endpoint on Orchestrator AI API
- Passes `userId` for usage tracking
- Passes `callerType: 'langgraph'` and `callerName` for observability
- PII pseudonymization happens automatically in the API

```typescript
// Usage in any LangGraph node
const result = await this.llmClient.callLLM({
  provider: state.provider,
  model: state.model,
  systemMessage: 'You are a helpful assistant',
  userMessage: state.prompt,
  callerName: 'my-agent-node',  // For observability
  userId: state.userId,          // Required for usage tracking
});
```

#### 5.0.2 Webhook Status Service (EXISTS)

**File: `apps/langgraph/src/services/webhook-status.service.ts`**

This service already exists and handles status webhook callbacks. Key features:
- Sends started/progress/completed/failed status updates
- Non-blocking (failures don't break workflow)
- Used for real-time UI updates

```typescript
// Usage in graph execution
await this.webhookService.sendProgress(
  state.statusWebhook,
  state.taskId,
  state.conversationId,
  state.userId,
  'Processing step 1',
  1,  // current step
  3,  // total steps
);
```

#### 5.0.3 Observability Service (NEW)

**New File: `apps/langgraph/src/services/observability.service.ts`**

This service sends observability events to the Orchestrator AI API for streaming and logging.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface ObservabilityEvent {
  source_app: 'langgraph';
  session_id: string;
  hook_event_type: string;
  payload: Record<string, unknown>;
  timestamp?: number;
  userId?: string;
  conversationId?: string;
  taskId?: string;
  agentSlug?: string;
  organizationSlug?: string;
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly observabilityUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiPort = this.configService.get<string>('API_PORT');
    if (!apiPort) {
      throw new Error('API_PORT environment variable is required');
    }
    const apiHost = this.configService.get<string>('API_HOST') || 'localhost';
    this.observabilityUrl = `http://${apiHost}:${apiPort}`;
  }

  /**
   * Send observability event to Orchestrator AI API
   * Non-blocking - failures are logged but don't throw
   */
  async sendEvent(event: ObservabilityEvent): Promise<void> {
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    try {
      await firstValueFrom(
        this.httpService.post(`${this.observabilityUrl}/hooks`, event, {
          timeout: 2000,
          validateStatus: () => true,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send observability event: ${error.message}`,
      );
    }
  }

  // Convenience methods for common event types
  async emitNodeStarted(params: {
    taskId: string;
    conversationId?: string;
    userId: string;
    agentSlug: string;
    nodeName: string;
    organizationSlug?: string;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: params.conversationId || params.taskId,
      hook_event_type: 'orchAI-node-start',
      taskId: params.taskId,
      conversationId: params.conversationId,
      userId: params.userId,
      agentSlug: params.agentSlug,
      organizationSlug: params.organizationSlug,
      payload: {
        nodeName: params.nodeName,
        startTime: Date.now(),
      },
    });
  }

  async emitNodeCompleted(params: {
    taskId: string;
    conversationId?: string;
    userId: string;
    agentSlug: string;
    nodeName: string;
    duration?: number;
    organizationSlug?: string;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: params.conversationId || params.taskId,
      hook_event_type: 'orchAI-node-finish',
      taskId: params.taskId,
      conversationId: params.conversationId,
      userId: params.userId,
      agentSlug: params.agentSlug,
      organizationSlug: params.organizationSlug,
      payload: {
        nodeName: params.nodeName,
        duration: params.duration,
        endTime: Date.now(),
      },
    });
  }

  async emitHitlRequest(params: {
    taskId: string;
    conversationId?: string;
    userId: string;
    agentSlug: string;
    hitlType: 'confirmation' | 'choice' | 'input' | 'approval';
    question: string;
    options?: string[];
    dataToReview?: Record<string, unknown>;
    organizationSlug?: string;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: params.conversationId || params.taskId,
      hook_event_type: 'orchAI-hitl-request',
      taskId: params.taskId,
      conversationId: params.conversationId,
      userId: params.userId,
      agentSlug: params.agentSlug,
      organizationSlug: params.organizationSlug,
      payload: {
        hitlType: params.hitlType,
        question: params.question,
        options: params.options,
        dataToReview: params.dataToReview,
      },
    });
  }
}
```

#### 5.0.4 HITL Service (NEW)

**New File: `apps/langgraph/src/services/hitl.service.ts`**

This service provides HITL functionality for LangGraph agents, integrating with the checkpointer.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { interrupt, Command } from '@langchain/langgraph';
import { ObservabilityService } from './observability.service';

export interface HitlRequest {
  type: 'confirmation' | 'choice' | 'input' | 'approval';
  question: string;
  options?: string[];
  dataToReview?: Record<string, unknown>;
  timeout?: number; // Optional timeout in ms
}

export interface HitlResponse {
  decision: string;
  value?: string;
  editedData?: Record<string, unknown>;
  reason?: string;
}

@Injectable()
export class HitlService {
  private readonly logger = new Logger(HitlService.name);

  constructor(
    private readonly observabilityService: ObservabilityService,
  ) {}

  /**
   * Request human input - pauses graph execution
   * Returns the human's response when resumed
   */
  async requestHumanInput(
    request: HitlRequest,
    context: {
      taskId: string;
      conversationId?: string;
      userId: string;
      agentSlug: string;
      organizationSlug?: string;
    },
  ): Promise<HitlResponse> {
    // Emit observability event
    await this.observabilityService.emitHitlRequest({
      ...context,
      hitlType: request.type,
      question: request.question,
      options: request.options,
      dataToReview: request.dataToReview,
    });

    // Use LangGraph's interrupt() to pause execution
    // This saves state to checkpointer and returns to caller
    const response = interrupt({
      type: request.type,
      question: request.question,
      options: request.options,
      dataToReview: request.dataToReview,
      timestamp: Date.now(),
    });

    return response as HitlResponse;
  }

  /**
   * Create a Command to route based on HITL response
   */
  createRouteCommand(
    response: HitlResponse,
    routes: {
      approved: string;
      rejected: string;
      edited?: string;
    },
    stateUpdates?: Record<string, unknown>,
  ): Command {
    if (response.decision === 'approve') {
      return new Command({
        update: stateUpdates,
        goto: routes.approved,
      });
    } else if (response.decision === 'edit' && routes.edited) {
      return new Command({
        update: { ...stateUpdates, ...response.editedData },
        goto: routes.edited,
      });
    } else {
      return new Command({
        update: {
          ...stateUpdates,
          errors: [`Rejected: ${response.reason || 'No reason provided'}`],
        },
        goto: routes.rejected,
      });
    }
  }
}
```

#### 5.0.5 Shared Services Module

**New File: `apps/langgraph/src/services/shared-services.module.ts`**

```typescript
import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { LLMHttpClientService } from './llm-http-client.service';
import { WebhookStatusService } from './webhook-status.service';
import { ObservabilityService } from './observability.service';
import { HitlService } from './hitl.service';

@Global()
@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    LLMHttpClientService,
    WebhookStatusService,
    ObservabilityService,
    HitlService,
  ],
  exports: [
    LLMHttpClientService,
    WebhookStatusService,
    ObservabilityService,
    HitlService,
  ],
})
export class SharedServicesModule {}
```

---

### 5.1 LangGraph Base Infrastructure

#### 5.1.1 PostgresSaver Checkpointer Setup

**New File: `apps/langgraph/src/persistence/postgres-checkpointer.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';

@Injectable()
export class PostgresCheckpointerService implements OnModuleInit, OnModuleDestroy {
  private checkpointer: PostgresSaver;
  private pool: pg.Pool;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL');

    this.pool = new pg.Pool({ connectionString });
    this.checkpointer = new PostgresSaver(this.pool);

    // Create checkpoint tables if they don't exist
    await this.checkpointer.setup();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  getCheckpointer(): PostgresSaver {
    return this.checkpointer;
  }
}
```

#### 5.1.2 PostgresStore for Long-Term Memory

**New File: `apps/langgraph/src/persistence/postgres-store.service.ts`**

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';

@Injectable()
export class PostgresStoreService implements OnModuleInit {
  private store: PostgresStore;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    this.store = PostgresStore.fromConnString(connectionString);
    await this.store.setup();
  }

  getStore(): PostgresStore {
    return this.store;
  }

  // Cross-session memory operations
  async saveMemory(namespace: string[], key: string, value: Record<string, unknown>) {
    await this.store.put(namespace, key, value);
  }

  async getMemory(namespace: string[], key: string) {
    return this.store.get(namespace, key);
  }

  async searchMemories(namespace: string[], query: string) {
    return this.store.search(namespace, { query });
  }
}
```

#### 5.1.3 Supabase Migration for LangGraph Tables

**New File: `apps/api/supabase/migrations/YYYYMMDD_langgraph_checkpoints.sql`**

```sql
-- LangGraph checkpoint tables (created by PostgresSaver.setup())
-- This migration ensures proper schema exists

CREATE SCHEMA IF NOT EXISTS langgraph;

-- Checkpoints table
CREATE TABLE IF NOT EXISTS langgraph.checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type TEXT,
    checkpoint JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

-- Checkpoint writes table (for pending writes)
CREATE TABLE IF NOT EXISTS langgraph.checkpoint_writes (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    channel TEXT NOT NULL,
    type TEXT,
    blob BYTEA,
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

-- Long-term memory store
CREATE TABLE IF NOT EXISTS langgraph.store (
    namespace TEXT[] NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (namespace, key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread
ON langgraph.checkpoints(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_namespace
ON langgraph.store USING GIN(namespace);
```

---

### 5.2 State Management with Annotations

#### 5.2.1 Base State Annotation

**New File: `apps/langgraph/src/state/base-state.annotation.ts`**

```typescript
import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

// Base state for all workflows
export const BaseWorkflowAnnotation = Annotation.Root({
  // Inherited message history
  ...MessagesAnnotation.spec,

  // Orchestrator AI context
  taskId: Annotation<string>(),
  conversationId: Annotation<string>(),
  userId: Annotation<string>(),
  organizationSlug: Annotation<string>(),

  // LLM configuration
  provider: Annotation<string>(),
  model: Annotation<string>(),

  // Status tracking
  statusWebhook: Annotation<string | undefined>(),
  currentStep: Annotation<string>(),
  totalSteps: Annotation<number>(),
  completedSteps: Annotation<number>({
    default: () => 0,
    reducer: (current, update) => update ?? current,
  }),

  // Error handling
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (current, update) => [...current, ...(update ?? [])],
  }),
});

export type BaseWorkflowState = typeof BaseWorkflowAnnotation.State;
```

#### 5.2.2 Workflow-Specific State Extensions

**New File: `apps/langgraph/src/state/marketing-swarm.annotation.ts`**

```typescript
import { Annotation } from '@langchain/langgraph';
import { BaseWorkflowAnnotation } from './base-state.annotation';

export const MarketingSwarmAnnotation = Annotation.Root({
  ...BaseWorkflowAnnotation.spec,

  // Input
  announcement: Annotation<string>(),

  // Outputs from parallel agents
  webPost: Annotation<string | undefined>(),
  seoContent: Annotation<string | undefined>(),
  socialMedia: Annotation<string | undefined>(),

  // Aggregated result
  result: Annotation<Record<string, string> | undefined>(),
});

export type MarketingSwarmState = typeof MarketingSwarmAnnotation.State;
```

---

### 5.3 Node Templates

#### 5.3.1 LLM Node Template

**Update File: `apps/langgraph/src/workflows/nodes/llm-node.ts`**

```typescript
import { RunnableConfig } from '@langchain/core/runnables';
import { BaseWorkflowState } from '../../state/base-state.annotation';

export interface LLMNodeConfig {
  systemMessage: string;
  inputField: keyof BaseWorkflowState;
  outputField: string;
  stepName: string;
}

export function createLLMNode<TState extends BaseWorkflowState>(
  config: LLMNodeConfig,
  llmClient: LLMHttpClientService,
  webhookService: WebhookStatusService,
) {
  return async (
    state: TState,
    runnableConfig?: RunnableConfig,
  ): Promise<Partial<TState>> => {
    // Send progress webhook
    if (state.statusWebhook) {
      await webhookService.sendProgress(
        state.statusWebhook,
        state.taskId,
        state.conversationId,
        state.userId,
        config.stepName,
        state.completedSteps + 1,
        state.totalSteps,
      );
    }

    // Get input from state
    const input = state[config.inputField] as string;

    // Make LLM call
    const result = await llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: config.systemMessage,
      userMessage: input,
      callerName: config.stepName,
      userId: state.userId,
    });

    return {
      [config.outputField]: result.text,
      completedSteps: state.completedSteps + 1,
      currentStep: config.stepName,
    } as Partial<TState>;
  };
}
```

#### 5.3.2 Decision Node Template

**New File: `apps/langgraph/src/workflows/nodes/decision-node.ts`**

```typescript
import { BaseWorkflowState } from '../../state/base-state.annotation';

export interface DecisionNodeConfig<TState> {
  evaluator: (state: TState) => string | Promise<string>;
  routes: Record<string, string>;
  defaultRoute?: string;
}

export function createDecisionNode<TState extends BaseWorkflowState>(
  config: DecisionNodeConfig<TState>,
) {
  return async (state: TState): Promise<string> => {
    const decision = await config.evaluator(state);
    return config.routes[decision] ?? config.defaultRoute ?? '__end__';
  };
}
```

#### 5.3.3 HITL Approval Node Template

**New File: `apps/langgraph/src/workflows/nodes/approval-node.ts`**

```typescript
import { interrupt, Command } from '@langchain/langgraph';
import { BaseWorkflowState } from '../../state/base-state.annotation';

export interface ApprovalNodeConfig {
  approvalMessage: (state: BaseWorkflowState) => string;
  dataToReview: (state: BaseWorkflowState) => Record<string, unknown>;
  approvedRoute: string;
  rejectedRoute: string;
}

export function createApprovalNode<TState extends BaseWorkflowState>(
  config: ApprovalNodeConfig,
) {
  return async (state: TState): Promise<Command> => {
    // Pause execution and wait for human input
    const humanResponse = interrupt({
      message: config.approvalMessage(state),
      dataToReview: config.dataToReview(state),
      options: ['approve', 'reject', 'edit'],
    });

    // Handle human response
    if (humanResponse.decision === 'approve') {
      return new Command({
        goto: config.approvedRoute,
      });
    } else if (humanResponse.decision === 'reject') {
      return new Command({
        update: { errors: [`Rejected: ${humanResponse.reason}`] },
        goto: config.rejectedRoute,
      });
    } else if (humanResponse.decision === 'edit') {
      return new Command({
        update: humanResponse.edits,
        goto: config.approvedRoute,
      });
    }

    return new Command({ goto: '__end__' });
  };
}
```

---

### 5.4 Graph Builder Pattern

#### 5.4.1 Refactored Marketing Swarm Graph

**Update File: `apps/langgraph/src/workflows/graphs/marketing-swarm.graph.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';
import { PostgresStoreService } from '../../persistence/postgres-store.service';
import { MarketingSwarmAnnotation, MarketingSwarmState } from '../../state/marketing-swarm.annotation';
import { createLLMNode } from '../nodes/llm-node';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { WebhookStatusService } from '../../services/webhook-status.service';

@Injectable()
export class MarketingSwarmGraph {
  private compiledGraph;

  constructor(
    private readonly checkpointerService: PostgresCheckpointerService,
    private readonly storeService: PostgresStoreService,
    private readonly llmClient: LLMHttpClientService,
    private readonly webhookService: WebhookStatusService,
  ) {
    this.compiledGraph = this.buildGraph();
  }

  private buildGraph() {
    const builder = new StateGraph(MarketingSwarmAnnotation)
      // Parallel content generation nodes
      .addNode('webPostWriter', createLLMNode({
        systemMessage: 'You are a brilliant blog post writer...',
        inputField: 'announcement',
        outputField: 'webPost',
        stepName: 'Write Blog Post',
      }, this.llmClient, this.webhookService))

      .addNode('seoSpecialist', createLLMNode({
        systemMessage: 'You are an expert SEO specialist...',
        inputField: 'announcement',
        outputField: 'seoContent',
        stepName: 'Create SEO',
      }, this.llmClient, this.webhookService))

      .addNode('socialMediaStrategist', createLLMNode({
        systemMessage: 'You are a social media content strategist...',
        inputField: 'announcement',
        outputField: 'socialMedia',
        stepName: 'Create Social Media',
      }, this.llmClient, this.webhookService))

      .addNode('aggregator', this.aggregateResults.bind(this))

      // Fan-out from START to all content generators in parallel
      .addEdge(START, 'webPostWriter')
      .addEdge(START, 'seoSpecialist')
      .addEdge(START, 'socialMediaStrategist')

      // Fan-in to aggregator
      .addEdge('webPostWriter', 'aggregator')
      .addEdge('seoSpecialist', 'aggregator')
      .addEdge('socialMediaStrategist', 'aggregator')

      .addEdge('aggregator', END);

    return builder.compile({
      checkpointer: this.checkpointerService.getCheckpointer(),
      store: this.storeService.getStore(),
    });
  }

  private async aggregateResults(state: MarketingSwarmState): Promise<Partial<MarketingSwarmState>> {
    return {
      result: {
        webPost: state.webPost!,
        seoContent: state.seoContent!,
        socialMedia: state.socialMedia!,
      },
    };
  }

  async execute(input: Partial<MarketingSwarmState>, threadId: string): Promise<MarketingSwarmState> {
    const config = {
      configurable: {
        thread_id: threadId,
      },
    };

    // Send start webhook
    if (input.statusWebhook) {
      await this.webhookService.sendStarted(
        input.statusWebhook,
        input.taskId!,
        input.conversationId!,
        input.userId!,
        3,
      );
    }

    try {
      const result = await this.compiledGraph.invoke(
        { ...input, totalSteps: 3 },
        config,
      );

      // Send completion webhook
      if (input.statusWebhook) {
        await this.webhookService.sendCompleted(
          input.statusWebhook,
          input.taskId!,
          input.conversationId!,
          input.userId!,
          result.result,
        );
      }

      return result;
    } catch (error) {
      if (input.statusWebhook) {
        await this.webhookService.sendFailed(
          input.statusWebhook,
          input.taskId!,
          input.conversationId!,
          input.userId!,
          error.message,
        );
      }
      throw error;
    }
  }

  // For streaming responses
  async *stream(input: Partial<MarketingSwarmState>, threadId: string) {
    const config = {
      configurable: { thread_id: threadId },
    };

    for await (const event of this.compiledGraph.stream(
      { ...input, totalSteps: 3 },
      { ...config, streamMode: 'updates' },
    )) {
      yield event;
    }
  }
}
```

---

### 5.5 HITL Workflow Pattern

#### 5.5.1 HR Assistant with Approval Flow

**New File: `apps/langgraph/src/workflows/graphs/hr-assistant.graph.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import { BaseWorkflowAnnotation } from '../../state/base-state.annotation';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';

// HR Assistant specific state
const HRAssistantAnnotation = Annotation.Root({
  ...BaseWorkflowAnnotation.spec,
  employeeQuery: Annotation<string>(),
  queryCategory: Annotation<'policy' | 'benefits' | 'pto' | 'sensitive' | undefined>(),
  ragContext: Annotation<string | undefined>(),
  draftResponse: Annotation<string | undefined>(),
  finalResponse: Annotation<string | undefined>(),
  requiresApproval: Annotation<boolean>({ default: () => false }),
  approvalStatus: Annotation<'pending' | 'approved' | 'rejected' | undefined>(),
});

type HRAssistantState = typeof HRAssistantAnnotation.State;

@Injectable()
export class HRAssistantGraph {
  private compiledGraph;

  constructor(
    private readonly checkpointerService: PostgresCheckpointerService,
    private readonly llmClient: LLMHttpClientService,
    private readonly ragService: RAGService,
  ) {
    this.compiledGraph = this.buildGraph();
  }

  private buildGraph() {
    return new StateGraph(HRAssistantAnnotation)
      .addNode('categorize', this.categorizeQuery.bind(this))
      .addNode('retrieveContext', this.retrieveRAGContext.bind(this))
      .addNode('generateDraft', this.generateDraftResponse.bind(this))
      .addNode('humanApproval', this.requestHumanApproval.bind(this))
      .addNode('finalize', this.finalizeResponse.bind(this))

      .addEdge(START, 'categorize')
      .addEdge('categorize', 'retrieveContext')
      .addEdge('retrieveContext', 'generateDraft')

      // Conditional: sensitive queries need approval
      .addConditionalEdges('generateDraft', this.routeAfterDraft.bind(this), {
        needsApproval: 'humanApproval',
        autoApprove: 'finalize',
      })

      // After approval, go to finalize or end
      .addConditionalEdges('humanApproval', this.routeAfterApproval.bind(this), {
        approved: 'finalize',
        rejected: '__end__',
      })

      .addEdge('finalize', END)

      .compile({
        checkpointer: this.checkpointerService.getCheckpointer(),
      });
  }

  private async categorizeQuery(state: HRAssistantState): Promise<Partial<HRAssistantState>> {
    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `Categorize this HR query into one of: policy, benefits, pto, sensitive.
        'sensitive' includes: termination, harassment, legal issues, salary disputes`,
      userMessage: state.employeeQuery,
      userId: state.userId,
    });

    const category = result.text.toLowerCase().trim() as HRAssistantState['queryCategory'];

    return {
      queryCategory: category,
      requiresApproval: category === 'sensitive',
    };
  }

  private async retrieveRAGContext(state: HRAssistantState): Promise<Partial<HRAssistantState>> {
    const context = await this.ragService.search(
      state.employeeQuery,
      state.organizationSlug,
      `hr-${state.queryCategory}`,
    );

    return { ragContext: context };
  }

  private async generateDraftResponse(state: HRAssistantState): Promise<Partial<HRAssistantState>> {
    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are an HR assistant. Use the provided context to answer the employee's question.
        Context: ${state.ragContext}`,
      userMessage: state.employeeQuery,
      userId: state.userId,
    });

    return { draftResponse: result.text };
  }

  private routeAfterDraft(state: HRAssistantState): string {
    return state.requiresApproval ? 'needsApproval' : 'autoApprove';
  }

  private async requestHumanApproval(state: HRAssistantState): Promise<Command> {
    // This pauses execution until a human responds
    const response = interrupt({
      type: 'approval_request',
      message: 'Sensitive HR response requires approval',
      query: state.employeeQuery,
      category: state.queryCategory,
      draftResponse: state.draftResponse,
      options: ['approve', 'reject', 'edit'],
    });

    if (response.decision === 'approve') {
      return new Command({
        update: { approvalStatus: 'approved' },
        goto: 'approved',
      });
    } else if (response.decision === 'edit') {
      return new Command({
        update: {
          approvalStatus: 'approved',
          draftResponse: response.editedResponse,
        },
        goto: 'approved',
      });
    } else {
      return new Command({
        update: {
          approvalStatus: 'rejected',
          errors: [`Response rejected: ${response.reason}`],
        },
        goto: 'rejected',
      });
    }
  }

  private routeAfterApproval(state: HRAssistantState): string {
    return state.approvalStatus === 'approved' ? 'approved' : 'rejected';
  }

  private async finalizeResponse(state: HRAssistantState): Promise<Partial<HRAssistantState>> {
    return { finalResponse: state.draftResponse };
  }

  // Execute and handle interrupts
  async execute(input: Partial<HRAssistantState>, threadId: string) {
    const config = { configurable: { thread_id: threadId } };
    return this.compiledGraph.invoke(input, config);
  }

  // Resume from interrupt with human input
  async resume(threadId: string, humanResponse: Record<string, unknown>) {
    const config = { configurable: { thread_id: threadId } };
    return this.compiledGraph.invoke(
      new Command({ resume: humanResponse }),
      config,
    );
  }

  // Check if graph is waiting for human input
  async getInterruptState(threadId: string) {
    const state = await this.compiledGraph.getState({
      configurable: { thread_id: threadId }
    });
    return {
      isInterrupted: state.next.length === 0 && !state.values.finalResponse,
      interruptData: state.tasks?.[0]?.interrupts?.[0],
      currentState: state.values,
    };
  }
}
```

---

### 5.6 Tool Calling Integration

#### 5.6.1 Tool-Calling Agent Node

**New File: `apps/langgraph/src/workflows/nodes/tool-agent-node.ts`**

```typescript
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage } from '@langchain/core/messages';
import { BaseWorkflowState } from '../../state/base-state.annotation';

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, state: BaseWorkflowState) => Promise<unknown>;
}

export function createToolCallingAgent<TState extends BaseWorkflowState>(
  tools: ToolDefinition[],
  systemMessage: string,
) {
  // Convert to LangChain tool format
  const langchainTools = tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
  }));

  return {
    // Agent node that decides which tools to call
    agentNode: async (state: TState) => {
      const model = new ChatAnthropic({
        modelName: state.model,
      }).bindTools(langchainTools);

      const response = await model.invoke([
        { role: 'system', content: systemMessage },
        ...state.messages,
      ]);

      return { messages: [response] };
    },

    // Tool execution node
    toolNode: new ToolNode(
      tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        func: async (args: Record<string, unknown>) => {
          // Tool execution will be called by ToolNode
          return tool.execute(args, {} as TState);
        },
      })),
    ),

    // Routing function for tools_condition
    shouldContinue: (state: TState): string => {
      const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return 'tools';
      }
      return '__end__';
    },
  };
}
```

---

### 5.7 Supervisor Multi-Agent Pattern

#### 5.7.1 Supervisor Agent Graph

**New File: `apps/langgraph/src/workflows/graphs/supervisor.graph.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { BaseWorkflowAnnotation } from '../../state/base-state.annotation';

const SupervisorAnnotation = Annotation.Root({
  ...BaseWorkflowAnnotation.spec,
  userRequest: Annotation<string>(),
  selectedAgent: Annotation<string | undefined>(),
  agentResponse: Annotation<string | undefined>(),
  nextAction: Annotation<'delegate' | 'respond' | 'clarify'>(),
});

type SupervisorState = typeof SupervisorAnnotation.State;

@Injectable()
export class SupervisorGraph {
  private compiledGraph;
  private subgraphs: Map<string, StateGraph>;

  constructor(
    private readonly checkpointerService: PostgresCheckpointerService,
    private readonly llmClient: LLMHttpClientService,
  ) {
    this.subgraphs = new Map();
    this.compiledGraph = this.buildGraph();
  }

  // Register specialist subgraphs
  registerSubgraph(name: string, graph: StateGraph) {
    this.subgraphs.set(name, graph);
    // Rebuild main graph to include new subgraph
    this.compiledGraph = this.buildGraph();
  }

  private buildGraph() {
    const builder = new StateGraph(SupervisorAnnotation)
      .addNode('supervisor', this.supervisorNode.bind(this))
      .addNode('delegate', this.delegateToSpecialist.bind(this))
      .addNode('respond', this.generateFinalResponse.bind(this))
      .addNode('clarify', this.askForClarification.bind(this))

      .addEdge(START, 'supervisor')

      .addConditionalEdges('supervisor', (state) => state.nextAction, {
        delegate: 'delegate',
        respond: 'respond',
        clarify: 'clarify',
      })

      .addEdge('delegate', 'supervisor') // Return to supervisor after delegation
      .addEdge('respond', END)
      .addEdge('clarify', END); // Wait for user clarification

    // Add registered subgraphs as nodes
    for (const [name, subgraph] of this.subgraphs) {
      builder.addNode(name, subgraph);
    }

    return builder.compile({
      checkpointer: this.checkpointerService.getCheckpointer(),
    });
  }

  private async supervisorNode(state: SupervisorState): Promise<Partial<SupervisorState>> {
    const availableAgents = Array.from(this.subgraphs.keys());

    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are a supervisor agent. Analyze the user's request and decide:
        1. Which specialist agent should handle this (available: ${availableAgents.join(', ')})
        2. Or if you can respond directly
        3. Or if you need clarification

        Respond with JSON: { "action": "delegate|respond|clarify", "agent": "agent_name", "reason": "..." }`,
      userMessage: state.userRequest,
      userId: state.userId,
    });

    const decision = JSON.parse(result.text);

    return {
      selectedAgent: decision.agent,
      nextAction: decision.action,
    };
  }

  private async delegateToSpecialist(state: SupervisorState): Promise<Partial<SupervisorState>> {
    const subgraph = this.subgraphs.get(state.selectedAgent!);
    if (!subgraph) {
      return { errors: [`Unknown agent: ${state.selectedAgent}`] };
    }

    const result = await subgraph.invoke({
      ...state,
      prompt: state.userRequest,
    });

    return { agentResponse: result.result || result.finalResponse };
  }

  private async generateFinalResponse(state: SupervisorState): Promise<Partial<SupervisorState>> {
    // Synthesize final response from agent response or direct answer
    return { /* final response logic */ };
  }

  private async askForClarification(state: SupervisorState): Promise<Partial<SupervisorState>> {
    // Generate clarification question
    return { /* clarification logic */ };
  }
}
```

---

### 5.8 Streaming Integration

#### 5.8.1 Streaming Controller Endpoint

**Update File: `apps/langgraph/src/workflows/workflows.controller.ts`**

```typescript
import { Controller, Post, Body, Sse, Param } from '@nestjs/common';
import { Observable, from, map } from 'rxjs';

@Controller('workflows')
export class WorkflowsController {
  // ... existing methods ...

  @Sse(':workflowName/stream')
  streamWorkflow(
    @Param('workflowName') workflowName: string,
    @Body() request: WorkflowRequestDto,
  ): Observable<MessageEvent> {
    const workflow = this.getWorkflow(workflowName);
    const threadId = request.taskId;

    return from(workflow.stream(request, threadId)).pipe(
      map((event) => ({
        data: JSON.stringify({
          type: 'state_update',
          node: Object.keys(event)[0],
          update: event[Object.keys(event)[0]],
          timestamp: new Date().toISOString(),
        }),
      })),
    );
  }
}
```

---

### 5.9 Tools Module (PRD Section 11.3)

> **Aligns with**: PRD Section 11.3 - LangGraph Tools Module

The tools module provides shared tools available to all LangGraph agents.

#### 5.9.1 Tools Module Structure

**New File: `apps/langgraph/src/tools/tools.module.ts`**

```typescript
import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RagTool } from './rag.tool';
import { DatabaseTool } from './database.tool';

@Global()
@Module({
  imports: [HttpModule, ConfigModule],
  providers: [RagTool, DatabaseTool],
  exports: [RagTool, DatabaseTool],
})
export class ToolsModule {}
```

#### 5.9.2 RAG Tool (PRD Section 6.5)

**New File: `apps/langgraph/src/tools/rag.tool.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * RAG Tool - Wraps the RAG retrieval endpoint
 *
 * This tool allows LangGraph agents to query RAG collections
 * for context retrieval. It wraps the Orchestrator AI RAG API.
 *
 * Usage in LangGraph graph:
 *   const tools = [ragTool.createTool()];
 *   const model = new ChatAnthropic().bindTools(tools);
 */
@Injectable()
export class RagTool {
  private readonly logger = new Logger(RagTool.name);
  private readonly apiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiPort = this.configService.get<string>('API_PORT');
    const apiHost = this.configService.get<string>('API_HOST') || 'localhost';
    this.apiUrl = `http://${apiHost}:${apiPort}`;
  }

  /**
   * Create the RAG tool for use in LangGraph
   */
  createTool() {
    return tool(
      async ({ collectionId, prompt, strategy, topK, similarityThreshold }) => {
        return this.query({
          collectionId,
          prompt,
          strategy,
          topK,
          similarityThreshold,
        });
      },
      {
        name: 'rag_query',
        description: 'Query a RAG collection to retrieve relevant context for answering questions',
        schema: z.object({
          collectionId: z.string().describe('The ID of the RAG collection to query'),
          prompt: z.string().describe('The query/question to search for'),
          strategy: z.enum(['basic', 'reranking']).optional().default('basic')
            .describe('RAG strategy to use'),
          topK: z.number().optional().default(5)
            .describe('Number of results to retrieve'),
          similarityThreshold: z.number().optional()
            .describe('Minimum similarity score (0-1)'),
        }),
      },
    );
  }

  /**
   * Direct query method (for non-tool usage)
   */
  async query(params: {
    collectionId: string;
    prompt: string;
    strategy?: 'basic' | 'reranking';
    topK?: number;
    similarityThreshold?: number;
  }): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/api/rag/collections/${params.collectionId}/query`,
          {
            query: params.prompt,
            strategy: params.strategy || 'basic',
            top_k: params.topK || 5,
            similarity_threshold: params.similarityThreshold,
          },
        ),
      );

      // Format results as context string
      const results = response.data.results || [];
      return results
        .map((r: { content: string; score: number }) => r.content)
        .join('\n\n---\n\n');
    } catch (error) {
      this.logger.error(`RAG query failed: ${error.message}`);
      return 'Unable to retrieve context from RAG collection.';
    }
  }
}
```

#### 5.9.3 Database Tool

**New File: `apps/langgraph/src/tools/database.tool.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Database Tool - Query company data
 *
 * This tool allows LangGraph agents to query structured data
 * for metrics and analytics.
 */
@Injectable()
export class DatabaseTool {
  private readonly logger = new Logger(DatabaseTool.name);
  private readonly apiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiPort = this.configService.get<string>('API_PORT');
    const apiHost = this.configService.get<string>('API_HOST') || 'localhost';
    this.apiUrl = `http://${apiHost}:${apiPort}`;
  }

  createTool() {
    return tool(
      async ({ query, database }) => {
        return this.executeQuery({ query, database });
      },
      {
        name: 'database_query',
        description: 'Execute a safe read-only query against a database to retrieve metrics or data',
        schema: z.object({
          query: z.string().describe('Natural language description of the data needed'),
          database: z.enum(['company_data', 'orchestrator_ai'])
            .describe('Which database to query'),
        }),
      },
    );
  }

  async executeQuery(params: { query: string; database: string }): Promise<string> {
    // Implementation would call a safe query endpoint
    // For now, return placeholder
    return `Query results for: ${params.query}`;
  }
}
```

---

### 5.10 Agent Feature Module Pattern (PRD Section 11.2)

> **Aligns with**: PRD Section 11.2 - Agent Feature Modules

Each LangGraph agent is a self-contained NestJS module. This pattern ensures consistency and enables Claude Code automation.

#### 5.10.1 Agent Module Template

**Template: `apps/langgraph/src/agents/{agent-name}/{agent-name}.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { {AgentName}Controller } from './{agent-name}.controller';
import { {AgentName}Service } from './{agent-name}.service';
import { {AgentName}Graph } from './graphs/{agent-name}.graph';

@Module({
  controllers: [{AgentName}Controller],
  providers: [
    {AgentName}Service,
    {AgentName}Graph,
  ],
  exports: [{AgentName}Service],
})
export class {AgentName}Module {}
```

#### 5.10.2 Agent Service Template

**Template: `apps/langgraph/src/agents/{agent-name}/{agent-name}.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { {AgentName}Graph } from './graphs/{agent-name}.graph';
import { {AgentName}RequestDto } from './dto/{agent-name}-request.dto';

@Injectable()
export class {AgentName}Service {
  constructor(
    private readonly graph: {AgentName}Graph,
  ) {}

  async execute(request: {AgentName}RequestDto) {
    const threadId = request.taskId;
    return this.graph.execute(request, threadId);
  }

  async resume(threadId: string, humanResponse: Record<string, unknown>) {
    return this.graph.resume(threadId, humanResponse);
  }

  async getState(threadId: string) {
    return this.graph.getInterruptState(threadId);
  }
}
```

#### 5.10.3 Agent Controller Template

**Template: `apps/langgraph/src/agents/{agent-name}/{agent-name}.controller.ts`**

```typescript
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { {AgentName}Service } from './{agent-name}.service';
import { {AgentName}RequestDto } from './dto/{agent-name}-request.dto';

@Controller('agents/{agent-slug}')
export class {AgentName}Controller {
  constructor(private readonly service: {AgentName}Service) {}

  @Post('execute')
  async execute(@Body() request: {AgentName}RequestDto) {
    return this.service.execute(request);
  }

  @Post(':threadId/resume')
  async resume(
    @Param('threadId') threadId: string,
    @Body() response: Record<string, unknown>,
  ) {
    return this.service.resume(threadId, response);
  }

  @Get(':threadId/state')
  async getState(@Param('threadId') threadId: string) {
    return this.service.getState(threadId);
  }
}
```

---

## Claude Code Agent Creation Patterns

This section defines patterns for Claude Code agents to generate new LangGraph agents automatically.

### Pattern 1: Basic Agent (No HITL, No RAG)

**Use Case**: Simple workflow agents like Blog Post Writer

**Files to Generate**:
1. `{agent-name}.module.ts`
2. `{agent-name}.service.ts`
3. `{agent-name}.controller.ts`
4. `dto/{agent-name}-request.dto.ts`
5. `graphs/{agent-name}.graph.ts`
6. `state/{agent-name}.annotation.ts`

**Key Characteristics**:
- Uses `LLMHttpClientService` for LLM calls
- Uses `WebhookStatusService` for status updates
- Uses `ObservabilityService` for events
- Linear graph flow (START → nodes → END)
- No checkpointing needed (simple workflows)

### Pattern 2: RAG Agent

**Use Case**: Knowledge-based agents like HR Assistant

**Additional Requirements**:
- Import and use `RagTool` from tools module
- Query RAG collection before LLM generation
- Pass RAG context to LLM systemMessage

**Key Graph Pattern**:
```typescript
.addNode('retrieveContext', async (state) => {
  const context = await this.ragTool.query({
    collectionId: state.ragCollectionId,
    prompt: state.userQuery,
  });
  return { ragContext: context };
})
.addEdge('retrieveContext', 'generateResponse')
```

### Pattern 3: HITL Agent

**Use Case**: Approval workflows like Marketing Swarm

**Additional Requirements**:
- Use `HitlService` for interrupt/resume
- Configure `PostgresCheckpointerService`
- Add HITL node using `interrupt()` or `HitlService.requestHumanInput()`
- Implement resume logic in service

**Key Graph Pattern**:
```typescript
.addNode('humanApproval', async (state) => {
  const response = await this.hitlService.requestHumanInput(
    { type: 'approval', question: 'Approve this content?' },
    { taskId: state.taskId, userId: state.userId, agentSlug: 'my-agent' },
  );
  return this.hitlService.createRouteCommand(response, {
    approved: 'finalize',
    rejected: '__end__',
  });
})
```

### Pattern 4: Tool-Calling Agent

**Use Case**: Agents that need to decide which tools to use

**Additional Requirements**:
- Create tool definitions
- Use `createToolCallingAgent` helper
- Implement tool loop with `tools_condition`

**Key Graph Pattern**:
```typescript
const { agentNode, toolNode, shouldContinue } = createToolCallingAgent(
  [ragTool.createTool(), databaseTool.createTool()],
  'You are a helpful assistant with access to tools.',
);

builder
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    __end__: END,
  })
  .addEdge('tools', 'agent');
```

---

## Implementation Phases

### Phase 5.0: Shared Services (Week 0.5)
- [ ] Create ObservabilityService
- [ ] Create HitlService
- [ ] Create SharedServicesModule
- [ ] Update existing services to use shared module

### Phase 5.1: Infrastructure (Week 1)
- [ ] Install `@langchain/langgraph-checkpoint-postgres`
- [ ] Create PostgresCheckpointerService
- [ ] Create PostgresStoreService
- [ ] Add Supabase migration for langgraph schema
- [ ] Create base state annotations

### Phase 5.2: Refactor Existing Graphs (Week 2)
- [ ] Convert MarketingSwarmGraph to proper StateGraph
- [ ] Convert RequirementsWriterGraph to StateGraph
- [ ] Convert MetricsAgentGraph to StateGraph
- [ ] Add checkpointing to all graphs
- [ ] Implement parallel execution for marketing swarm

### Phase 5.3: HITL Implementation (Week 3)
- [ ] Create approval node template
- [ ] Implement HR Assistant graph with HITL
- [ ] Add interrupt/resume endpoints to controller
- [ ] Create interrupt state query endpoint
- [ ] Test approval workflow end-to-end

### Phase 5.4: Tool Calling & Agents (Week 4)
- [ ] Create tool-calling agent template
- [ ] Implement RAG tool for HR Assistant
- [ ] Add database query tools
- [ ] Implement tools_condition routing
- [ ] Create Supervisor graph

### Phase 5.5: Streaming & Polish (Week 5)
- [ ] Add SSE streaming endpoints
- [ ] Implement stream(mode: "updates")
- [ ] Add time-travel debugging endpoints
- [ ] Performance optimization
- [ ] Documentation and examples

---

## File Structure After Phase 5

```
apps/langgraph/
├── src/
│   ├── services/                               # SHARED SERVICES (5.0)
│   │   ├── shared-services.module.ts           # NEW - Global module
│   │   ├── llm-http-client.service.ts          # EXISTS - LLM calls via Orchestrator AI API
│   │   ├── webhook-status.service.ts           # EXISTS - Status webhooks
│   │   ├── observability.service.ts            # NEW - Observability events
│   │   └── hitl.service.ts                     # NEW - HITL functionality
│   │
│   ├── persistence/                            # CHECKPOINTING (5.1)
│   │   ├── persistence.module.ts               # NEW
│   │   ├── postgres-checkpointer.service.ts    # NEW - PostgresSaver wrapper
│   │   └── postgres-store.service.ts           # NEW - Long-term memory
│   │
│   ├── state/                                  # STATE ANNOTATIONS (5.2)
│   │   ├── base-state.annotation.ts            # NEW - Base state for all workflows
│   │   ├── marketing-swarm.annotation.ts       # NEW
│   │   ├── hr-assistant.annotation.ts          # NEW
│   │   └── supervisor.annotation.ts            # NEW
│   │
│   ├── tools/                                  # SHARED TOOLS (5.9)
│   │   ├── tools.module.ts                     # NEW - Global tools module
│   │   ├── rag.tool.ts                         # NEW - RAG retrieval tool
│   │   ├── database.tool.ts                    # NEW - Database query tool
│   │   └── index.ts                            # NEW - Tool exports
│   │
│   ├── workflows/                              # LEGACY - Will migrate to agents/
│   │   ├── nodes/
│   │   │   ├── llm-node.ts                     # UPDATED - Node template
│   │   │   ├── decision-node.ts                # NEW - Conditional routing
│   │   │   ├── approval-node.ts                # NEW - HITL approval
│   │   │   └── tool-agent-node.ts              # NEW - Tool calling
│   │   ├── graphs/
│   │   │   ├── marketing-swarm.graph.ts        # UPDATED (proper StateGraph)
│   │   │   └── ...
│   │   └── workflows.module.ts                 # UPDATED
│   │
│   ├── agents/                                 # AGENT FEATURE MODULES (5.10)
│   │   ├── marketing-swarm/                    # Example: HITL Agent
│   │   │   ├── marketing-swarm.module.ts
│   │   │   ├── marketing-swarm.controller.ts
│   │   │   ├── marketing-swarm.service.ts
│   │   │   ├── graphs/
│   │   │   │   └── marketing-swarm.graph.ts
│   │   │   ├── state/
│   │   │   │   └── marketing-swarm.annotation.ts
│   │   │   └── dto/
│   │   │       └── marketing-swarm-request.dto.ts
│   │   │
│   │   └── hr-assistant/                       # Example: RAG Agent
│   │       ├── hr-assistant.module.ts
│   │       ├── hr-assistant.controller.ts
│   │       ├── hr-assistant.service.ts
│   │       ├── graphs/
│   │       │   └── hr-assistant.graph.ts
│   │       ├── state/
│   │       │   └── hr-assistant.annotation.ts
│   │       └── dto/
│   │           └── hr-assistant-request.dto.ts
│   │
│   ├── app.module.ts                           # UPDATED - Import shared modules
│   └── main.ts

apps/api/supabase/migrations/
└── YYYYMMDD_langgraph_checkpoints.sql          # NEW - Checkpoint tables
```

### Key Architecture Decisions

1. **Shared Services Module (@Global)**: LLM, Webhook, Observability, HITL services available everywhere
2. **Tools Module (@Global)**: RAG and Database tools available to all agents
3. **Agent Feature Modules**: Each agent is self-contained with its own module/controller/service/graph
4. **All LLM calls through Orchestrator AI API**: Enables usage tracking, PII handling, observability
5. **Observability via /hooks endpoint**: All events flow through central observability system

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@langchain/langgraph": "^0.2.x",
    "@langchain/langgraph-checkpoint-postgres": "^0.1.x",
    "@langchain/core": "^0.3.x",
    "@langchain/anthropic": "^0.3.x",
    "@langchain/openai": "^0.3.x",
    "pg": "^8.x"
  }
}
```

---

## Success Criteria

### Core Infrastructure
1. **Shared Services Module** - LLM, Webhook, Observability, HITL services available globally
2. **Tools Module** - RAG and Database tools available to all agents
3. **Persistence Module** - PostgresSaver checkpointer and PostgresStore working

### Agent Patterns
4. **All existing workflows** converted to proper StateGraph with checkpointing
5. **Agent Feature Module pattern** established and documented
6. **HR Assistant** demonstrates RAG tool integration
7. **Marketing Swarm** demonstrates full HITL interrupt/resume cycle
8. **Supervisor pattern** working with 2+ specialist subgraphs

### LangGraph Features
9. **Conditional Routing** - addConditionalEdges working
10. **Tool Calling** - bindTools + tools_condition working
11. **Streaming** - stream(mode: "updates") working via SSE
12. **Time travel** - ability to replay from any checkpoint

### Integration
13. **All LLM calls through Orchestrator AI API** - usage tracking, PII handling
14. **Observability events flowing** - node start/finish, HITL requests
15. **No regression** - existing API contracts maintained

### Claude Code Automation Ready
16. **Agent creation patterns documented** - Basic, RAG, HITL, Tool-Calling
17. **Templates ready** for Claude Code agents to generate new agents
18. **File structure consistent** across all agent modules
