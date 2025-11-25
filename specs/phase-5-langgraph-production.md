# Phase 5: LangGraph Production Architecture

## Document Information
- **Version**: 2.0
- **Status**: Draft
- **Author**: Claude Code
- **Date**: 2025-11-25
- **Combines**: Original Phase 5 + Phase 7 PRD
- **Dependencies**: Supabase, existing LangGraph app structure

---

## 1. Executive Summary

This phase transforms Orchestrator AI's LangGraph implementation from manual sequential execution into a **production-ready system** with proper StateGraph, checkpointing, HITL workflows, and tool-calling patterns.

### Key Deliverables
1. **Shared Services Module** - LLM client, Observability, HITL helper services
2. **Persistence Module** - PostgresSaver checkpointing
3. **LLM Usage Reporting** - New `/llm/usage` endpoint for tool usage tracking
4. **State Annotations** - Type-safe state management with Zod validation
5. **LangGraph Tools** - SQL tools with specialized model support (Ollama/cloud)
6. **Demo Agent: Data Analyst** - Tool-calling pattern with SQL execution
7. **Demo Agent: Extended Post Writer** - HITL approval pattern
8. **HITL Infrastructure** - Front-end components for human approval

### Success Criteria
- Both demo agents fully functional through Orchestrator AI UI
- Data Analyst demonstrates LangGraph tool-calling with specialized models
- Extended Post Writer demonstrates interrupt/resume HITL workflow
- All graphs use PostgresSaver for durable checkpointing
- All LLM usage (including tool calls) tracked in `llm_usage` table

---

## 2. Current State Analysis

### What Exists (`apps/langgraph/`)
| Component | Status | Issue |
|-----------|--------|-------|
| LLMHttpClientService | Works | None - keep for traditional LLM calls |
| WebhookStatusService | Deprecated | Replace with ObservabilityService |
| marketing-swarm.graph.ts | Not a StateGraph | Manual sequential execution |
| Package dependencies | Missing | No checkpoint-postgres, no pg, no zod |

### What's Missing
- Proper `StateGraph` with `Annotation`
- PostgresSaver checkpointing
- `interrupt()` / `Command` for HITL
- LangGraph tools with specialized models
- Usage tracking for tool LLM calls
- Zod validation for state

---

## 3. Architecture Overview

### 3.1 LLM Call Architecture

**Two patterns for LLM calls:**

| Call Type | Route | Model Selection | Usage Tracking |
|-----------|-------|-----------------|----------------|
| Traditional (generation, summarization) | `POST /llm/generate` | User's choice (request params) | Automatic |
| Tool-internal (specialized tasks) | Direct to Ollama/provider | Tool's choice (specialized) | Via `POST /llm/usage` |

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator AI API                          │
│                                                                 │
│  POST /llm/generate          POST /llm/usage (NEW)             │
│  ┌─────────────────────┐     ┌─────────────────────┐           │
│  │ Full LLM call       │     │ Usage record only   │           │
│  │ + usage tracking    │     │ (no LLM call)       │           │
│  │ + PII handling      │     │                     │           │
│  └─────────────────────┘     └─────────────────────┘           │
│           │                           ▲                         │
│           └───────────┬───────────────┘                         │
│                       ▼                                         │
│               ┌──────────────┐                                  │
│               │  llm_usage   │                                  │
│               │  table       │                                  │
│               └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │                                    │
    Traditional                          Tool usage
    LLM calls                            reporting
         │                                    │
┌────────┴────────┐                ┌──────────┴──────────┐
│   LangGraph     │                │   LangGraph Tools   │
│   Agents        │                │   (SqlQueryTool,    │
│   (content gen, │                │    etc.)            │
│    summarize)   │                │                     │
│                 │                │   Direct call to    │
│   Uses          │                │   Ollama/SQLCoder   │
│   LLMHttpClient │                │   + report usage    │
└─────────────────┘                └─────────────────────┘
```

### 3.2 Module Structure

```
apps/langgraph/src/
├── services/                        # SHARED SERVICES MODULE
│   ├── shared-services.module.ts
│   ├── index.ts                     # Barrel export for cleaner imports
│   ├── llm-http-client.service.ts   # EXISTS - Traditional LLM calls via API
│   ├── llm-usage-reporter.service.ts # NEW - Report tool LLM usage
│   ├── observability.service.ts     # NEW - Event streaming to /hooks
│   └── hitl-helper.service.ts       # NEW - HITL utilities (no interrupt() call)
│
├── persistence/                     # PERSISTENCE MODULE
│   ├── persistence.module.ts
│   ├── index.ts                     # Barrel export
│   └── postgres-checkpointer.service.ts
│
├── state/                           # STATE ANNOTATIONS
│   ├── index.ts                     # Barrel export
│   └── base-state.annotation.ts
│
├── tools/                           # LANGGRAPH TOOLS (specialized models)
│   ├── tools.module.ts
│   ├── index.ts                     # Barrel export
│   ├── sql-query.tool.ts            # Ollama/SQLCoder for SQL generation
│   ├── list-tables.tool.ts          # Schema introspection
│   └── describe-table.tool.ts       # Table structure
│
├── agents/                          # AGENT FEATURE MODULES
│   ├── data-analyst/                # Tool-calling pattern demo
│   │   ├── data-analyst.module.ts
│   │   ├── data-analyst.controller.ts
│   │   ├── data-analyst.service.ts
│   │   ├── data-analyst.graph.ts
│   │   ├── data-analyst.state.ts
│   │   └── dto/
│   │       ├── index.ts
│   │       └── data-analyst-request.dto.ts
│   │
│   └── extended-post-writer/        # HITL pattern demo
│       ├── extended-post-writer.module.ts
│       ├── extended-post-writer.controller.ts
│       ├── extended-post-writer.service.ts
│       ├── extended-post-writer.graph.ts
│       ├── extended-post-writer.state.ts
│       └── dto/
│           ├── index.ts
│           ├── extended-post-writer-request.dto.ts
│           └── extended-post-writer-resume.dto.ts
│
└── app.module.ts                    # Updated imports
```

### 3.3 Data Flow

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
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Agent Execution Engine → Routes to LangGraph                   │ │
│  │  /hooks endpoint ← Receives observability events                │ │
│  │  /llm/generate ← Traditional LLM calls                          │ │
│  │  /llm/usage ← Tool usage reporting (NEW)                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    LangGraph App (apps/langgraph)                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Shared Services Module                       │ │
│  │  LLMHttpClient | LLMUsageReporter | Observability | HitlHelper  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Persistence Module: PostgresSaver (checkpoints)                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Tools Module: SqlQueryTool (Ollama/SQLCoder)                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Agent Feature Modules                        │ │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────┐   │ │
│  │  │   Data Analyst          │  │   Extended Post Writer      │   │ │
│  │  │   (Tool-Calling)        │  │   (HITL Pattern)            │   │ │
│  │  │                         │  │                             │   │ │
│  │  │ [Agent]─┬─►[Tools]      │  │ [Blog]──┐                   │   │ │
│  │  │         └──►[Agent]     │  │ [SEO]───┼►[HITL]──►[Done]   │   │ │
│  │  │              └──►[END]  │  │ [Social]┘                   │   │ │
│  │  └─────────────────────────┘  └─────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                             │
│  ┌────────────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  langgraph.        │  │  llm_usage   │  │  public.*           │   │
│  │  checkpoints       │  │  (tracking)  │  │  (queryable data)   │   │
│  └────────────────────┘  └──────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. New API Endpoint: `/llm/usage`

### 4.1 Purpose

LangGraph tools use specialized models (Ollama/SQLCoder, etc.) directly, bypassing `/llm/generate`. This endpoint allows them to **report usage** so all LLM activity is tracked consistently.

> **Note:** The existing `LlmUsageController` at `/api/llm-usage` handles **reading** usage data.
> This new endpoint at `/llm/usage` handles **writing/recording** usage from external callers.

### 4.2 Endpoint Specification

**File:** `apps/api/src/llms/llm.controller.ts` (add POST method to existing controller)

```typescript
@Post('usage')
async recordUsage(@Body() dto: RecordLlmUsageDto) {
  return this.llmService.recordUsage(dto);
}
```

**File:** `apps/api/src/llms/dto/record-llm-usage.dto.ts`

```typescript
import { IsString, IsNumber, IsOptional, IsUUID, IsIn } from 'class-validator';

