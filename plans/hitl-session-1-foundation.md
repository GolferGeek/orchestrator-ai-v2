# HITL Refactoring Session 1: Foundation

## Goal
Set up the database, types, and base services needed for the HITL refactoring.

## Prerequisites
- Supabase running locally
- LangGraph service running
- API service running

---

## Overview

This session establishes:
1. Database table for workflow content versions
2. Transport types for HITL payloads
3. WorkflowVersionsService for version CRUD
4. Base HITL state annotation
5. WorkflowVersionsHydrator service

---

## Task 1: Database Migration

### 1.1 Create Migration: `workflow_content_versions` Table

**File**: `apps/api/supabase/migrations/YYYYMMDD_create_workflow_content_versions.sql`

```sql
-- Workflow Content Versions
-- Tracks content versions during HITL iterations
-- Each version represents a point-in-time snapshot of generated content

CREATE TABLE workflow_content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  conversation_id UUID REFERENCES conversations(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ai_generated', 'ai_regenerated', 'user_replaced')),
  feedback TEXT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(thread_id, version_number)
);

CREATE INDEX idx_wcv_thread_id ON workflow_content_versions(thread_id);
CREATE INDEX idx_wcv_conversation_id ON workflow_content_versions(conversation_id);
CREATE INDEX idx_wcv_is_current ON workflow_content_versions(thread_id, is_current) WHERE is_current = true;
```

### 1.2 Database Function for Atomic Version Creation

```sql
-- Handles concurrency with row-level locking
-- Automatically increments version_number and sets is_current
CREATE OR REPLACE FUNCTION create_workflow_version(
  p_thread_id TEXT,
  p_conversation_id UUID,
  p_content JSONB,
  p_source TEXT,
  p_feedback TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS workflow_content_versions AS $$
DECLARE
  v_next_version INTEGER;
  v_result workflow_content_versions;
BEGIN
  -- Lock existing versions for this thread
  PERFORM 1 FROM workflow_content_versions
    WHERE thread_id = p_thread_id
    FOR UPDATE;

  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM workflow_content_versions
    WHERE thread_id = p_thread_id;

  -- Unset previous current
  UPDATE workflow_content_versions
    SET is_current = false
    WHERE thread_id = p_thread_id AND is_current = true;

  -- Insert new version as current
  INSERT INTO workflow_content_versions (
    thread_id, conversation_id, version_number,
    content, source, feedback, is_current, created_by
  ) VALUES (
    p_thread_id, p_conversation_id, v_next_version,
    p_content, p_source, p_feedback, true, p_created_by
  ) RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

---

## Task 2: Transport Types

### 2.1 Add HITL Types

**File**: `libs/transport-types/src/hitl.types.ts`

```typescript
/**
 * HITL (Human-in-the-Loop) Transport Types
 *
 * These types define the contract between frontend, API, and LangGraph
 * for HITL operations.
 */

// Decision types - what the human can do
export type HitlDecision = 'approve' | 'reject' | 'regenerate' | 'replace' | 'skip';

// Status of an HITL workflow
export type HitlStatus = 'started' | 'generating' | 'pending_review' | 'processing' | 'completed' | 'rejected' | 'failed';

// Generic generated content structure
export interface HitlGeneratedContent {
  [key: string]: unknown;
  // Common fields for extended-post-writer
  blogPost?: string;
  seoDescription?: string;
  socialPosts?: string[];
}

// Version tracking
export interface WorkflowContentVersion {
  id: string;
  threadId: string;
  versionNumber: number;
  content: HitlGeneratedContent;
  source: 'ai_generated' | 'ai_regenerated' | 'user_replaced';
  feedback?: string;
  isCurrent: boolean;
  createdAt: string;
  createdBy?: string;
}

// === Request Payloads ===

export interface HitlResumePayload {
  action: 'resume';
  threadId: string;
  decision: HitlDecision;
  feedback?: string;           // For REGENERATE
  content?: HitlGeneratedContent;  // For REPLACE
}

export interface HitlStatusPayload {
  action: 'status';
  threadId: string;
}

export interface HitlHistoryPayload {
  action: 'history';
  threadId: string;
  limit?: number;
}

// === Response Payloads ===

export interface HitlPendingPayload {
  threadId: string;
  status: 'pending_review';
  currentContent: HitlGeneratedContent;
  contentVersions: WorkflowContentVersion[];
  topic?: string;
  message: string;
  nodeName?: string;  // Which node triggered the HITL
}

