# PRD: Phase 7 - LangGraph Architecture & Demo Agents

## Document Information
- **Version**: 1.0
- **Status**: Draft
- **Author**: Claude Code
- **Date**: 2025-01-21
- **Dependencies**: Phase 6 (RAG Infrastructure), Supabase, existing LangGraph app

---

## 1. Executive Summary

This PRD defines the complete LangGraph architecture for Orchestrator AI and delivers two production demo agents that showcase the platform's capabilities. This phase transforms the existing basic LangGraph implementation into a full-featured system with checkpointing, HITL workflows, RAG integration, and multi-agent patterns.

**Key Deliverables:**
1. Shared Services Module (LLM, Observability, Webhook, HITL)
2. Persistence Module (PostgresSaver checkpointing, PostgresStore memory)
3. Tools Module (RAG tool wrapping Phase 6 API)
4. HITL Infrastructure (interrupt/resume, front-end approval UI)
5. **HR Assistant Agent** - RAG-powered knowledge agent
6. **Marketing Swarm Agent** - HITL-powered content generation

**Success Metric:** Both agents fully functional, demonstrating RAG retrieval and HITL approval workflows through the Orchestrator AI UI.

---

## 2. Problem Statement

### Current State
- LangGraph implementation uses manual sequential execution (not actual StateGraph)
- No checkpointing - state lost if process crashes
- No HITL capability - no interrupt/resume
- No RAG integration - agents cannot access knowledge bases
- Existing workflows: marketing-swarm, requirements-writer, metrics-agent (basic)

### Desired State
- Full LangGraph.js StateGraph with proper state management
- Durable execution via PostgresSaver checkpointing
- HITL workflows with interrupt/resume/edit capabilities
- RAG tool integration for knowledge-based agents
- Two polished demo agents showcasing platform capabilities

---

## 3. Architecture Overview

### 3.1 Module Structure

```
apps/langgraph/src/
├── services/                    # SHARED SERVICES MODULE
│   ├── shared-services.module.ts
│   ├── llm-http-client.service.ts     (EXISTS)
│   ├── webhook-status.service.ts      (EXISTS)
│   ├── observability.service.ts       (NEW)
│   └── hitl.service.ts                (NEW)
│
├── persistence/                 # PERSISTENCE MODULE
│   ├── persistence.module.ts
│   ├── postgres-checkpointer.service.ts
│   └── postgres-store.service.ts
│
├── tools/                       # TOOLS MODULE
│   ├── tools.module.ts
│   ├── rag.tool.ts
│   └── index.ts
│
├── state/                       # STATE ANNOTATIONS
│   ├── base-state.annotation.ts
│   └── index.ts
│
├── nodes/                       # NODE TEMPLATES
│   ├── llm-node.ts
│   ├── decision-node.ts
│   ├── approval-node.ts
│   └── index.ts
│
├── agents/                      # AGENT FEATURE MODULES
│   ├── hr-assistant/
│   │   ├── hr-assistant.module.ts
│   │   ├── hr-assistant.controller.ts
│   │   ├── hr-assistant.service.ts
│   │   ├── hr-assistant.graph.ts
│   │   ├── hr-assistant.annotation.ts
│   │   └── dto/
│   │
│   └── marketing-swarm/
│       ├── marketing-swarm.module.ts
│       ├── marketing-swarm.controller.ts
│       ├── marketing-swarm.service.ts
│       ├── marketing-swarm.graph.ts
│       ├── marketing-swarm.annotation.ts
│       └── dto/
│
└── app.module.ts
```

### 3.2 Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Front-End (Vue 3)                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │   Agent    │  │   Agent    │  │   HITL     │  │   Interrupt    │  │
│  │   Chat     │  │  Selector  │  │  Approval  │  │   Status       │  │
│  │   Panel    │  │            │  │   Modal    │  │   Banner       │  │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Orchestrator AI API                             │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Agent Execution Engine (existing)                             │  │
│  │  - Routes to LangGraph agents                                  │  │
│  │  - Handles status webhook callbacks                            │  │
│  │  - Stores HITL interrupt state                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                │                                     │
│            ┌───────────────────┼───────────────────┐                 │
│            ▼                   ▼                   ▼                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │   /llm/      │    │  /hooks      │    │  /api/rag/           │   │
│  │   generate   │    │  (observ.)   │    │  collections/:id/    │   │
│  │              │    │              │    │  query               │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
         │                    │                       │
         └────────────────────┼───────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    LangGraph App (apps/langgraph)                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Shared Services Module                      │  │
│  │  LLMHttpClient | WebhookStatus | Observability | HITL          │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐  │
│  │ Persistence      │  │            Tools Module                  │  │
│  │ PostgresSaver    │  │  RagTool (wraps RAG API)                 │  │
│  │ PostgresStore    │  │                                          │  │
│  └──────────────────┘  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │                    Agent Feature Modules                        ││
│  │  ┌─────────────────────┐    ┌─────────────────────────────┐     ││
│  │  │   HR Assistant      │    │   Marketing Swarm           │     ││
│  │  │   (RAG Agent)       │    │   (HITL Agent)              │     ││
│  │  │                     │    │                             │     ││
│  │  │ [Query RAG]──►[LLM] │    │ [Blog]─┐                    │     ││
│  │  │                     │    │ [SEO]──┼►[Approval]──►[Done]│     ││
│  │  │                     │    │ [Social]┘                   │     ││
│  │  └─────────────────────┘    └─────────────────────────────┘     ││
│  └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │  langgraph.    │  │  langgraph.    │  │  rag_collections/      │  │
│  │  checkpoints   │  │  store         │  │  rag_document_chunks   │  │
│  └────────────────┘  └────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Shared Services Module

### 4.1 Module Definition