export class RecordLlmUsageDto {
  @IsUUID()
  userId: string;

  @IsString()
  provider: string; // 'ollama', 'anthropic', 'openai', etc.

  @IsString()
  model: string; // 'sqlcoder:7b', 'claude-sonnet-4-20250514', etc.

  @IsIn(['langgraph-tool', 'langgraph-agent', 'n8n', 'external'])
  callerType: string;

  @IsString()
  callerName: string; // 'sql-query-tool', 'data-analyst-summarize', etc.

  @IsNumber()
  promptTokens: number;

  @IsNumber()
  completionTokens: number;

  @IsNumber()
  latencyMs: number;

  @IsIn(['completed', 'failed'])
  status: 'completed' | 'failed';

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  organizationSlug?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
```

**File:** `apps/api/src/llms/llm.service.ts` (add method)

```typescript
async recordUsage(dto: RecordLlmUsageDto): Promise<{ id: string }> {
  // Use existing LLM usage recording logic
  const usage = await this.llmUsageRepository.create({
    userId: dto.userId,
    provider: dto.provider,
    model: dto.model,
    callerType: dto.callerType,
    callerName: dto.callerName,
    promptTokens: dto.promptTokens,
    completionTokens: dto.completionTokens,
    totalTokens: dto.promptTokens + dto.completionTokens,
    latencyMs: dto.latencyMs,
    status: dto.status,
    errorMessage: dto.errorMessage,
    organizationSlug: dto.organizationSlug,
    taskId: dto.taskId,
    // Cost calculation if needed
    cost: this.calculateCost(dto.provider, dto.model, dto.promptTokens, dto.completionTokens),
  });

  return { id: usage.id };
}
```

---

## 5. Shared Services Module

### 5.1 Module Definition

**File:** `apps/langgraph/src/services/shared-services.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { LLMHttpClientService } from './llm-http-client.service';
import { LLMUsageReporterService } from './llm-usage-reporter.service';
import { ObservabilityService } from './observability.service';
import { HitlHelperService } from './hitl-helper.service';

@Global()
@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    LLMHttpClientService,
    LLMUsageReporterService,
    ObservabilityService,
    HitlHelperService,
  ],
  exports: [
    LLMHttpClientService,
    LLMUsageReporterService,
    ObservabilityService,
    HitlHelperService,
  ],
})
export class SharedServicesModule {}
```

### 5.2 LLM HTTP Client Service (EXISTS - No Changes)

**File:** `apps/langgraph/src/services/llm-http-client.service.ts`

Already production-ready. Used for **traditional LLM calls** (content generation, summarization, classification) where:
- User selects provider/model
- Usage tracking is automatic
- PII pseudonymization is needed

### 5.3 LLM Usage Reporter Service (NEW)

**File:** `apps/langgraph/src/services/llm-usage-reporter.service.ts`

Used by LangGraph tools to report usage when they make **direct LLM calls** to specialized models.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface LLMUsageReport {
  userId: string;
  provider: string;
  model: string;
  callerType: 'langgraph-tool' | 'langgraph-agent';
  callerName: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  status: 'completed' | 'failed';
  errorMessage?: string;
  organizationSlug?: string;
  taskId?: string;
}

@Injectable()
export class LLMUsageReporterService {
  private readonly logger = new Logger(LLMUsageReporterService.name);
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

  /**
   * Report LLM usage for tool calls that bypass /llm/generate
   * Non-blocking - failures are logged but don't throw
   */
  async reportUsage(report: LLMUsageReport): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/llm/usage`, report, {
          timeout: 2000,
          validateStatus: () => true,
        }),
      );
      this.logger.debug(`Usage reported: ${report.callerName} ${report.model}`);
    } catch (error) {
      this.logger.warn(`Usage reporting failed (non-blocking): ${error.message}`);
    }
  }

  /**
   * Helper to create a usage report with timing
   */
  createTimedReport(
    startTime: number,
    params: Omit<LLMUsageReport, 'latencyMs' | 'status'> & { status?: 'completed' | 'failed' },
  ): LLMUsageReport {
    return {
      ...params,
      latencyMs: Date.now() - startTime,
      status: params.status || 'completed',
    };
  }
}
```

### 5.4 Observability Service (NEW - Replaces WebhookStatusService)

**File:** `apps/langgraph/src/services/observability.service.ts`

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

export interface AgentContext {
  taskId: string;
  conversationId?: string;
  userId: string;
  agentSlug: string;
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

  /**
   * Send observability event to Orchestrator AI API /hooks endpoint
   * Non-blocking - failures are logged but don't throw
   */
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

  // ─────────────────────────────────────────────────────────────────
  // Agent Lifecycle Events
  // ─────────────────────────────────────────────────────────────────

  async emitAgentStarted(ctx: AgentContext, totalSteps: number): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: ctx.conversationId || ctx.taskId,
      hook_event_type: 'langgraph.agent.started',
      ...ctx,
      payload: { totalSteps },
    });
  }

  async emitAgentCompleted(ctx: AgentContext, deliverable: unknown): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: ctx.conversationId || ctx.taskId,
      hook_event_type: 'langgraph.agent.completed',
      ...ctx,
      payload: { deliverable },
    });
  }

  async emitAgentFailed(ctx: AgentContext, error: string): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: ctx.conversationId || ctx.taskId,
      hook_event_type: 'langgraph.agent.failed',
      ...ctx,
      payload: { error },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Node Events
  // ─────────────────────────────────────────────────────────────────

  async emitNodeStarted(ctx: AgentContext, nodeName: string): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: ctx.conversationId || ctx.taskId,
      hook_event_type: 'langgraph.node.started',
      ...ctx,
      payload: { nodeName },
    });
  }

  async emitNodeCompleted(ctx: AgentContext, nodeName: string, durationMs?: number): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: ctx.conversationId || ctx.taskId,
      hook_event_type: 'langgraph.node.completed',
      ...ctx,
      payload: { nodeName, durationMs },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Tool Events
  // ─────────────────────────────────────────────────────────────────

  async emitToolCalled(ctx: AgentContext, toolName: string, args: unknown): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: ctx.conversationId || ctx.taskId,
      hook_event_type: 'langgraph.tool.called',
      ...ctx,
      payload: { toolName, args },
    });
  }

  async emitToolResult(ctx: AgentContext, toolName: string, success: boolean, durationMs?: number): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: ctx.conversationId || ctx.taskId,
      hook_event_type: 'langgraph.tool.result',
      ...ctx,
      payload: { toolName, success, durationMs },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // HITL Events
  // ─────────────────────────────────────────────────────────────────

  async emitHitlRequested(ctx: AgentContext & { threadId: string }, hitlType: string, question: string): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: ctx.conversationId || ctx.taskId,
      hook_event_type: 'langgraph.hitl.requested',
      ...ctx,
      payload: { hitlType, question, threadId: ctx.threadId },
    });
  }

  async emitHitlResolved(ctx: AgentContext & { threadId: string }, decision: string): Promise<void> {
    await this.sendEvent({
      source_app: 'langgraph',
      session_id: ctx.conversationId || ctx.taskId,
      hook_event_type: 'langgraph.hitl.resolved',
      ...ctx,
      payload: { decision, threadId: ctx.threadId },
    });
  }
}
```

### 5.5 HITL Helper Service (NEW)

**File:** `apps/langgraph/src/services/hitl-helper.service.ts`

> **CRITICAL**: This service does NOT call `interrupt()` directly. The `interrupt()` function
> MUST be called inside graph nodes because it throws a special exception that LangGraph's
> runtime catches. This service only provides helper utilities.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Command } from '@langchain/langgraph';

export interface HitlInterruptPayload {
  type: 'confirmation' | 'choice' | 'input' | 'approval';
  question: string;
  options?: string[];
  dataToReview?: Record<string, unknown>;
  timestamp: number;
  threadId: string;
  taskId: string;
}

export interface HitlResponse {
  decision: 'approve' | 'reject' | 'edit' | string;
  value?: string;
  editedData?: Record<string, unknown>;
  reason?: string;
}

export interface RouteConfig {
  approved: string;
  rejected: string;
  edited?: string;
}

@Injectable()
export class HitlHelperService {
  private readonly logger = new Logger(HitlHelperService.name);