export interface HitlCompletedPayload {
  threadId: string;
  status: 'completed';
  finalContent: HitlGeneratedContent;
  contentVersions: WorkflowContentVersion[];
  duration?: number;
}

export interface HitlRejectedPayload {
  threadId: string;
  status: 'rejected';
  feedback?: string;
  duration?: number;
}

// === Request Metadata ===

export interface HitlRequestMetadata {
  source: 'web-ui' | 'api' | 'agent';
  userId: string;
  conversationId: string;
  organizationSlug: string;
  originalTaskId?: string;
}
```

### 2.2 Export from Index

**File**: `libs/transport-types/src/index.ts` (add export)

```typescript
export * from './hitl.types';
```

---

## Task 3: WorkflowVersionsService

### 3.1 Create Service

**File**: `apps/api/src/agent2agent/services/workflow-versions.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  WorkflowContentVersion,
  HitlGeneratedContent
} from '@orchestrator-ai/transport-types';

@Injectable()
export class WorkflowVersionsService {
  private readonly logger = new Logger(WorkflowVersionsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Create a new version (auto-increments version_number, sets as current)
   * Uses database function for atomic operation
   */
  async createVersion(
    threadId: string,
    conversationId: string | undefined,
    content: HitlGeneratedContent,
    source: 'ai_generated' | 'ai_regenerated' | 'user_replaced',
    feedback?: string,
    userId?: string,
  ): Promise<WorkflowContentVersion> {
    this.logger.log(`Creating version for thread ${threadId}, source: ${source}`);

    const { data, error } = await this.supabase.client.rpc('create_workflow_version', {
      p_thread_id: threadId,
      p_conversation_id: conversationId || null,
      p_content: content,
      p_source: source,
      p_feedback: feedback || null,
      p_created_by: userId || null,
    });

    if (error) {
      this.logger.error(`Failed to create version: ${error.message}`);
      throw new Error(`Failed to create version: ${error.message}`);
    }

    return this.mapToVersion(data);
  }

  /**
   * Get all versions for a thread (ordered by version_number ASC)
   */
  async getVersions(threadId: string): Promise<WorkflowContentVersion[]> {
    const { data, error } = await this.supabase.client
      .from('workflow_content_versions')
      .select('*')
      .eq('thread_id', threadId)
      .order('version_number', { ascending: true });

    if (error) {
      this.logger.error(`Failed to get versions: ${error.message}`);
      throw new Error(`Failed to get versions: ${error.message}`);
    }

    return (data || []).map(this.mapToVersion);
  }

  /**
   * Get current version (is_current = true)
   */
  async getCurrentVersion(threadId: string): Promise<WorkflowContentVersion | null> {
    const { data, error } = await this.supabase.client
      .from('workflow_content_versions')
      .select('*')
      .eq('thread_id', threadId)
      .eq('is_current', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No rows found
      }
      this.logger.error(`Failed to get current version: ${error.message}`);
      throw new Error(`Failed to get current version: ${error.message}`);
    }

    return data ? this.mapToVersion(data) : null;
  }

  /**
   * Get specific version by number
   */
  async getVersionByNumber(
    threadId: string,
    versionNumber: number,
  ): Promise<WorkflowContentVersion | null> {
    const { data, error } = await this.supabase.client
      .from('workflow_content_versions')
      .select('*')
      .eq('thread_id', threadId)
      .eq('version_number', versionNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get version: ${error.message}`);
    }

    return data ? this.mapToVersion(data) : null;
  }

  /**
   * Promote a historical version to current
   */
  async promoteVersion(threadId: string, versionNumber: number): Promise<void> {
    this.logger.log(`Promoting version ${versionNumber} for thread ${threadId}`);

    // Unset all is_current for this thread
    const { error: unsetError } = await this.supabase.client
      .from('workflow_content_versions')
      .update({ is_current: false })
      .eq('thread_id', threadId);

    if (unsetError) {
      throw new Error(`Failed to unset current: ${unsetError.message}`);
    }

    // Set the specified version as current
    const { error: setError } = await this.supabase.client
      .from('workflow_content_versions')
      .update({ is_current: true })
      .eq('thread_id', threadId)
      .eq('version_number', versionNumber);

    if (setError) {
      throw new Error(`Failed to set current: ${setError.message}`);
    }
  }

  /**
   * Get version count for a thread
   */
  async getVersionCount(threadId: string): Promise<number> {
    const { count, error } = await this.supabase.client
      .from('workflow_content_versions')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', threadId);

    if (error) {
      throw new Error(`Failed to get version count: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Delete versions for a thread (for cleanup)
   */
  async deleteVersions(threadId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('workflow_content_versions')
      .delete()
      .eq('thread_id', threadId);

    if (error) {
      throw new Error(`Failed to delete versions: ${error.message}`);
    }
  }

  /**
   * Map database row to WorkflowContentVersion
   */
  private mapToVersion(row: Record<string, unknown>): WorkflowContentVersion {
    return {
      id: row.id as string,
      threadId: row.thread_id as string,
      versionNumber: row.version_number as number,
      content: row.content as HitlGeneratedContent,
      source: row.source as 'ai_generated' | 'ai_regenerated' | 'user_replaced',
      feedback: row.feedback as string | undefined,
      isCurrent: row.is_current as boolean,
      createdAt: row.created_at as string,
      createdBy: row.created_by as string | undefined,
    };
  }
}
```

### 3.2 Create Module

**File**: `apps/api/src/agent2agent/services/workflow-versions.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { WorkflowVersionsService } from './workflow-versions.service';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [WorkflowVersionsService],
  exports: [WorkflowVersionsService],
})
export class WorkflowVersionsModule {}
```

### 3.3 Add to Agent2Agent Module

Update `apps/api/src/agent2agent/agent2agent.module.ts` to import WorkflowVersionsModule.

---

## Task 4: Base HITL State Annotation

### 4.1 Create Base State

**File**: `apps/langgraph/src/hitl/hitl-base.state.ts`

```typescript
import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type {
  WorkflowContentVersion,
  HitlDecision,
  HitlStatus,
} from '@orchestrator-ai/transport-types';