```typescript
// apps/langgraph/src/services/shared-services.module.ts
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

### 4.2 LLM HTTP Client Service (EXISTS - Minor Updates)

**File:** `apps/langgraph/src/services/llm-http-client.service.ts`

Already exists. Routes all LLM calls through Orchestrator AI API's `/llm/generate` endpoint. Provides:
- Usage tracking via `userId`
- Caller identification via `callerType: 'langgraph'` and `callerName`
- PII pseudonymization handled by API

**No changes needed** - already production-ready.

### 4.3 Webhook Status Service (EXISTS - Minor Updates)

**File:** `apps/langgraph/src/services/webhook-status.service.ts`

Already exists. Sends status webhooks for started/progress/completed/failed.

**Enhancement needed:** Add HITL status type:

```typescript
// Add to existing service
async sendHitlWaiting(
  webhookUrl: string,
  taskId: string,
  conversationId: string,
  userId: string,
  hitlRequest: {
    type: 'confirmation' | 'choice' | 'input' | 'approval';
    question: string;
    options?: string[];
    dataToReview?: Record<string, unknown>;
  },
): Promise<void> {
  await this.sendStatus(webhookUrl, {
    taskId,
    conversationId,
    userId,
    status: 'hitl_waiting',
    timestamp: new Date().toISOString(),
    message: 'Waiting for human input',
    data: hitlRequest,
  });
}
```

### 4.4 Observability Service (NEW)

**File:** `apps/langgraph/src/services/observability.service.ts`

Sends observability events to Orchestrator AI API's `/hooks` endpoint.

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
  private readonly apiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiPort = this.configService.get<string>('API_PORT');
    if (!apiPort) {
      throw new Error('API_PORT environment variable is required');
    }
    const apiHost = this.configService.get<string>('API_HOST') || 'localhost';
    this.apiUrl = `http://${apiHost}:${apiPort}`;
  }

  async sendEvent(event: ObservabilityEvent): Promise<void> {
    event.timestamp = event.timestamp || Date.now();

    try {
      await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/hooks`, event, {
          timeout: 2000,
          validateStatus: () => true,
        }),
      );
    } catch (error) {
      this.logger.warn(`Observability event failed (non-blocking): ${error.message}`);
    }
  }

  // Convenience methods
  async emitNodeStarted(params: {
    taskId: string;
    conversationId?: string;
    userId: string;
    agentSlug: string;
    nodeName: string;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: params.conversationId || params.taskId,
      hook_event_type: 'langgraph.node.started',
      taskId: params.taskId,
      conversationId: params.conversationId,
      userId: params.userId,
      agentSlug: params.agentSlug,
      payload: { nodeName: params.nodeName },
    });
  }

  async emitNodeCompleted(params: {
    taskId: string;
    conversationId?: string;
    userId: string;
    agentSlug: string;
    nodeName: string;
    durationMs?: number;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: params.conversationId || params.taskId,
      hook_event_type: 'langgraph.node.completed',
      taskId: params.taskId,
      conversationId: params.conversationId,
      userId: params.userId,
      agentSlug: params.agentSlug,
      payload: { nodeName: params.nodeName, durationMs: params.durationMs },
    });
  }

  async emitHitlRequested(params: {
    taskId: string;
    conversationId?: string;
    userId: string;
    agentSlug: string;
    hitlType: string;
    question: string;
    threadId: string;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: params.conversationId || params.taskId,
      hook_event_type: 'langgraph.hitl.requested',
      taskId: params.taskId,
      conversationId: params.conversationId,
      userId: params.userId,
      agentSlug: params.agentSlug,
      payload: {
        hitlType: params.hitlType,
        question: params.question,
        threadId: params.threadId,
      },
    });
  }

  async emitHitlResolved(params: {
    taskId: string;
    conversationId?: string;
    userId: string;
    agentSlug: string;
    decision: string;
    threadId: string;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: params.conversationId || params.taskId,
      hook_event_type: 'langgraph.hitl.resolved',
      taskId: params.taskId,
      conversationId: params.conversationId,
      userId: params.userId,
      agentSlug: params.agentSlug,
      payload: {
        decision: params.decision,
        threadId: params.threadId,
      },
    });
  }
}
```

### 4.5 HITL Service (NEW)

**File:** `apps/langgraph/src/services/hitl.service.ts`

Provides HITL functionality wrapping LangGraph's `interrupt()` function.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { interrupt, Command } from '@langchain/langgraph';
import { ObservabilityService } from './observability.service';
import { WebhookStatusService } from './webhook-status.service';

export interface HitlRequest {
  type: 'confirmation' | 'choice' | 'input' | 'approval';
  question: string;
  options?: string[];
  dataToReview?: Record<string, unknown>;
  timeout?: number;
}

export interface HitlResponse {
  decision: 'approve' | 'reject' | 'edit' | string;
  value?: string;
  editedData?: Record<string, unknown>;
  reason?: string;
}

export interface HitlContext {
  taskId: string;
  conversationId?: string;
  userId: string;
  agentSlug: string;
  threadId: string;
  statusWebhook?: string;
}

@Injectable()
export class HitlService {
  private readonly logger = new Logger(HitlService.name);

  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly webhookService: WebhookStatusService,
  ) {}

  /**
   * Request human input - pauses graph execution via interrupt()
   * Returns the human's response when graph is resumed
   */
  async requestHumanInput(
    request: HitlRequest,
    context: HitlContext,
  ): Promise<HitlResponse> {
    // Emit observability event
    await this.observabilityService.emitHitlRequested({
      taskId: context.taskId,
      conversationId: context.conversationId,
      userId: context.userId,
      agentSlug: context.agentSlug,
      hitlType: request.type,
      question: request.question,
      threadId: context.threadId,
    });

    // Send webhook status update
    if (context.statusWebhook) {
      await this.webhookService.sendHitlWaiting(
        context.statusWebhook,
        context.taskId,
        context.conversationId || context.taskId,
        context.userId,
        request,
      );
    }

    // Use LangGraph's interrupt() - this pauses execution
    // The response comes when graph.invoke() is called with Command({ resume: ... })
    const response = interrupt({
      type: request.type,
      question: request.question,
      options: request.options,
      dataToReview: request.dataToReview,
      timestamp: Date.now(),
      threadId: context.threadId,
      taskId: context.taskId,
    });

    return response as HitlResponse;
  }

  /**
   * Create a Command to route graph based on HITL response
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
        update: { ...stateUpdates, hitlStatus: 'approved' },
        goto: routes.approved,
      });
    } else if (response.decision === 'edit' && routes.edited) {
      return new Command({
        update: {
          ...stateUpdates,
          ...response.editedData,
          hitlStatus: 'edited',
        },
        goto: routes.edited,
      });
    } else {
      return new Command({
        update: {
          ...stateUpdates,
          hitlStatus: 'rejected',
          hitlRejectionReason: response.reason,
        },
        goto: routes.rejected,
      });
    }
  }
}
```

---

## 5. Persistence Module

### 5.1 Database Migration

**File:** `apps/api/supabase/migrations/YYYYMMDD_langgraph_persistence.sql`

```sql
-- LangGraph Persistence Schema
CREATE SCHEMA IF NOT EXISTS langgraph;

-- Checkpoints table (used by PostgresSaver)
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

-- Checkpoint writes table (pending writes during execution)
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

-- Long-term memory store (used by PostgresStore)
CREATE TABLE IF NOT EXISTS langgraph.store (
    namespace TEXT[] NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (namespace, key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_thread
ON langgraph.checkpoints(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_parent
ON langgraph.checkpoints(parent_checkpoint_id);

CREATE INDEX IF NOT EXISTS idx_lg_store_namespace
ON langgraph.store USING GIN(namespace);

-- Grant access to authenticated users (for Supabase)
GRANT USAGE ON SCHEMA langgraph TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA langgraph TO authenticated;
```

### 5.2 PostgresSaver Checkpointer Service

**File:** `apps/langgraph/src/persistence/postgres-checkpointer.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';

@Injectable()
export class PostgresCheckpointerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresCheckpointerService.name);
  private checkpointer: PostgresSaver;
  private pool: pg.Pool;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.logger.log('Initializing PostgresSaver checkpointer...');

    this.pool = new pg.Pool({
      connectionString,
      max: 10, // Connection pool size
    });

    this.checkpointer = new PostgresSaver(this.pool);

    // Create tables if they don't exist
    await this.checkpointer.setup();

    this.logger.log('PostgresSaver checkpointer initialized');
  }

  async onModuleDestroy() {
    this.logger.log('Closing PostgresSaver connection pool...');
    await this.pool.end();
  }

  getCheckpointer(): PostgresSaver {
    return this.checkpointer;
  }

  /**
   * Get checkpoint state for a thread (useful for checking interrupt status)
   */
  async getThreadState(threadId: string): Promise<{
    isInterrupted: boolean;
    interruptData?: Record<string, unknown>;
    currentState?: Record<string, unknown>;
  }> {
    const config = { configurable: { thread_id: threadId } };
    const tuple = await this.checkpointer.getTuple(config);

    if (!tuple) {
      return { isInterrupted: false };
    }

    // Check if there are pending tasks (indicates interrupt)
    const pendingWrites = tuple.pendingWrites || [];
    const isInterrupted = pendingWrites.length > 0;

    return {
      isInterrupted,
      interruptData: isInterrupted ? pendingWrites[0]?.value : undefined,
      currentState: tuple.checkpoint?.channel_values,
    };
  }

  /**
   * List recent threads (for debugging/admin)
   */
  async listThreads(limit: number = 20): Promise<string[]> {
    const result = await this.pool.query(`
      SELECT DISTINCT thread_id
      FROM langgraph.checkpoints
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => row.thread_id);
  }
}
```

### 5.3 PostgresStore Service

**File:** `apps/langgraph/src/persistence/postgres-store.service.ts`

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';

@Injectable()
export class PostgresStoreService implements OnModuleInit {
  private readonly logger = new Logger(PostgresStoreService.name);
  private store: PostgresStore;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.logger.log('Initializing PostgresStore for long-term memory...');

    this.store = PostgresStore.fromConnString(connectionString);
    await this.store.setup();

    this.logger.log('PostgresStore initialized');
  }

  getStore(): PostgresStore {
    return this.store;
  }

  /**
   * Save memory to store
   * Namespace example: ['org', 'demo-org', 'user', 'user-123', 'preferences']
   */
  async saveMemory(
    namespace: string[],
    key: string,
    value: Record<string, unknown>,
  ): Promise<void> {
    await this.store.put(namespace, key, value);
  }

  /**
   * Get memory from store
   */
  async getMemory(
    namespace: string[],
    key: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await this.store.get(namespace, key);
    return result?.value || null;
  }

  /**
   * Search memories in namespace
   */
  async searchMemories(
    namespace: string[],
    query?: string,
    limit: number = 10,
  ): Promise<Array<{ key: string; value: Record<string, unknown> }>> {
    const results = await this.store.search(namespace, { query, limit });
    return results.map(r => ({ key: r.key, value: r.value }));
  }

  /**
   * Delete memory
   */
  async deleteMemory(namespace: string[], key: string): Promise<void> {
    await this.store.delete(namespace, key);
  }
}
```

### 5.4 Persistence Module

**File:** `apps/langgraph/src/persistence/persistence.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PostgresCheckpointerService } from './postgres-checkpointer.service';
import { PostgresStoreService } from './postgres-store.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PostgresCheckpointerService, PostgresStoreService],
  exports: [PostgresCheckpointerService, PostgresStoreService],
})
export class PersistenceModule {}
```

---

## 6. Tools Module

### 6.1 RAG Tool

**File:** `apps/langgraph/src/tools/rag.tool.ts`

Wraps the Phase 6 RAG API for use in LangGraph agents.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export interface RagQueryResult {
  chunkId: string;
  documentId: string;
  documentFilename: string;
  content: string;
  score: number;
  pageNumber?: number;
}

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
   * Create LangChain tool for use with bindTools()
   */
  createLangChainTool() {
    return tool(
      async ({ collectionId, query, topK, similarityThreshold }) => {
        const results = await this.query({
          collectionId,
          query,
          topK,
          similarityThreshold,
        });
        return this.formatResultsAsContext(results);
      },
      {
        name: 'rag_query',
        description: 'Search a knowledge base collection to find relevant information for answering questions',
        schema: z.object({
          collectionId: z.string().describe('The ID of the RAG collection to search'),
          query: z.string().describe('The question or search query'),
          topK: z.number().optional().default(5).describe('Number of results to retrieve'),
          similarityThreshold: z.number().optional().default(0.7).describe('Minimum similarity score (0-1)'),
        }),
      },
    );
  }

  /**
   * Direct query method (for non-tool-calling usage)
   */
  async query(params: {
    collectionId: string;
    query: string;
    topK?: number;
    similarityThreshold?: number;
    strategy?: 'basic' | 'mmr';
  }): Promise<RagQueryResult[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/api/rag/collections/${params.collectionId}/query`,
          {
            query: params.query,
            topK: params.topK || 5,
            similarityThreshold: params.similarityThreshold || 0.7,
            strategy: params.strategy || 'basic',
          },
          { timeout: 10000 },
        ),
      );

      return response.data.results || [];
    } catch (error) {
      this.logger.error(`RAG query failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Format results as context string for LLM
   */
  formatResultsAsContext(results: RagQueryResult[]): string {
    if (results.length === 0) {
      return 'No relevant information found in the knowledge base.';
    }

    return results
      .map((r, i) => {
        const source = r.pageNumber
          ? `${r.documentFilename} (page ${r.pageNumber})`
          : r.documentFilename;
        return `[Source ${i + 1}: ${source}, Score: ${r.score.toFixed(2)}]\n${r.content}`;
      })
      .join('\n\n---\n\n');
  }
}
```

### 6.2 Tools Module

**File:** `apps/langgraph/src/tools/tools.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RagTool } from './rag.tool';

@Global()
@Module({
  imports: [HttpModule, ConfigModule],
  providers: [RagTool],
  exports: [RagTool],
})
export class ToolsModule {}
```

---

## 7. State Annotations

### 7.1 Base State Annotation

**File:** `apps/langgraph/src/state/base-state.annotation.ts`

```typescript
import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

/**
 * Base state annotation for all LangGraph workflows in Orchestrator AI
 * All agent-specific states should extend this
 */
export const BaseWorkflowAnnotation = Annotation.Root({
  // Message history (for conversational agents)
  ...MessagesAnnotation.spec,

  // Orchestrator AI context (required)
  taskId: Annotation<string>(),
  conversationId: Annotation<string | undefined>(),
  userId: Annotation<string>(),
  organizationSlug: Annotation<string>(),
  agentSlug: Annotation<string>(),

  // LLM configuration
  provider: Annotation<string>(),
  model: Annotation<string>(),

  // Status tracking
  statusWebhook: Annotation<string | undefined>(),
  currentStep: Annotation<string | undefined>(),
  totalSteps: Annotation<number | undefined>(),
  completedSteps: Annotation<number>({
    default: () => 0,
    reducer: (current, update) => update ?? current,
  }),

  // HITL tracking
  hitlStatus: Annotation<'none' | 'waiting' | 'approved' | 'rejected' | 'edited'>({
    default: () => 'none',
  }),
  hitlRejectionReason: Annotation<string | undefined>(),

  // Error tracking
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (current, update) => [...current, ...(update || [])],
  }),
});

export type BaseWorkflowState = typeof BaseWorkflowAnnotation.State;
```

---

## 8. HR Assistant Agent (RAG Agent)

### 8.1 State Annotation

**File:** `apps/langgraph/src/agents/hr-assistant/hr-assistant.annotation.ts`

```typescript
import { Annotation } from '@langchain/langgraph';
import { BaseWorkflowAnnotation } from '../../state/base-state.annotation';

export const HRAssistantAnnotation = Annotation.Root({
  ...BaseWorkflowAnnotation.spec,

  // Input
  employeeQuery: Annotation<string>(),

  // RAG configuration
  ragCollectionId: Annotation<string>(),

  // Processing
  queryCategory: Annotation<'policy' | 'benefits' | 'pto' | 'general' | undefined>(),
  ragContext: Annotation<string | undefined>(),
  ragSources: Annotation<Array<{ filename: string; page?: number }>>({
    default: () => [],
  }),

  // Output
  response: Annotation<string | undefined>(),
});

export type HRAssistantState = typeof HRAssistantAnnotation.State;
```

### 8.2 Graph Implementation

**File:** `apps/langgraph/src/agents/hr-assistant/hr-assistant.graph.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { WebhookStatusService } from '../../services/webhook-status.service';
import { ObservabilityService } from '../../services/observability.service';
import { RagTool } from '../../tools/rag.tool';
import { HRAssistantAnnotation, HRAssistantState } from './hr-assistant.annotation';

@Injectable()
export class HRAssistantGraph {
  private readonly logger = new Logger(HRAssistantGraph.name);
  private compiledGraph;

  constructor(
    private readonly checkpointerService: PostgresCheckpointerService,
    private readonly llmClient: LLMHttpClientService,
    private readonly webhookService: WebhookStatusService,
    private readonly observabilityService: ObservabilityService,
    private readonly ragTool: RagTool,
  ) {
    this.compiledGraph = this.buildGraph();
  }

  private buildGraph() {
    return new StateGraph(HRAssistantAnnotation)
      .addNode('categorize', this.categorizeQuery.bind(this))
      .addNode('retrieveContext', this.retrieveContext.bind(this))
      .addNode('generateResponse', this.generateResponse.bind(this))

      .addEdge(START, 'categorize')
      .addEdge('categorize', 'retrieveContext')
      .addEdge('retrieveContext', 'generateResponse')
      .addEdge('generateResponse', END)

      .compile({
        checkpointer: this.checkpointerService.getCheckpointer(),
      });
  }

  private async categorizeQuery(state: HRAssistantState): Promise<Partial<HRAssistantState>> {
    await this.observabilityService.emitNodeStarted({
      taskId: state.taskId,
      conversationId: state.conversationId,
      userId: state.userId,
      agentSlug: state.agentSlug,
      nodeName: 'categorize',
    });

    const startTime = Date.now();

    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are an HR query classifier. Categorize the employee's question into one of these categories:
- policy: Company policies, rules, procedures
- benefits: Health insurance, 401k, perks
- pto: Vacation, sick leave, time off
- general: Other HR questions

Respond with just the category name, nothing else.`,
      userMessage: state.employeeQuery,
      callerName: 'hr-assistant-categorize',
      userId: state.userId,
    });

    const category = result.text.toLowerCase().trim() as HRAssistantState['queryCategory'];

    await this.observabilityService.emitNodeCompleted({
      taskId: state.taskId,
      conversationId: state.conversationId,
      userId: state.userId,
      agentSlug: state.agentSlug,
      nodeName: 'categorize',
      durationMs: Date.now() - startTime,
    });

    // Update progress
    if (state.statusWebhook) {
      await this.webhookService.sendProgress(
        state.statusWebhook,
        state.taskId,
        state.conversationId || state.taskId,
        state.userId,
        'Categorizing query',
        1,
        3,
      );
    }

    return {
      queryCategory: category,
      completedSteps: 1,
      currentStep: 'categorize',
    };
  }

  private async retrieveContext(state: HRAssistantState): Promise<Partial<HRAssistantState>> {
    await this.observabilityService.emitNodeStarted({
      taskId: state.taskId,
      conversationId: state.conversationId,
      userId: state.userId,
      agentSlug: state.agentSlug,
      nodeName: 'retrieveContext',
    });

    const startTime = Date.now();

    // Query RAG collection
    const results = await this.ragTool.query({
      collectionId: state.ragCollectionId,
      query: state.employeeQuery,
      topK: 5,
      similarityThreshold: 0.6,
    });

    const ragContext = this.ragTool.formatResultsAsContext(results);
    const ragSources = results.map(r => ({
      filename: r.documentFilename,
      page: r.pageNumber,
    }));

    await this.observabilityService.emitNodeCompleted({
      taskId: state.taskId,
      conversationId: state.conversationId,
      userId: state.userId,
      agentSlug: state.agentSlug,
      nodeName: 'retrieveContext',
      durationMs: Date.now() - startTime,
    });

    // Update progress
    if (state.statusWebhook) {
      await this.webhookService.sendProgress(
        state.statusWebhook,
        state.taskId,
        state.conversationId || state.taskId,
        state.userId,
        'Retrieving relevant information',
        2,
        3,
      );
    }

    return {
      ragContext,
      ragSources,
      completedSteps: 2,
      currentStep: 'retrieveContext',
    };
  }

  private async generateResponse(state: HRAssistantState): Promise<Partial<HRAssistantState>> {
    await this.observabilityService.emitNodeStarted({
      taskId: state.taskId,
      conversationId: state.conversationId,
      userId: state.userId,
      agentSlug: state.agentSlug,
      nodeName: 'generateResponse',
    });

    const startTime = Date.now();

    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are a helpful HR Assistant for ${state.organizationSlug}.
Answer the employee's question using ONLY the provided context from the company knowledge base.

Context from knowledge base:
${state.ragContext}

Guidelines:
- Be friendly and professional
- If the context doesn't contain relevant information, say so honestly
- Reference specific policies or documents when applicable
- If the question requires human HR involvement, suggest they contact HR directly`,
      userMessage: state.employeeQuery,
      callerName: 'hr-assistant-generate',
      userId: state.userId,
    });

    await this.observabilityService.emitNodeCompleted({
      taskId: state.taskId,
      conversationId: state.conversationId,
      userId: state.userId,
      agentSlug: state.agentSlug,
      nodeName: 'generateResponse',
      durationMs: Date.now() - startTime,
    });

    // Update progress
    if (state.statusWebhook) {
      await this.webhookService.sendProgress(
        state.statusWebhook,
        state.taskId,
        state.conversationId || state.taskId,
        state.userId,
        'Generating response',
        3,
        3,
      );
    }

    return {
      response: result.text,
      completedSteps: 3,
      currentStep: 'generateResponse',
    };
  }

  // Public execution methods
  async execute(
    input: Partial<HRAssistantState>,
    threadId: string,
  ): Promise<HRAssistantState> {
    const config = { configurable: { thread_id: threadId } };

    // Send start webhook
    if (input.statusWebhook) {
      await this.webhookService.sendStarted(
        input.statusWebhook,
        input.taskId!,
        input.conversationId || input.taskId!,
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
          input.conversationId || input.taskId!,
          input.userId!,
          {
            response: result.response,
            category: result.queryCategory,
            sources: result.ragSources,
          },
        );
      }

      return result;
    } catch (error) {
      if (input.statusWebhook) {
        await this.webhookService.sendFailed(
          input.statusWebhook,
          input.taskId!,
          input.conversationId || input.taskId!,
          input.userId!,
          error.message,
        );
      }
      throw error;
    }
  }
}
```

### 8.3 Service & Controller

**File:** `apps/langgraph/src/agents/hr-assistant/hr-assistant.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { HRAssistantGraph } from './hr-assistant.graph';
import { HRAssistantRequestDto } from './dto/hr-assistant-request.dto';

@Injectable()
export class HRAssistantService {
  constructor(private readonly graph: HRAssistantGraph) {}

  async execute(request: HRAssistantRequestDto) {
    const threadId = request.taskId;
    return this.graph.execute(
      {
        employeeQuery: request.prompt,
        ragCollectionId: request.ragCollectionId,
        taskId: request.taskId,
        conversationId: request.conversationId,
        userId: request.userId,
        organizationSlug: request.organizationSlug,
        agentSlug: 'hr-assistant',
        provider: request.provider,
        model: request.model,
        statusWebhook: request.statusWebhook,
      },
      threadId,
    );
  }
}
```

**File:** `apps/langgraph/src/agents/hr-assistant/hr-assistant.controller.ts`

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { HRAssistantService } from './hr-assistant.service';
import { HRAssistantRequestDto } from './dto/hr-assistant-request.dto';

@Controller('workflows/hr-assistant')
export class HRAssistantController {
  constructor(private readonly service: HRAssistantService) {}

  @Post('execute')
  async execute(@Body() request: HRAssistantRequestDto) {
    return this.service.execute(request);
  }
}
```

### 8.4 DTO

**File:** `apps/langgraph/src/agents/hr-assistant/dto/hr-assistant-request.dto.ts`

```typescript
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class HRAssistantRequestDto {
  @IsString()
  prompt: string;

  @IsUUID()
  ragCollectionId: string;

  @IsUUID()
  taskId: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsUUID()
  userId: string;

  @IsString()
  organizationSlug: string;

  @IsString()
  provider: string;

  @IsString()
  model: string;

  @IsOptional()
  @IsString()
  statusWebhook?: string;
}
```

### 8.5 Module

**File:** `apps/langgraph/src/agents/hr-assistant/hr-assistant.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { HRAssistantController } from './hr-assistant.controller';
import { HRAssistantService } from './hr-assistant.service';
import { HRAssistantGraph } from './hr-assistant.graph';

@Module({
  controllers: [HRAssistantController],
  providers: [HRAssistantService, HRAssistantGraph],
  exports: [HRAssistantService],
})
export class HRAssistantModule {}
```

---

## 9. Marketing Swarm Agent (HITL Agent)

### 9.1 State Annotation

**File:** `apps/langgraph/src/agents/marketing-swarm/marketing-swarm.annotation.ts`

```typescript
import { Annotation } from '@langchain/langgraph';
import { BaseWorkflowAnnotation } from '../../state/base-state.annotation';

export const MarketingSwarmAnnotation = Annotation.Root({
  ...BaseWorkflowAnnotation.spec,

  // Input
  announcement: Annotation<string>(),

  // Generated content
  webPost: Annotation<string | undefined>(),
  seoContent: Annotation<string | undefined>(),
  socialMedia: Annotation<string | undefined>(),

  // HITL approval tracking
  contentApproved: Annotation<boolean>({ default: () => false }),
  editedContent: Annotation<Record<string, string> | undefined>(),

  // Final result
  result: Annotation<Record<string, string> | undefined>(),
});

export type MarketingSwarmState = typeof MarketingSwarmAnnotation.State;
```

### 9.2 Graph Implementation

**File:** `apps/langgraph/src/agents/marketing-swarm/marketing-swarm.graph.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { WebhookStatusService } from '../../services/webhook-status.service';
import { ObservabilityService } from '../../services/observability.service';
import { HitlService } from '../../services/hitl.service';
import { MarketingSwarmAnnotation, MarketingSwarmState } from './marketing-swarm.annotation';
import { Command } from '@langchain/langgraph';

@Injectable()
export class MarketingSwarmGraph {
  private readonly logger = new Logger(MarketingSwarmGraph.name);
  private compiledGraph;

  constructor(
    private readonly checkpointerService: PostgresCheckpointerService,
    private readonly llmClient: LLMHttpClientService,
    private readonly webhookService: WebhookStatusService,
    private readonly observabilityService: ObservabilityService,
    private readonly hitlService: HitlService,
  ) {
    this.compiledGraph = this.buildGraph();
  }

  private buildGraph() {
    return new StateGraph(MarketingSwarmAnnotation)
      // Content generation nodes
      .addNode('generateWebPost', this.generateWebPost.bind(this))
      .addNode('generateSEO', this.generateSEO.bind(this))
      .addNode('generateSocial', this.generateSocial.bind(this))

      // HITL approval node
      .addNode('humanApproval', this.requestHumanApproval.bind(this))

      // Finalization
      .addNode('finalize', this.finalizeContent.bind(this))
      .addNode('rejected', this.handleRejection.bind(this))

      // Flow: Generate all content, then get approval
      .addEdge(START, 'generateWebPost')
      .addEdge('generateWebPost', 'generateSEO')
      .addEdge('generateSEO', 'generateSocial')
      .addEdge('generateSocial', 'humanApproval')

      // Conditional routing after HITL
      .addConditionalEdges('humanApproval', this.routeAfterApproval.bind(this), {
        approved: 'finalize',
        edited: 'finalize',
        rejected: 'rejected',
      })

      .addEdge('finalize', END)
      .addEdge('rejected', END)

      .compile({
        checkpointer: this.checkpointerService.getCheckpointer(),
      });
  }

  private async generateWebPost(state: MarketingSwarmState): Promise<Partial<MarketingSwarmState>> {
    await this.emitNodeEvent(state, 'generateWebPost', 'started');
    const startTime = Date.now();

    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are a brilliant blog post writer who specializes in being both entertaining and informative. Write a blog post about the following announcement. Include a compelling title, introduction, body, and conclusion.`,
      userMessage: state.announcement,
      callerName: 'marketing-swarm-webpost',
      userId: state.userId,
    });

    await this.updateProgress(state, 'Generating blog post', 1, 5);
    await this.emitNodeEvent(state, 'generateWebPost', 'completed', Date.now() - startTime);

    return {
      webPost: result.text,
      completedSteps: 1,
      currentStep: 'generateWebPost',
    };
  }

  private async generateSEO(state: MarketingSwarmState): Promise<Partial<MarketingSwarmState>> {
    await this.emitNodeEvent(state, 'generateSEO', 'started');
    const startTime = Date.now();

    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are an expert SEO specialist. Generate comprehensive SEO content including:
- Meta title (60 chars max)
- Meta description (155 chars max)
- 5-10 relevant keywords
- H1 heading suggestion
- JSON-LD structured data`,
      userMessage: state.announcement,
      callerName: 'marketing-swarm-seo',
      userId: state.userId,
    });

    await this.updateProgress(state, 'Creating SEO content', 2, 5);
    await this.emitNodeEvent(state, 'generateSEO', 'completed', Date.now() - startTime);

    return {
      seoContent: result.text,
      completedSteps: 2,
      currentStep: 'generateSEO',
    };
  }

  private async generateSocial(state: MarketingSwarmState): Promise<Partial<MarketingSwarmState>> {
    await this.emitNodeEvent(state, 'generateSocial', 'started');
    const startTime = Date.now();

    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are a social media content strategist. Create engaging posts for multiple platforms:
- Twitter/X (280 chars with relevant hashtags)
- LinkedIn (professional tone, 1300 chars max)
- Facebook (conversational, 500 chars)`,
      userMessage: state.announcement,
      callerName: 'marketing-swarm-social',
      userId: state.userId,
    });

    await this.updateProgress(state, 'Creating social media posts', 3, 5);
    await this.emitNodeEvent(state, 'generateSocial', 'completed', Date.now() - startTime);

    return {
      socialMedia: result.text,
      completedSteps: 3,
      currentStep: 'generateSocial',
    };
  }

  private async requestHumanApproval(state: MarketingSwarmState): Promise<Command> {
    await this.emitNodeEvent(state, 'humanApproval', 'started');

    // Request human approval using HITL service
    const response = await this.hitlService.requestHumanInput(
      {
        type: 'approval',
        question: 'Please review the generated marketing content. You can approve, edit, or reject.',
        dataToReview: {
          webPost: state.webPost,
          seoContent: state.seoContent,
          socialMedia: state.socialMedia,
        },
        options: ['approve', 'edit', 'reject'],
      },
      {
        taskId: state.taskId,
        conversationId: state.conversationId,
        userId: state.userId,
        agentSlug: state.agentSlug,
        threadId: state.taskId, // Use taskId as threadId
        statusWebhook: state.statusWebhook,
      },
    );

    // Route based on response
    return this.hitlService.createRouteCommand(
      response,
      {
        approved: 'approved',
        rejected: 'rejected',
        edited: 'edited',
      },
      response.editedData ? { editedContent: response.editedData } : undefined,
    );
  }

  private routeAfterApproval(state: MarketingSwarmState): string {
    return state.hitlStatus || 'approved';
  }

  private async finalizeContent(state: MarketingSwarmState): Promise<Partial<MarketingSwarmState>> {
    await this.emitNodeEvent(state, 'finalize', 'started');
    const startTime = Date.now();

    // Use edited content if available, otherwise use generated content
    const finalContent = state.editedContent || {
      webPost: state.webPost!,
      seoContent: state.seoContent!,
      socialMedia: state.socialMedia!,
    };

    await this.updateProgress(state, 'Finalizing content', 5, 5);
    await this.emitNodeEvent(state, 'finalize', 'completed', Date.now() - startTime);

    return {
      result: finalContent,
      contentApproved: true,
      completedSteps: 5,
      currentStep: 'finalize',
    };
  }

  private async handleRejection(state: MarketingSwarmState): Promise<Partial<MarketingSwarmState>> {
    return {
      contentApproved: false,
      completedSteps: 5,
      currentStep: 'rejected',
      errors: [...state.errors, `Content rejected: ${state.hitlRejectionReason || 'No reason provided'}`],
    };
  }

  // Helper methods
  private async emitNodeEvent(
    state: MarketingSwarmState,
    nodeName: string,
    event: 'started' | 'completed',
    durationMs?: number,
  ) {
    const method = event === 'started' ? 'emitNodeStarted' : 'emitNodeCompleted';
    await this.observabilityService[method]({
      taskId: state.taskId,
      conversationId: state.conversationId,
      userId: state.userId,
      agentSlug: state.agentSlug,
      nodeName,
      ...(durationMs !== undefined && { durationMs }),
    });
  }

  private async updateProgress(
    state: MarketingSwarmState,
    step: string,
    sequence: number,
    total: number,
  ) {
    if (state.statusWebhook) {
      await this.webhookService.sendProgress(
        state.statusWebhook,
        state.taskId,
        state.conversationId || state.taskId,
        state.userId,
        step,
        sequence,
        total,
      );
    }
  }

  // Public execution methods
  async execute(
    input: Partial<MarketingSwarmState>,
    threadId: string,
  ): Promise<MarketingSwarmState> {
    const config = { configurable: { thread_id: threadId } };

    if (input.statusWebhook) {
      await this.webhookService.sendStarted(
        input.statusWebhook,
        input.taskId!,
        input.conversationId || input.taskId!,
        input.userId!,
        5,
      );
    }

    try {
      const result = await this.compiledGraph.invoke(
        { ...input, totalSteps: 5 },
        config,
      );

      // If we hit HITL interrupt, graph will pause here
      // Check if we're in interrupted state
      const threadState = await this.checkpointerService.getThreadState(threadId);
      if (threadState.isInterrupted) {
        // Return partial result indicating we're waiting for human input
        return {
          ...result,
          hitlStatus: 'waiting',
        } as MarketingSwarmState;
      }

      if (input.statusWebhook && result.contentApproved) {
        await this.webhookService.sendCompleted(
          input.statusWebhook,
          input.taskId!,
          input.conversationId || input.taskId!,
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
          input.conversationId || input.taskId!,
          input.userId!,
          error.message,
        );
      }
      throw error;
    }
  }

  async resume(
    threadId: string,
    humanResponse: { decision: string; editedData?: Record<string, string>; reason?: string },
  ): Promise<MarketingSwarmState> {
    const config = { configurable: { thread_id: threadId } };

    // Get current state to access statusWebhook
    const threadState = await this.checkpointerService.getThreadState(threadId);

    // Resume with human response
    const result = await this.compiledGraph.invoke(
      new Command({ resume: humanResponse }),
      config,
    );

    return result;
  }

  async getInterruptState(threadId: string) {
    return this.checkpointerService.getThreadState(threadId);
  }
}
```

### 9.3 Service, Controller, Module

Similar structure to HR Assistant - service wraps graph, controller exposes endpoints including `/resume` for HITL.

---

## 10. HITL Front-End Components

### 10.1 Interrupt Status Banner

**Component:** `components/agents/HitlStatusBanner.vue`

Displays when an agent is waiting for human input:

```vue
<template>
  <ion-card v-if="isWaiting" color="warning">
    <ion-card-header>
      <ion-card-title>
        <ion-icon :icon="handLeftOutline" /> Action Required
      </ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <p>{{ hitlRequest?.question }}</p>
      <div class="button-row">
        <ion-button @click="openApprovalModal">Review & Respond</ion-button>
      </div>
    </ion-card-content>
  </ion-card>
</template>
```

### 10.2 Approval Modal

**Component:** `components/agents/HitlApprovalModal.vue`

Full-screen modal for reviewing content and making decisions:

```vue
<template>
  <ion-modal :is-open="isOpen" @didDismiss="close">
    <ion-header>
      <ion-toolbar>
        <ion-title>Review Content</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="close">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <!-- Content preview with edit capability -->
      <div v-for="(content, key) in dataToReview" :key="key">
        <h3>{{ formatKey(key) }}</h3>
        <ion-textarea
          v-model="editableContent[key]"
          :readonly="!isEditing"
          auto-grow
        />
      </div>
    </ion-content>
    <ion-footer>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button color="danger" @click="reject">
            <ion-icon :icon="closeOutline" /> Reject
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button @click="toggleEdit">
            <ion-icon :icon="createOutline" /> Edit
          </ion-button>
          <ion-button color="success" @click="approve">
            <ion-icon :icon="checkmarkOutline" /> Approve
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-modal>
</template>
```

### 10.3 Agent Store Updates

**Update:** `stores/agents.store.ts`

Add HITL state tracking:

```typescript
interface AgentState {
  // ... existing fields

  // HITL tracking
  hitlTasks: Map<string, HitlTaskInfo>;
}

interface HitlTaskInfo {
  taskId: string;
  threadId: string;
  agentSlug: string;
  status: 'waiting' | 'resolved';
  request: {
    type: string;
    question: string;
    options?: string[];
    dataToReview?: Record<string, unknown>;
  };
  createdAt: Date;
}

// Actions
async function resumeHitlTask(
  threadId: string,
  response: { decision: string; editedData?: Record<string, unknown>; reason?: string }
): Promise<void>;

async function checkHitlStatus(taskId: string): Promise<HitlTaskInfo | null>;
```

---

## 11. Database Updates for HITL Tracking

### 11.1 Agent Tasks Table Update

Add HITL columns to existing `agent_tasks` table:

```sql
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS hitl_status VARCHAR(50);
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS hitl_request JSONB;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS hitl_response JSONB;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS hitl_requested_at TIMESTAMPTZ;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS hitl_resolved_at TIMESTAMPTZ;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_hitl ON agent_tasks(hitl_status)
WHERE hitl_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_thread ON agent_tasks(thread_id)
WHERE thread_id IS NOT NULL;
```

---

## 12. Agent Registration in Database

### 12.1 HR Assistant Agent Seed

```sql
INSERT INTO agents (
  slug, display_name, description, agent_type, status,
  department, capabilities, llm_config
) VALUES (
  'hr-assistant',
  'HR Assistant',
  'Answers employee questions using company HR knowledge base. Powered by RAG retrieval.',
  'langgraph',
  'active',
  'hr',
  '["rag", "knowledge-base", "policy-questions"]',
  '{"defaultProvider": "anthropic", "defaultModel": "claude-sonnet-4-20250514"}'
);
```

### 12.2 Marketing Swarm Agent Seed

```sql
INSERT INTO agents (
  slug, display_name, description, agent_type, status,
  department, capabilities, llm_config
) VALUES (
  'marketing-swarm',
  'Marketing Swarm',
  'Generates blog posts, SEO content, and social media posts from announcements. Includes human approval workflow.',
  'langgraph',
  'active',
  'marketing',
  '["content-generation", "seo", "social-media", "hitl"]',
  '{"defaultProvider": "anthropic", "defaultModel": "claude-sonnet-4-20250514"}'
);
```

---

## 13. Implementation Plan

### Phase 7a: Shared Services & Persistence (3-4 days)

- [ ] Create ObservabilityService
- [ ] Update WebhookStatusService with HITL status
- [ ] Create HitlService
- [ ] Create SharedServicesModule
- [ ] Create database migration for langgraph schema
- [ ] Create PostgresCheckpointerService
- [ ] Create PostgresStoreService
- [ ] Create PersistenceModule
- [ ] Create base state annotation
- [ ] Update app.module.ts to import new modules
- [ ] Test checkpointing with simple graph

### Phase 7b: Tools Module & RAG Integration (2 days)

- [ ] Create RagTool wrapping Phase 6 RAG API
- [ ] Create ToolsModule
- [ ] Test RAG tool with mock collection
- [ ] Integration test: RAG tool → RAG API → Supabase

### Phase 7c: HR Assistant Agent (3 days)

- [ ] Create HR Assistant state annotation
- [ ] Create HR Assistant graph
- [ ] Create HR Assistant service, controller, module
- [ ] Create HR Assistant DTO
- [ ] Register HR Assistant in database
- [ ] Create/configure test RAG collection with HR docs
- [ ] End-to-end test: Query → RAG → Response
- [ ] Test observability events flowing

### Phase 7d: HITL Infrastructure (3 days)

- [ ] Update agent_tasks table for HITL tracking
- [ ] Create HITL API endpoints in Orchestrator AI API
- [ ] Create HitlStatusBanner component
- [ ] Create HitlApprovalModal component
- [ ] Update agent store with HITL tracking
- [ ] Test interrupt/resume flow manually

### Phase 7e: Marketing Swarm Agent (3 days)

- [ ] Create Marketing Swarm state annotation
- [ ] Create Marketing Swarm graph with HITL node
- [ ] Create Marketing Swarm service, controller, module
- [ ] Register Marketing Swarm in database
- [ ] End-to-end test: Generate → Interrupt → Approve → Complete
- [ ] End-to-end test: Generate → Interrupt → Edit → Complete
- [ ] End-to-end test: Generate → Interrupt → Reject → End

### Phase 7f: Polish & Documentation (2 days)

- [ ] Error handling review
- [ ] Loading states in UI
- [ ] Toast notifications for HITL actions
- [ ] Agent selection UI updates
- [ ] Documentation for agent developers
- [ ] Claude Code patterns documentation

---

## 14. Testing Strategy

### 14.1 Unit Tests

- State annotation reducers
- HITL command routing
- RAG tool result formatting
- Webhook payload construction

### 14.2 Integration Tests

- Full HR Assistant flow (categorize → RAG → generate)
- Full Marketing Swarm flow (generate → HITL → finalize)
- Checkpoint save/restore
- HITL interrupt/resume cycle

### 14.3 E2E Tests

- Front-end: Select agent → Send message → See response
- Front-end: HITL banner appears → Open modal → Approve
- Front-end: HITL banner appears → Open modal → Edit → Approve

---

## 15. Dependencies

### 15.1 NPM Packages (apps/langgraph)

```json
{
  "dependencies": {
    "@langchain/langgraph": "^0.2.x",
    "@langchain/langgraph-checkpoint-postgres": "^0.1.x",
    "@langchain/core": "^0.3.x",
    "pg": "^8.x",
    "zod": "^3.x"
  }
}
```

### 15.2 Prerequisites

- Phase 6 RAG Infrastructure complete
- Supabase running with pgvector
- Orchestrator AI API running

---

## 16. Success Criteria

### HR Assistant
- [ ] Queries RAG collection successfully
- [ ] Returns contextual answers with source references
- [ ] Observability events visible in hooks endpoint
- [ ] Works through Orchestrator AI UI

### Marketing Swarm
- [ ] Generates all three content types
- [ ] Pauses at HITL approval step
- [ ] HITL banner appears in UI
- [ ] Approval modal shows generated content
- [ ] Approve/Edit/Reject all work correctly
- [ ] Resume completes the workflow

### Infrastructure
- [ ] Checkpoints persisted in Supabase
- [ ] Thread state queryable
- [ ] All LLM calls through Orchestrator AI API
- [ ] Observability events flowing
- [ ] Status webhooks working

---

## 17. Future Enhancements

1. **Streaming**: Real-time token streaming in UI
2. **Time Travel**: Replay from previous checkpoints
3. **Multi-turn HITL**: Multiple approval points in one workflow
4. **HITL Timeout**: Auto-reject after configurable timeout
5. **HITL Delegation**: Route approval to specific users
6. **Long-term Memory**: Use PostgresStore for user preferences