  /**
   * Format the payload to pass to interrupt()
   *
   * Usage in graph node:
   *   const payload = this.hitlHelper.formatInterruptPayload({...});
   *   const response = interrupt(payload); // <-- interrupt() called in NODE
   */
  formatInterruptPayload(
    request: {
      type: HitlInterruptPayload['type'];
      question: string;
      options?: string[];
      dataToReview?: Record<string, unknown>;
    },
    context: { threadId: string; taskId: string },
  ): HitlInterruptPayload {
    return {
      type: request.type,
      question: request.question,
      options: request.options,
      dataToReview: request.dataToReview,
      timestamp: Date.now(),
      threadId: context.threadId,
      taskId: context.taskId,
    };
  }

  /**
   * Create a Command to route graph based on HITL response
   *
   * Usage in graph node AFTER interrupt():
   *   const response = interrupt(payload);
   *   return this.hitlHelper.createRouteCommand(response, routes);
   */
  createRouteCommand(
    response: HitlResponse,
    routes: RouteConfig,
    additionalStateUpdates?: Record<string, unknown>,
  ): Command {
    const baseUpdate = {
      ...additionalStateUpdates,
      hitlStatus: response.decision,
    };

    if (response.decision === 'approve') {
      return new Command({
        update: baseUpdate,
        goto: routes.approved,
      });
    } else if (response.decision === 'edit' && routes.edited) {
      return new Command({
        update: {
          ...baseUpdate,
          ...response.editedData,
        },
        goto: routes.edited,
      });
    } else {
      return new Command({
        update: {
          ...baseUpdate,
          hitlRejectionReason: response.reason || 'No reason provided',
        },
        goto: routes.rejected,
      });
    }
  }

  /**
   * Validate that a threadId is provided (required for HITL)
   */
  validateThreadId(threadId: string | undefined): void {
    if (!threadId?.trim()) {
      throw new Error('threadId is required for HITL workflows');
    }
  }
}
```

### 5.6 Services Index Export

**File:** `apps/langgraph/src/services/index.ts`

```typescript
// Shared services barrel export
export { LLMHttpClientService, LLMCallRequest, LLMCallResponse } from './llm-http-client.service';
export { LLMUsageReporterService, LLMUsageReport } from './llm-usage-reporter.service';
export { ObservabilityService, ObservabilityEvent, AgentContext } from './observability.service';
export {
  HitlHelperService,
  HitlInterruptPayload,
  HitlResponse,
  RouteConfig,
} from './hitl-helper.service';
```

---

## 6. Persistence Module

### 6.1 Database Migration

**File:** `apps/api/supabase/migrations/20251125000001_langgraph_checkpoints.sql`

```sql
-- LangGraph Persistence Schema
-- Used by PostgresSaver for checkpointing

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_thread
ON langgraph.checkpoints(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_parent
ON langgraph.checkpoints(parent_checkpoint_id);

-- Grant access
GRANT USAGE ON SCHEMA langgraph TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA langgraph TO postgres;
```

### 6.2 PostgresSaver Checkpointer Service

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
      max: 10,
    });

    this.checkpointer = new PostgresSaver(this.pool);

    // REQUIRED: Create tables on first use
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
   * Check if a thread is in interrupted state (waiting for HITL)
   */
  async getThreadState(threadId: string): Promise<{
    isInterrupted: boolean;
    interruptPayload?: unknown;
  }> {
    const config = { configurable: { thread_id: threadId } };

    try {
      const state = await this.checkpointer.getTuple(config);

      if (!state) {
        return { isInterrupted: false };
      }

      const pendingWrites = state.pendingWrites || [];
      const isInterrupted = pendingWrites.length > 0;

      return {
        isInterrupted,
        interruptPayload: isInterrupted ? pendingWrites[0]?.value : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get thread state: ${error.message}`);
      return { isInterrupted: false };
    }
  }
}
```

### 6.3 Persistence Module

**File:** `apps/langgraph/src/persistence/persistence.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PostgresCheckpointerService } from './postgres-checkpointer.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PostgresCheckpointerService],
  exports: [PostgresCheckpointerService],
})
export class PersistenceModule {}
```

### 6.4 Persistence Index Export

**File:** `apps/langgraph/src/persistence/index.ts`

```typescript
export { PostgresCheckpointerService } from './postgres-checkpointer.service';
```

---

## 7. State Annotations

### 7.1 Base State Annotation with Zod Validation

**File:** `apps/langgraph/src/state/base-state.annotation.ts`

```typescript
import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import { z } from 'zod';

/**
 * Zod schema for validating base workflow input
 */
export const BaseWorkflowInputSchema = z.object({
  taskId: z.string().uuid('taskId must be a valid UUID'),
  conversationId: z.string().uuid().optional(),
  userId: z.string().uuid('userId must be a valid UUID'),
  organizationSlug: z.string().min(1, 'organizationSlug is required'),
  agentSlug: z.string().min(1, 'agentSlug is required'),
  provider: z.string().min(1, 'provider is required'),
  model: z.string().min(1, 'model is required'),
});

export type BaseWorkflowInput = z.infer<typeof BaseWorkflowInputSchema>;

/**
 * Base state annotation for all LangGraph workflows
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

  // LLM configuration (for traditional calls via LLMHttpClientService)
  provider: Annotation<string>(),
  model: Annotation<string>(),

  // Progress tracking
  currentStep: Annotation<string | undefined>(),
  totalSteps: Annotation<number | undefined>(),
  completedSteps: Annotation<number>({
    default: () => 0,
  }),

  // HITL tracking
  hitlStatus: Annotation<'none' | 'waiting' | 'approved' | 'rejected' | 'edited'>({
    default: () => 'none',
  }),
  hitlRejectionReason: Annotation<string | undefined>(),

  // Error tracking (keeps last 10 errors)
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (current, update) => {
      if (update === null) return [];
      const combined = [...current, ...(update || [])];
      return combined.slice(-10);
    },
  }),
});

export type BaseWorkflowState = typeof BaseWorkflowAnnotation.State;

/**
 * Validate input against BaseWorkflowInputSchema
 */
export function validateBaseInput(input: unknown): BaseWorkflowInput {
  return BaseWorkflowInputSchema.parse(input);
}
```

### 7.2 State Index Export

**File:** `apps/langgraph/src/state/index.ts`

```typescript
export {
  BaseWorkflowAnnotation,
  BaseWorkflowInputSchema,
  BaseWorkflowState,
  BaseWorkflowInput,
  validateBaseInput,
} from './base-state.annotation';
```

---

## 8. LangGraph Tools Module

### 8.1 Tools Module

**File:** `apps/langgraph/src/tools/tools.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { SqlQueryTool } from './sql-query.tool';
import { ListTablesTool } from './list-tables.tool';
import { DescribeTableTool } from './describe-table.tool';

@Global()
@Module({
  imports: [ConfigModule, HttpModule],
  providers: [SqlQueryTool, ListTablesTool, DescribeTableTool],
  exports: [SqlQueryTool, ListTablesTool, DescribeTableTool],
})
export class ToolsModule {}
```

**File:** `apps/langgraph/src/tools/index.ts`

```typescript
// Tools barrel export
export { SqlQueryTool } from './sql-query.tool';
export { ListTablesTool } from './list-tables.tool';
export { DescribeTableTool } from './describe-table.tool';
```

### 8.2 SQL Query Tool (with Specialized Model + Usage Reporting)

**File:** `apps/langgraph/src/tools/sql-query.tool.ts`

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatOllama } from '@langchain/ollama';
import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import pg from 'pg';
import { LLMUsageReporterService } from '../services';

// Dangerous SQL patterns to block
const DANGEROUS_PATTERNS = [
  /\bDROP\b/i,
  /\bDELETE\b/i,
  /\bTRUNCATE\b/i,
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bALTER\b/i,
  /\bCREATE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXECUTE\b/i,
  /\bCALL\b/i,
];

@Injectable()
export class SqlQueryTool implements OnModuleInit {
  private readonly logger = new Logger(SqlQueryTool.name);
  private pool: pg.Pool;
  private sqlModel: BaseChatModel;
  private modelProvider: string;
  private modelName: string;

  constructor(
    private configService: ConfigService,
    private usageReporter: LLMUsageReporterService,
  ) {}

  async onModuleInit() {
    // Database connection
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for SqlQueryTool');
    }
    this.pool = new pg.Pool({ connectionString, max: 5 });

    // Model selection - prefer local Ollama for SQL generation
    const useLocal = this.configService.get('USE_LOCAL_MODELS') === 'true';
    const ollamaUrl = this.configService.get('OLLAMA_URL') || 'http://localhost:11434';

    if (useLocal) {
      this.modelProvider = 'ollama';
      this.modelName = this.configService.get('SQL_MODEL') || 'sqlcoder:7b';
      this.sqlModel = new ChatOllama({
        model: this.modelName,
        baseUrl: ollamaUrl,
      });
      this.logger.log(`SqlQueryTool using Ollama: ${this.modelName}`);
    } else {
      this.modelProvider = 'anthropic';
      this.modelName = 'claude-sonnet-4-20250514';
      this.sqlModel = new ChatAnthropic({
        modelName: this.modelName,
      });
      this.logger.log(`SqlQueryTool using Anthropic: ${this.modelName}`);
    }
  }

  /**
   * Create the LangGraph tool
   */
  createTool() {
    return tool(
      async ({ question, tableSchema, userId, organizationSlug, taskId }) => {
        return this.generateAndExecute(question, tableSchema, { userId, organizationSlug, taskId });
      },
      {
        name: 'sql_query',
        description: `Generate and execute a read-only SQL SELECT query against the PostgreSQL database.