/**
 * Base state annotation for all HITL-capable workflows.
 * Individual agents extend this with their domain-specific fields.
 *
 * This provides:
 * - Task identification (taskId, threadId, userId, etc.)
 * - LLM configuration (provider, model)
 * - HITL state (decision, feedback, pending status)
 * - Version tracking (hydrated from database)
 * - Workflow status (status, error, timing)
 */
export const HitlBaseStateAnnotation = Annotation.Root({
  // Include message history from LangGraph
  ...MessagesAnnotation.spec,

  // === Task Identification ===
  taskId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  threadId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  userId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  conversationId: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  organizationSlug: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // === LLM Configuration ===
  provider: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'ollama',
  }),
  model: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'llama3.2:1b',
  }),

  // === HITL State ===
  hitlDecision: Annotation<HitlDecision | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  hitlFeedback: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  hitlPending: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  // Track which node triggered HITL (for serialized HITL)
  hitlNodeName: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // === Version Tracking (hydrated from DB) ===
  contentVersions: Annotation<WorkflowContentVersion[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  currentVersionNumber: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  // === Workflow Status ===
  status: Annotation<HitlStatus>({
    reducer: (_, next) => next,
    default: () => 'started',
  }),
  error: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  startedAt: Annotation<number>({
    reducer: (_, next) => next,
    default: () => Date.now(),
  }),
  completedAt: Annotation<number | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

export type HitlBaseState = typeof HitlBaseStateAnnotation.State;

/**
 * Helper to check if state extends HitlBaseState
 */
export function isHitlState(state: unknown): state is HitlBaseState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'taskId' in state &&
    'threadId' in state &&
    'hitlDecision' in state
  );
}
```

### 4.2 Create Index Export

**File**: `apps/langgraph/src/hitl/index.ts`

```typescript
export * from './hitl-base.state';
```

---

## Task 5: WorkflowVersionsHydrator Service

### 5.1 Create Hydrator Service

**File**: `apps/langgraph/src/persistence/workflow-versions-hydrator.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { WorkflowContentVersion, HitlGeneratedContent } from '@orchestrator-ai/transport-types';

/**
 * WorkflowVersionsHydrator
 *
 * Automatic version hydration/persistence for LangGraph workflows.
 * Works alongside PostgresCheckpointer - when checkpoint is loaded,
 * versions can be hydrated into state.
 *
 * This service is used by the createHitlWorkflow factory to automatically
 * manage version history without individual agents needing to implement it.
 */
@Injectable()
export class WorkflowVersionsHydratorService {
  private readonly logger = new Logger(WorkflowVersionsHydratorService.name);
  private readonly supabase: SupabaseClient;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:6012';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Hydrate versions from database for a thread
   */
  async hydrateVersions(threadId: string): Promise<WorkflowContentVersion[]> {
    this.logger.debug(`Hydrating versions for thread: ${threadId}`);

    const { data, error } = await this.supabase
      .from('workflow_content_versions')
      .select('*')
      .eq('thread_id', threadId)
      .order('version_number', { ascending: true });

    if (error) {
      this.logger.error(`Failed to hydrate versions: ${error.message}`);
      return [];
    }

    return (data || []).map(this.mapToVersion);
  }