Only SELECT statements are allowed. Returns the query results as JSON.
Use this to retrieve data for analysis.`,
        schema: z.object({
          question: z.string().describe('Natural language question about the data'),
          tableSchema: z.string().describe('Available table schemas for context'),
          userId: z.string().describe('User ID for usage tracking'),
          organizationSlug: z.string().optional().describe('Organization for usage tracking'),
          taskId: z.string().optional().describe('Task ID for usage tracking'),
        }),
      },
    );
  }

  /**
   * Generate SQL and execute it
   */
  private async generateAndExecute(
    question: string,
    tableSchema: string,
    context: { userId: string; organizationSlug?: string; taskId?: string },
  ): Promise<string> {
    const startTime = Date.now();
    let status: 'completed' | 'failed' = 'completed';
    let errorMessage: string | undefined;

    try {
      // Generate SQL using specialized model
      const sql = await this.generateSql(question, tableSchema);

      // Validate SQL
      const validationError = this.validateSql(sql);
      if (validationError) {
        return JSON.stringify({ error: validationError });
      }

      // Execute SQL
      const result = await this.executeSql(sql);

      return JSON.stringify({
        success: true,
        generatedSql: sql,
        ...result,
      });
    } catch (error) {
      status = 'failed';
      errorMessage = error.message;
      return JSON.stringify({ error: error.message });
    } finally {
      // Report usage to Orchestrator AI API
      await this.usageReporter.reportUsage({
        userId: context.userId,
        provider: this.modelProvider,
        model: this.modelName,
        callerType: 'langgraph-tool',
        callerName: 'sql-query-tool',
        promptTokens: 0, // Ollama doesn't always return this
        completionTokens: 0,
        latencyMs: Date.now() - startTime,
        status,
        errorMessage,
        organizationSlug: context.organizationSlug,
        taskId: context.taskId,
      });
    }
  }

  /**
   * Generate SQL from natural language using specialized model
   */
  private async generateSql(question: string, tableSchema: string): Promise<string> {
    const response = await this.sqlModel.invoke([
      {
        role: 'system',
        content: `You are a PostgreSQL expert. Generate ONLY a SELECT query, nothing else.
No explanation, no markdown, just the SQL.

Available schema:
${tableSchema}`,
      },
      { role: 'user', content: question },
    ]);

    const sql = typeof response.content === 'string'
      ? response.content.trim()
      : String(response.content).trim();

    // Clean up any markdown code blocks
    return sql.replace(/^```sql\n?/i, '').replace(/\n?```$/i, '').trim();
  }

  /**
   * Validate SQL is safe (read-only)
   */
  private validateSql(sql: string): string | null {
    const trimmed = sql.trim();

    if (!trimmed.toUpperCase().startsWith('SELECT')) {
      return 'Only SELECT queries are allowed';
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        return `Query contains forbidden keyword: ${pattern.source}`;
      }
    }

    return null;
  }

  /**
   * Execute the SQL query
   */
  private async executeSql(sql: string, limit: number = 100): Promise<{
    rowCount: number;
    columns: string[];
    rows: unknown[];
    executionTimeMs: number;
  }> {
    const effectiveLimit = Math.min(limit, 1000);
    const limitedSql = sql.replace(/;?\s*$/, '') + ` LIMIT ${effectiveLimit}`;

    const startTime = Date.now();
    const result = await this.pool.query(limitedSql);

    return {
      rowCount: result.rows.length,
      columns: result.fields.map(f => f.name),
      rows: result.rows,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
```

### 8.3 List Tables Tool

**File:** `apps/langgraph/src/tools/list-tables.tool.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import pg from 'pg';

@Injectable()
export class ListTablesTool {
  private readonly logger = new Logger(ListTablesTool.name);
  private pool: pg.Pool;

  constructor(private configService: ConfigService) {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for ListTablesTool');
    }
    this.pool = new pg.Pool({ connectionString, max: 3 });
  }

  createTool() {
    return tool(
      async ({ schema }) => {
        return this.listTables(schema);
      },
      {
        name: 'list_tables',
        description: 'List all tables in a database schema. Defaults to public schema.',
        schema: z.object({
          schema: z.string().default('public').describe('The schema to list tables from'),
        }),
      },
    );
  }

  private async listTables(schemaName: string = 'public'): Promise<string> {
    try {
      const result = await this.pool.query(`
        SELECT table_name,
               (SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `, [schemaName]);

      return JSON.stringify({
        schema: schemaName,
        tables: result.rows.map(r => ({
          name: r.table_name,
          columnCount: parseInt(r.column_count),
        })),
        tableCount: result.rows.length,
      });
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  }
}
```

### 8.4 Describe Table Tool

**File:** `apps/langgraph/src/tools/describe-table.tool.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import pg from 'pg';

@Injectable()
export class DescribeTableTool {
  private readonly logger = new Logger(DescribeTableTool.name);
  private pool: pg.Pool;

  constructor(private configService: ConfigService) {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for DescribeTableTool');
    }
    this.pool = new pg.Pool({ connectionString, max: 3 });
  }

  createTool() {
    return tool(
      async ({ tableName, schema }) => {
        return this.describeTable(tableName, schema);
      },
      {
        name: 'describe_table',
        description: 'Get column information for a table including names, types, and constraints.',
        schema: z.object({
          tableName: z.string().describe('The name of the table to describe'),
          schema: z.string().default('public').describe('The schema containing the table'),
        }),
      },
    );
  }

  private async describeTable(tableName: string, schemaName: string = 'public'): Promise<string> {
    try {
      const result = await this.pool.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [schemaName, tableName]);

      if (result.rows.length === 0) {
        return JSON.stringify({ error: `Table '${schemaName}.${tableName}' not found` });
      }

      return JSON.stringify({
        table: `${schemaName}.${tableName}`,
        columns: result.rows.map(r => ({
          name: r.column_name,
          type: r.data_type,
          nullable: r.is_nullable === 'YES',
          default: r.column_default,
          maxLength: r.character_maximum_length,
        })),
        columnCount: result.rows.length,
      });
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  }
}
```

---

## 9. Data Analyst Agent (Tool-Calling Pattern)

### 9.1 State Annotation

**File:** `apps/langgraph/src/agents/data-analyst/data-analyst.state.ts`

```typescript
import { Annotation } from '@langchain/langgraph';
import { z } from 'zod';
import { BaseWorkflowAnnotation, BaseWorkflowInputSchema } from '../../state';

export const DataAnalystInputSchema = BaseWorkflowInputSchema.extend({
  question: z.string().min(1, 'question is required'),
});

export type DataAnalystInput = z.infer<typeof DataAnalystInputSchema>;

export const DataAnalystAnnotation = Annotation.Root({
  ...BaseWorkflowAnnotation.spec,

  // Input
  question: Annotation<string>(),

  // Processing
  tableSchema: Annotation<string | undefined>(),
  generatedSql: Annotation<string | undefined>(),
  queryResults: Annotation<unknown[] | undefined>(),
  queryError: Annotation<string | undefined>(),

  // Output
  summary: Annotation<string | undefined>(),
});

export type DataAnalystState = typeof DataAnalystAnnotation.State;
```

### 9.2 Graph Implementation

**File:** `apps/langgraph/src/agents/data-analyst/data-analyst.graph.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage } from '@langchain/core/messages';
import { PostgresCheckpointerService } from '../../persistence';
import { LLMHttpClientService, ObservabilityService, AgentContext } from '../../services';
import { SqlQueryTool, ListTablesTool, DescribeTableTool } from '../../tools';
import { DataAnalystAnnotation, DataAnalystState, DataAnalystInputSchema } from './data-analyst.state';

@Injectable()
export class DataAnalystGraph {
  private readonly logger = new Logger(DataAnalystGraph.name);
  private compiledGraph;
  private tools;

  constructor(
    private readonly checkpointerService: PostgresCheckpointerService,
    private readonly llmClient: LLMHttpClientService,
    private readonly observabilityService: ObservabilityService,
    private readonly sqlQueryTool: SqlQueryTool,
    private readonly listTablesTool: ListTablesTool,
    private readonly describeTableTool: DescribeTableTool,
  ) {
    this.tools = [
      this.sqlQueryTool.createTool(),
      this.listTablesTool.createTool(),
      this.describeTableTool.createTool(),
    ];

    this.compiledGraph = this.buildGraph();
  }

  private buildGraph() {
    const toolNode = new ToolNode(this.tools);

    return new StateGraph(DataAnalystAnnotation)
      // Schema discovery node
      .addNode('discoverSchema', this.discoverSchema.bind(this))

      // Agent node - decides which tools to call
      .addNode('agent', this.agentNode.bind(this))

      // Tool execution node
      .addNode('tools', toolNode)

      // Summarization node (uses traditional LLM call)
      .addNode('summarize', this.summarizeNode.bind(this))

      // Flow
      .addEdge(START, 'discoverSchema')
      .addEdge('discoverSchema', 'agent')

      // Agent decides: call tools or summarize
      .addConditionalEdges('agent', this.shouldCallTools.bind(this), {
        tools: 'tools',
        summarize: 'summarize',
      })

      // After tools, back to agent
      .addEdge('tools', 'agent')

      // After summarize, end
      .addEdge('summarize', END)

      .compile({
        checkpointer: this.checkpointerService.getCheckpointer(),
        recursionLimit: 10,
      });
  }

  /**
   * Discover database schema for context
   */
  private async discoverSchema(state: DataAnalystState): Promise<Partial<DataAnalystState>> {
    const ctx = this.getContext(state);
    await this.observabilityService.emitNodeStarted(ctx, 'discoverSchema');
    const startTime = Date.now();

    // Get list of tables
    const tablesResult = await this.listTablesTool.createTool().invoke({ schema: 'public' });
    const tables = JSON.parse(tablesResult);

    // Get schema for relevant tables (first 5)
    const schemaPromises = tables.tables?.slice(0, 5).map(async (t: { name: string }) => {
      const desc = await this.describeTableTool.createTool().invoke({
        tableName: t.name,
        schema: 'public',
      });
      return JSON.parse(desc);
    }) || [];

    const schemas = await Promise.all(schemaPromises);

    const tableSchema = schemas.map(s =>
      `Table: ${s.table}\nColumns: ${s.columns?.map((c: { name: string; type: string }) => `${c.name} (${c.type})`).join(', ')}`
    ).join('\n\n');

    await this.observabilityService.emitNodeCompleted(ctx, 'discoverSchema', Date.now() - startTime);

    return {
      tableSchema,
      completedSteps: 1,
    };
  }

  /**
   * Agent node - uses LLMHttpClientService to decide tool calls
   */
  private async agentNode(state: DataAnalystState): Promise<Partial<DataAnalystState>> {
    const ctx = this.getContext(state);
    await this.observabilityService.emitNodeStarted(ctx, 'agent');
    const startTime = Date.now();

    // Check if we already have query results - if so, go to summarize
    if (state.queryResults && state.queryResults.length > 0) {
      await this.observabilityService.emitNodeCompleted(ctx, 'agent', Date.now() - startTime);
      return { currentStep: 'agent-done' };
    }

    // Use traditional LLM call to decide what to do
    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are a Data Analyst. Based on the user's question and available schema, decide:

1. If you need to query data, respond with a JSON object:
   {"action": "query", "sql": "SELECT ..."}

2. If you have enough information, respond with:
   {"action": "summarize"}

Available schema:
${state.tableSchema}

Previous results: ${state.queryResults ? JSON.stringify(state.queryResults).slice(0, 500) : 'None yet'}`,
      userMessage: state.question,
      callerName: 'data-analyst-agent',
      userId: state.userId,
    });

    await this.observabilityService.emitNodeCompleted(ctx, 'agent', Date.now() - startTime);

    try {
      const decision = JSON.parse(result.text);

      if (decision.action === 'query' && decision.sql) {
        // Execute the SQL query
        const queryResult = await this.sqlQueryTool.createTool().invoke({
          question: state.question,
          tableSchema: state.tableSchema || '',
          userId: state.userId,
          organizationSlug: state.organizationSlug,
          taskId: state.taskId,
        });

        const parsed = JSON.parse(queryResult);

        return {
          generatedSql: decision.sql,
          queryResults: parsed.rows || [],
          queryError: parsed.error,
          completedSteps: 2,
        };
      }
    } catch {
      // If parsing fails, continue to summarize
    }

    return { currentStep: 'agent-done', completedSteps: 2 };
  }

  /**
   * Routing function
   */
  private shouldCallTools(state: DataAnalystState): string {
    // If we have results or tried querying, go to summarize
    if (state.queryResults || state.queryError || state.currentStep === 'agent-done') {
      return 'summarize';
    }
    return 'tools';
  }

  /**
   * Summarize results using traditional LLM call
   */
  private async summarizeNode(state: DataAnalystState): Promise<Partial<DataAnalystState>> {
    const ctx = this.getContext(state);
    await this.observabilityService.emitNodeStarted(ctx, 'summarize');
    const startTime = Date.now();

    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are a Data Analyst presenting findings. Summarize the query results clearly and concisely.
Include:
- Key insights from the data
- Any notable patterns or anomalies
- Direct answer to the user's question`,
      userMessage: `Question: ${state.question}

SQL Query: ${state.generatedSql || 'N/A'}

Results (${state.queryResults?.length || 0} rows):
${JSON.stringify(state.queryResults?.slice(0, 20), null, 2)}

${state.queryError ? `Error: ${state.queryError}` : ''}`,
      callerName: 'data-analyst-summarize',
      userId: state.userId,
    });

    await this.observabilityService.emitNodeCompleted(ctx, 'summarize', Date.now() - startTime);

    return {
      summary: result.text,
      completedSteps: 3,
    };
  }

  private getContext(state: DataAnalystState): AgentContext {
    return {
      taskId: state.taskId,
      conversationId: state.conversationId,
      userId: state.userId,
      agentSlug: state.agentSlug,
      organizationSlug: state.organizationSlug,
    };
  }

  /**
   * Execute the graph
   */
  async execute(input: DataAnalystState, threadId: string): Promise<DataAnalystState> {
    DataAnalystInputSchema.parse(input);

    if (!threadId?.trim()) {
      throw new Error('threadId is required');
    }

    const config = { configurable: { thread_id: threadId } };
    const ctx = this.getContext(input);

    await this.observabilityService.emitAgentStarted(ctx, 3);

    try {
      const result = await this.compiledGraph.invoke(
        { ...input, totalSteps: 3 },
        config,
      );

      await this.observabilityService.emitAgentCompleted(ctx, {
        summary: result.summary,
        generatedSql: result.generatedSql,
        rowCount: result.queryResults?.length,
      });

      return result;
    } catch (error) {
      await this.observabilityService.emitAgentFailed(ctx, error.message);
      throw error;
    }
  }
}
```

### 9.3 Service, Controller, DTO, Module

**File:** `apps/langgraph/src/agents/data-analyst/data-analyst.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { DataAnalystGraph } from './data-analyst.graph';
import { DataAnalystRequestDto } from './dto/data-analyst-request.dto';

@Injectable()
export class DataAnalystService {
  constructor(private readonly graph: DataAnalystGraph) {}