  /**
   * Persist a new version to database
   */
  async persistVersion(
    threadId: string,
    conversationId: string | undefined,
    content: HitlGeneratedContent,
    source: 'ai_generated' | 'ai_regenerated' | 'user_replaced',
    feedback?: string,
    userId?: string,
  ): Promise<WorkflowContentVersion> {
    this.logger.debug(`Persisting version for thread: ${threadId}, source: ${source}`);

    const { data, error } = await this.supabase.rpc('create_workflow_version', {
      p_thread_id: threadId,
      p_conversation_id: conversationId || null,
      p_content: content,
      p_source: source,
      p_feedback: feedback || null,
      p_created_by: userId || null,
    });

    if (error) {
      this.logger.error(`Failed to persist version: ${error.message}`);
      throw new Error(`Failed to persist version: ${error.message}`);
    }

    return this.mapToVersion(data);
  }

  /**
   * Get the current version number for a thread
   */
  async getCurrentVersionNumber(threadId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('workflow_content_versions')
      .select('version_number')
      .eq('thread_id', threadId)
      .eq('is_current', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return 0; // No versions yet
      }
      this.logger.error(`Failed to get current version: ${error.message}`);
      return 0;
    }

    return data?.version_number || 0;
  }

  /**
   * Check if content has changed (for detecting version-worthy changes)
   */
  hasContentChanged(
    prevContent: HitlGeneratedContent | undefined,
    newContent: HitlGeneratedContent | undefined,
  ): boolean {
    if (!prevContent && !newContent) return false;
    if (!prevContent || !newContent) return true;

    // Deep compare using JSON stringify (simple but effective)
    return JSON.stringify(prevContent) !== JSON.stringify(newContent);
  }

  /**
   * Map database row to WorkflowContentVersion
   */
  private mapToVersion(row: Record<string, unknown>): WorkflowContentVersion {
    return {
      id: row.id as string,
      threadId: row.thread_id as string,
      versionNumber: row.version_number as number,
      content: row.content as HitlGeneratedContent,
      source: row.source as 'ai_generated' | 'ai_regenerated' | 'user_replaced',
      feedback: row.feedback as string | undefined,
      isCurrent: row.is_current as boolean,
      createdAt: row.created_at as string,
      createdBy: row.created_by as string | undefined,
    };
  }
}
```

### 5.2 Add to Shared Services Module

Update `apps/langgraph/src/services/shared-services.module.ts`:

```typescript
import { WorkflowVersionsHydratorService } from '../persistence/workflow-versions-hydrator.service';

@Module({
  providers: [
    // ... existing providers
    WorkflowVersionsHydratorService,
  ],
  exports: [
    // ... existing exports
    WorkflowVersionsHydratorService,
  ],
})
export class SharedServicesModule {}
```

---

## Success Criteria

1. [ ] Database migration applied successfully
2. [ ] `create_workflow_version` function works (test with manual INSERT)
3. [ ] Transport types compile without errors
4. [ ] WorkflowVersionsService can create/read versions
5. [ ] HitlBaseStateAnnotation is importable in LangGraph
6. [ ] WorkflowVersionsHydratorService can hydrate/persist versions
7. [ ] All tests pass: `npm run test`
8. [ ] Build passes: `npm run build`

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `apps/api/supabase/migrations/YYYYMMDD_create_workflow_content_versions.sql` | Version tracking table + function |
| `libs/transport-types/src/hitl.types.ts` | HITL type definitions |
| `apps/api/src/agent2agent/services/workflow-versions.service.ts` | Version CRUD operations |
| `apps/api/src/agent2agent/services/workflow-versions.module.ts` | NestJS module |
| `apps/langgraph/src/hitl/hitl-base.state.ts` | Base state annotation |
| `apps/langgraph/src/hitl/index.ts` | Barrel export |
| `apps/langgraph/src/persistence/workflow-versions-hydrator.service.ts` | Version hydration for LangGraph |

### Modified Files
| File | Changes |
|------|---------|
| `libs/transport-types/src/index.ts` | Add export for hitl.types |
| `apps/api/src/agent2agent/agent2agent.module.ts` | Import WorkflowVersionsModule |
| `apps/langgraph/src/services/shared-services.module.ts` | Add WorkflowVersionsHydratorService |

---

## Next Session
Session 2 will implement the `createHitlWorkflow` factory and refactor extended-post-writer to use it.