  async execute(request: DataAnalystRequestDto) {
    const threadId = request.taskId;

    return this.graph.execute(
      {
        question: request.prompt,
        taskId: request.taskId,
        conversationId: request.conversationId,
        userId: request.userId,
        organizationSlug: request.organizationSlug,
        agentSlug: 'data-analyst',
        provider: request.provider,
        model: request.model,
        messages: [],
        completedSteps: 0,
        hitlStatus: 'none',
        errors: [],
      },
      threadId,
    );
  }
}
```

**File:** `apps/langgraph/src/agents/data-analyst/data-analyst.controller.ts`

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { DataAnalystService } from './data-analyst.service';
import { DataAnalystRequestDto } from './dto/data-analyst-request.dto';

@Controller('workflows/data-analyst')
export class DataAnalystController {
  constructor(private readonly service: DataAnalystService) {}

  @Post('execute')
  async execute(@Body() request: DataAnalystRequestDto) {
    const result = await this.service.execute(request);

    return {
      status: 'completed',
      result: {
        summary: result.summary,
        generatedSql: result.generatedSql,
        queryResults: result.queryResults,
      },
    };
  }
}
```

**File:** `apps/langgraph/src/agents/data-analyst/dto/data-analyst-request.dto.ts`

```typescript
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class DataAnalystRequestDto {
  @IsString()
  prompt: string;

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
}
```

**File:** `apps/langgraph/src/agents/data-analyst/dto/index.ts`

```typescript
export { DataAnalystRequestDto } from './data-analyst-request.dto';
```

**File:** `apps/langgraph/src/agents/data-analyst/data-analyst.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DataAnalystController } from './data-analyst.controller';
import { DataAnalystService } from './data-analyst.service';
import { DataAnalystGraph } from './data-analyst.graph';

@Module({
  controllers: [DataAnalystController],
  providers: [DataAnalystService, DataAnalystGraph],
  exports: [DataAnalystService],
})
export class DataAnalystModule {}
```

---

## 10. Extended Post Writer Agent (HITL Pattern)

### 10.1 State Annotation

**File:** `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.state.ts`

```typescript
import { Annotation } from '@langchain/langgraph';
import { z } from 'zod';
import { BaseWorkflowAnnotation, BaseWorkflowInputSchema } from '../../state';

export const ExtendedPostWriterInputSchema = BaseWorkflowInputSchema.extend({
  announcement: z.string().min(1, 'announcement is required'),
});

export type ExtendedPostWriterInput = z.infer<typeof ExtendedPostWriterInputSchema>;

export const ExtendedPostWriterAnnotation = Annotation.Root({
  ...BaseWorkflowAnnotation.spec,

  // Input
  announcement: Annotation<string>(),

  // Generated content
  blogPost: Annotation<string | undefined>(),
  seoContent: Annotation<string | undefined>(),
  socialPosts: Annotation<string | undefined>(),

  // HITL tracking
  contentApproved: Annotation<boolean>({ default: () => false }),
  editedContent: Annotation<Record<string, string> | undefined>(),

  // Final result
  result: Annotation<Record<string, string> | undefined>(),
});

export type ExtendedPostWriterState = typeof ExtendedPostWriterAnnotation.State;
```

### 10.2 Graph Implementation

**File:** `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';
import { PostgresCheckpointerService } from '../../persistence';
import {
  LLMHttpClientService,
  ObservabilityService,
  AgentContext,
  HitlHelperService,
} from '../../services';
import {
  ExtendedPostWriterAnnotation,
  ExtendedPostWriterState,
  ExtendedPostWriterInputSchema,
} from './extended-post-writer.state';

@Injectable()
export class ExtendedPostWriterGraph {
  private readonly logger = new Logger(ExtendedPostWriterGraph.name);
  private compiledGraph;

  constructor(
    private readonly checkpointerService: PostgresCheckpointerService,
    private readonly llmClient: LLMHttpClientService,
    private readonly observabilityService: ObservabilityService,
    private readonly hitlHelper: HitlHelperService,
  ) {
    this.compiledGraph = this.buildGraph();
  }

  private buildGraph() {
    return new StateGraph(ExtendedPostWriterAnnotation)
      .addNode('generateBlog', this.generateBlogPost.bind(this))
      .addNode('generateSEO', this.generateSEO.bind(this))
      .addNode('generateSocial', this.generateSocial.bind(this))
      .addNode('humanApproval', this.humanApprovalNode.bind(this))
      .addNode('finalize', this.finalizeContent.bind(this))
      .addNode('rejected', this.handleRejection.bind(this))

      .addEdge(START, 'generateBlog')
      .addEdge('generateBlog', 'generateSEO')
      .addEdge('generateSEO', 'generateSocial')
      .addEdge('generateSocial', 'humanApproval')
      .addEdge('finalize', END)
      .addEdge('rejected', END)

      .compile({
        checkpointer: this.checkpointerService.getCheckpointer(),
        recursionLimit: 5,
      });
  }

  // ─────────────────────────────────────────────────────────────────
  // Content Generation Nodes (use LLMHttpClientService)
  // ─────────────────────────────────────────────────────────────────

  private async generateBlogPost(state: ExtendedPostWriterState): Promise<Partial<ExtendedPostWriterState>> {
    const ctx = this.getContext(state);
    await this.observabilityService.emitNodeStarted(ctx, 'generateBlog');
    const startTime = Date.now();

    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are a brilliant blog post writer. Write an engaging, informative blog post.
Include: compelling title, hook introduction, detailed body, conclusion with CTA.
Use markdown formatting.`,
      userMessage: state.announcement,
      callerName: 'extended-post-writer-blog',
      userId: state.userId,
    });

    await this.observabilityService.emitNodeCompleted(ctx, 'generateBlog', Date.now() - startTime);

    return { blogPost: result.text, completedSteps: 1 };
  }

  private async generateSEO(state: ExtendedPostWriterState): Promise<Partial<ExtendedPostWriterState>> {
    const ctx = this.getContext(state);
    await this.observabilityService.emitNodeStarted(ctx, 'generateSEO');
    const startTime = Date.now();

    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are an SEO specialist. Generate:
- Meta title (60 chars max)
- Meta description (155 chars max)
- 5-10 keywords
- H1 heading
- JSON-LD structured data
Format as markdown.`,
      userMessage: state.announcement,
      callerName: 'extended-post-writer-seo',
      userId: state.userId,
    });

    await this.observabilityService.emitNodeCompleted(ctx, 'generateSEO', Date.now() - startTime);

    return { seoContent: result.text, completedSteps: 2 };
  }

  private async generateSocial(state: ExtendedPostWriterState): Promise<Partial<ExtendedPostWriterState>> {
    const ctx = this.getContext(state);
    await this.observabilityService.emitNodeStarted(ctx, 'generateSocial');
    const startTime = Date.now();

    const result = await this.llmClient.callLLM({
      provider: state.provider,
      model: state.model,
      systemMessage: `You are a social media strategist. Create posts for:
- Twitter/X (280 chars with hashtags)
- LinkedIn (professional, 1300 chars max)
- Facebook (conversational, 500 chars)
Format each clearly.`,
      userMessage: state.announcement,
      callerName: 'extended-post-writer-social',
      userId: state.userId,
    });

    await this.observabilityService.emitNodeCompleted(ctx, 'generateSocial', Date.now() - startTime);

    return { socialPosts: result.text, completedSteps: 3 };
  }

  // ─────────────────────────────────────────────────────────────────
  // HITL Approval Node
  //
  // CRITICAL NOTES:
  // 1. interrupt() is called DIRECTLY here, not in a service
  // 2. Code BEFORE interrupt() runs again on resume - keep it idempotent
  // 3. Code AFTER interrupt() only runs after resume
  // 4. interrupt() throws - don't wrap in try/catch
  // ─────────────────────────────────────────────────────────────────

  private async humanApprovalNode(state: ExtendedPostWriterState): Promise<Command> {
    const threadId = state.taskId;

    // Format payload using helper (idempotent - ok to run twice)
    const payload = this.hitlHelper.formatInterruptPayload(
      {
        type: 'approval',
        question: 'Please review the generated content. You can approve, edit, or reject.',
        dataToReview: {
          blogPost: state.blogPost,
          seoContent: state.seoContent,
          socialPosts: state.socialPosts,
        },
        options: ['approve', 'edit', 'reject'],
      },
      { threadId, taskId: state.taskId },
    );

    // ═══════════════════════════════════════════════════════════════
    // INTERRUPT - Execution pauses here until resumed
    // ═══════════════════════════════════════════════════════════════
    const response = interrupt(payload);
    // ═══════════════════════════════════════════════════════════════
    // CODE BELOW ONLY RUNS AFTER RESUME
    // ═══════════════════════════════════════════════════════════════

    // Emit resolved event (only runs after resume)
    const ctx = this.getContext(state);
    await this.observabilityService.emitHitlResolved(
      { ...ctx, threadId },
      response.decision,
    );

    // Route based on response
    return this.hitlHelper.createRouteCommand(
      response,
      { approved: 'finalize', rejected: 'rejected', edited: 'finalize' },
      response.editedData ? { editedContent: response.editedData } : undefined,
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Finalization Nodes
  // ─────────────────────────────────────────────────────────────────

  private async finalizeContent(state: ExtendedPostWriterState): Promise<Partial<ExtendedPostWriterState>> {
    const ctx = this.getContext(state);
    await this.observabilityService.emitNodeStarted(ctx, 'finalize');

    const finalContent = state.editedContent || {
      blogPost: state.blogPost!,
      seoContent: state.seoContent!,
      socialPosts: state.socialPosts!,
    };

    await this.observabilityService.emitNodeCompleted(ctx, 'finalize');

    return {
      result: finalContent,
      contentApproved: true,
      completedSteps: 5,
    };
  }

  private async handleRejection(state: ExtendedPostWriterState): Promise<Partial<ExtendedPostWriterState>> {
    return {
      contentApproved: false,
      completedSteps: 5,
      errors: [`Content rejected: ${state.hitlRejectionReason || 'No reason provided'}`],
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Execution Methods
  // ─────────────────────────────────────────────────────────────────

  private getContext(state: ExtendedPostWriterState): AgentContext {
    return {
      taskId: state.taskId,
      conversationId: state.conversationId,
      userId: state.userId,
      agentSlug: state.agentSlug,
      organizationSlug: state.organizationSlug,
    };
  }

  async execute(input: ExtendedPostWriterState, threadId: string): Promise<{
    status: 'completed' | 'hitl_waiting';
    result?: Record<string, string>;
    hitlPayload?: unknown;
  }> {
    ExtendedPostWriterInputSchema.parse(input);
    this.hitlHelper.validateThreadId(threadId);

    const config = { configurable: { thread_id: threadId } };
    const ctx = this.getContext(input);

    await this.observabilityService.emitAgentStarted(ctx, 5);

    try {
      const result = await this.compiledGraph.invoke(
        { ...input, totalSteps: 5 },
        config,
      );

      // Check for interrupt
      const threadState = await this.checkpointerService.getThreadState(threadId);

      if (threadState.isInterrupted) {
        await this.observabilityService.emitHitlRequested(
          { ...ctx, threadId },
          'approval',
          'Please review the generated content',
        );

        return {
          status: 'hitl_waiting',
          hitlPayload: threadState.interruptPayload,
        };
      }

      await this.observabilityService.emitAgentCompleted(ctx, result.result);

      return { status: 'completed', result: result.result };
    } catch (error) {
      await this.observabilityService.emitAgentFailed(ctx, error.message);
      throw error;
    }
  }

  async resume(
    threadId: string,
    humanResponse: { decision: string; editedData?: Record<string, string>; reason?: string },
  ): Promise<{ status: 'completed' | 'rejected'; result?: Record<string, string> }> {
    this.hitlHelper.validateThreadId(threadId);

    const config = { configurable: { thread_id: threadId } };

    const result = await this.compiledGraph.invoke(
      new Command({ resume: humanResponse }),
      config,
    );

    return {
      status: result.contentApproved ? 'completed' : 'rejected',
      result: result.result,
    };
  }

  async getThreadState(threadId: string) {
    return this.checkpointerService.getThreadState(threadId);
  }
}
```

### 10.3 Service, Controller, DTO, Module

**File:** `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ExtendedPostWriterGraph } from './extended-post-writer.graph';
import { ExtendedPostWriterRequestDto, ExtendedPostWriterResumeDto } from './dto';

@Injectable()
export class ExtendedPostWriterService {
  constructor(private readonly graph: ExtendedPostWriterGraph) {}

  async execute(request: ExtendedPostWriterRequestDto) {
    return this.graph.execute(
      {
        announcement: request.prompt,
        taskId: request.taskId,
        conversationId: request.conversationId,
        userId: request.userId,
        organizationSlug: request.organizationSlug,
        agentSlug: 'extended-post-writer',
        provider: request.provider,
        model: request.model,
        messages: [],
        completedSteps: 0,
        hitlStatus: 'none',
        errors: [],
        contentApproved: false,
      },
      request.taskId,
    );
  }

  async resume(threadId: string, response: ExtendedPostWriterResumeDto) {
    return this.graph.resume(threadId, response);
  }

  async getStatus(threadId: string) {
    return this.graph.getThreadState(threadId);
  }
}
```

**File:** `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.controller.ts`

```typescript
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ExtendedPostWriterService } from './extended-post-writer.service';
import { ExtendedPostWriterRequestDto, ExtendedPostWriterResumeDto } from './dto';

@Controller('workflows/extended-post-writer')
export class ExtendedPostWriterController {
  constructor(private readonly service: ExtendedPostWriterService) {}

  @Post('execute')
  async execute(@Body() request: ExtendedPostWriterRequestDto) {
    return this.service.execute(request);
  }

  @Post(':threadId/resume')
  async resume(
    @Param('threadId') threadId: string,
    @Body() response: ExtendedPostWriterResumeDto,
  ) {
    return this.service.resume(threadId, response);
  }

  @Get(':threadId/status')
  async getStatus(@Param('threadId') threadId: string) {
    return this.service.getStatus(threadId);
  }
}
```

**File:** `apps/langgraph/src/agents/extended-post-writer/dto/extended-post-writer-request.dto.ts`

```typescript
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class ExtendedPostWriterRequestDto {
  @IsString()
  prompt: string;

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
}
```

**File:** `apps/langgraph/src/agents/extended-post-writer/dto/extended-post-writer-resume.dto.ts`

```typescript
import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';

export class ExtendedPostWriterResumeDto {
  @IsIn(['approve', 'reject', 'edit'])
  decision: 'approve' | 'reject' | 'edit';

  @IsOptional()
  @IsObject()
  editedData?: Record<string, string>;

  @IsOptional()
  @IsString()
  reason?: string;
}
```

**File:** `apps/langgraph/src/agents/extended-post-writer/dto/index.ts`

```typescript
export { ExtendedPostWriterRequestDto } from './extended-post-writer-request.dto';
export { ExtendedPostWriterResumeDto } from './extended-post-writer-resume.dto';
```

**File:** `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ExtendedPostWriterController } from './extended-post-writer.controller';
import { ExtendedPostWriterService } from './extended-post-writer.service';
import { ExtendedPostWriterGraph } from './extended-post-writer.graph';

@Module({
  controllers: [ExtendedPostWriterController],
  providers: [ExtendedPostWriterService, ExtendedPostWriterGraph],
  exports: [ExtendedPostWriterService],
})
export class ExtendedPostWriterModule {}
```

---

## 11. App Module Updates

**File:** `apps/langgraph/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

// Core modules
import { SharedServicesModule } from './services/shared-services.module';
import { PersistenceModule } from './persistence/persistence.module';
import { ToolsModule } from './tools/tools.module';
import { HealthModule } from './health/health.module';

// Agent modules
import { DataAnalystModule } from './agents/data-analyst/data-analyst.module';
import { ExtendedPostWriterModule } from './agents/extended-post-writer/extended-post-writer.module';

// Legacy (to be deprecated)
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    HttpModule,

    // Core infrastructure
    SharedServicesModule,
    PersistenceModule,
    ToolsModule,
    HealthModule,

    // New agents
    DataAnalystModule,
    ExtendedPostWriterModule,

    // Legacy
    WorkflowsModule,
  ],
})
export class AppModule {}
```

---

## 12. Package Dependencies

**File:** `apps/langgraph/package.json` (dependencies to add)

```json
{
  "dependencies": {
    "@langchain/langgraph-checkpoint-postgres": "^0.1.0",
    "@langchain/anthropic": "^0.3.0",
    "@langchain/ollama": "^0.1.0",
    "pg": "^8.11.0",
    "zod": "^3.22.0"
  }
}
```

---

## 13. Environment Variables

**File:** `apps/langgraph/.env.example`

```bash
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:6012/postgres
API_PORT=6100
API_HOST=localhost

# Optional - Tool model configuration
USE_LOCAL_MODELS=false
OLLAMA_URL=http://localhost:11434
SQL_MODEL=sqlcoder:7b

# Anthropic (if USE_LOCAL_MODELS=false)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 14. Database Seeds

**File:** `apps/api/supabase/seeds/agents-langgraph-phase5.sql`

```sql
-- Data Analyst Agent
INSERT INTO agents (
  slug, display_name, description, agent_type, status,
  department, capabilities, llm_config
) VALUES (
  'data-analyst',
  'Data Analyst',
  'Analyzes data by generating and executing SQL queries. Uses specialized models for SQL generation. Provides summaries and insights.',
  'langgraph',
  'active',
  'analytics',
  '["sql-generation", "data-analysis", "tool-calling"]',
  '{"defaultProvider": "anthropic", "defaultModel": "claude-sonnet-4-20250514"}'
) ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

-- Extended Post Writer Agent
INSERT INTO agents (
  slug, display_name, description, agent_type, status,
  department, capabilities, llm_config
) VALUES (
  'extended-post-writer',
  'Extended Post Writer',
  'Generates blog posts, SEO content, and social media posts from announcements. Includes human approval workflow.',
  'langgraph',
  'active',
  'marketing',
  '["content-generation", "seo", "social-media", "hitl"]',
  '{"defaultProvider": "anthropic", "defaultModel": "claude-sonnet-4-20250514"}'
) ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;
```

---

## 15. HITL Front-End Components

### 15.1 HITL Status Banner

**File:** `apps/web/src/components/agents/HitlStatusBanner.vue`

```vue
<template>
  <ion-card v-if="isWaiting" color="warning" class="hitl-banner">
    <ion-card-header>
      <ion-card-title>
        <ion-icon :icon="handLeftOutline" /> Action Required
      </ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <p>{{ hitlRequest?.question || 'Human input is required to continue.' }}</p>
      <ion-button @click="$emit('openApproval')">
        Review & Respond
      </ion-button>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonIcon, IonButton } from '@ionic/vue';
import { handLeftOutline } from 'ionicons/icons';

interface HitlRequest {
  question: string;
  dataToReview?: Record<string, unknown>;
  options?: string[];
}

defineProps<{
  isWaiting: boolean;
  hitlRequest?: HitlRequest;
}>();

defineEmits<{
  openApproval: [];
}>();
</script>
```

### 15.2 HITL Approval Modal

**File:** `apps/web/src/components/agents/HitlApprovalModal.vue`

```vue
<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Review Content</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-for="(content, key) in editableContent" :key="key" class="content-section">
        <h3>{{ formatKey(key) }}</h3>
        <ion-textarea
          v-model="editableContent[key]"
          :readonly="!isEditing"
          :auto-grow="true"
          :rows="5"
        />
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button color="danger" @click="handleReject">
            <ion-icon :icon="closeOutline" slot="start" />
            Reject
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button @click="isEditing = !isEditing">
            <ion-icon :icon="createOutline" slot="start" />
            {{ isEditing ? 'Done Editing' : 'Edit' }}
          </ion-button>
          <ion-button color="success" @click="handleApprove">
            <ion-icon :icon="checkmarkOutline" slot="start" />
            {{ hasEdits ? 'Approve with Edits' : 'Approve' }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonButton, IonContent, IonFooter, IonTextarea, IonIcon,
} from '@ionic/vue';
import { closeOutline, createOutline, checkmarkOutline } from 'ionicons/icons';

const props = defineProps<{
  isOpen: boolean;
  dataToReview: Record<string, string>;
}>();

const emit = defineEmits<{
  close: [];
  respond: [response: { decision: string; editedData?: Record<string, string>; reason?: string }];
}>();

const isEditing = ref(false);
const editableContent = ref<Record<string, string>>({});
const rejectReason = ref('');

watch(() => props.isOpen, (open) => {
  if (open) {
    editableContent.value = { ...props.dataToReview };
    isEditing.value = false;
  }
});

const hasEdits = computed(() => {
  return Object.keys(editableContent.value).some(
    key => editableContent.value[key] !== props.dataToReview[key]
  );
});

const formatKey = (key: string) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

const handleApprove = () => {
  if (hasEdits.value) {
    emit('respond', { decision: 'edit', editedData: editableContent.value });
  } else {
    emit('respond', { decision: 'approve' });
  }
};

const handleReject = () => {
  emit('respond', { decision: 'reject', reason: rejectReason.value || 'User rejected' });
};
</script>
```

---

## 16. Implementation Plan

### Phase 5a: Infrastructure (2-3 days)
- [ ] Add package dependencies
- [ ] Create database migration for langgraph schema
- [ ] Create SharedServicesModule (ObservabilityService, HitlHelperService, LLMUsageReporterService)
- [ ] Create PersistenceModule (PostgresCheckpointerService)
- [ ] Create base state annotation with Zod
- [ ] Add `/llm/usage` endpoint to Orchestrator AI API
- [ ] Update app.module.ts
- [ ] Test: Verify checkpointer creates tables

### Phase 5b: Tools Module (1-2 days)
- [ ] Create SqlQueryTool with Ollama/Anthropic support
- [ ] Create ListTablesTool
- [ ] Create DescribeTableTool
- [ ] Create ToolsModule
- [ ] Test: SQL generation and execution

### Phase 5c: Data Analyst Agent (2-3 days)
- [ ] Create state annotation
- [ ] Create graph with tool-calling pattern
- [ ] Create service, controller, module, DTOs
- [ ] Register in database
- [ ] Test: End-to-end question → SQL → summary
- [ ] Test: Usage reporting for tool LLM calls

### Phase 5d: Extended Post Writer Agent (2-3 days)
- [ ] Create state annotation
- [ ] Create graph with HITL interrupt
- [ ] Create service, controller, module, DTOs
- [ ] Register in database
- [ ] Test: Generate → Interrupt → Approve
- [ ] Test: Generate → Interrupt → Edit
- [ ] Test: Generate → Interrupt → Reject

### Phase 5e: HITL Front-End (2 days)
- [ ] Create HitlStatusBanner
- [ ] Create HitlApprovalModal
- [ ] Update agent chat to detect HITL
- [ ] Test: Full UI approval flow

### Phase 5f: Cleanup & Polish (1-2 days)
- [ ] Delete deprecated `apps/langgraph/src/services/webhook-status.service.ts`
- [ ] Delete deprecated `apps/langgraph/src/workflows/graphs/marketing-swarm.graph.ts`
- [ ] Error handling review
- [ ] Loading states
- [ ] Documentation

---

## 17. Critical Best Practices

### interrupt() Usage
1. **Call interrupt() ONLY in graph nodes** - never in services
2. **Code before interrupt() runs again on resume** - make it idempotent
3. **Move side effects AFTER interrupt()** or into separate nodes
4. **Never wrap interrupt() in try/catch**

### LLM Call Patterns
1. **Traditional calls** (content gen, summarization) → `LLMHttpClientService`
2. **Tool-internal calls** (specialized) → Direct to Ollama/provider
3. **Always report usage** via `LLMUsageReporterService` or `/llm/usage`

### State Management
1. **Validate input with Zod** at graph entry
2. **Keep state minimal**
3. **Use reducers sparingly**
4. **Validate threadId** for checkpointed graphs

### Checkpointing
1. **Call checkpointer.setup()** on init
2. **Use consistent threadId** (typically taskId)
3. **Check isInterrupted** after invoke
4. **Use Command({ resume: value })** to resume

---

## 18. Success Criteria

### Data Analyst
- [ ] Lists database tables
- [ ] Generates valid SQL from questions
- [ ] Executes SQL safely (read-only)
- [ ] Summarizes results clearly
- [ ] Reports tool LLM usage to `/llm/usage`
- [ ] Observability events visible

### Extended Post Writer
- [ ] Generates blog, SEO, social content
- [ ] Pauses at HITL with `hitl_waiting` status
- [ ] Resumes correctly on approve/edit/reject
- [ ] HITL events visible in observability

### Infrastructure
- [ ] Checkpoints persisted in langgraph schema
- [ ] `/llm/usage` endpoint working
- [ ] All traditional LLM calls through `/llm/generate`
- [ ] Zod validation catching invalid input

---

## Sources

- [LangGraph.js GitHub](https://github.com/langchain-ai/langgraphjs)
- [LangGraph Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [PostgresSaver Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/checkpoint_postgres.PostgresSaver.html)
- [ToolNode Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph_prebuilt.ToolNode.html)
- [@langchain/langgraph-checkpoint-postgres](https://www.npmjs.com/package/@langchain/langgraph-checkpoint-postgres)
