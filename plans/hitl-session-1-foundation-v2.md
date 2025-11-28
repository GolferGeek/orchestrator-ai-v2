# HITL Refactoring Session 1: Foundation (v2 - Deliverable-Centric)

## Goal
Establish the foundation for deliverable-based HITL with modal UI architecture. Create database schema, transport types, LangGraph base state, and shared component interfaces.

## Prerequisites
- Supabase running locally
- LangGraph service running
- API service running

---

## Overview

This session establishes:
1. Database migration for `hitl_pending` columns
2. Updated HITL transport types (use `taskId`, reference deliverables, add `HitlPendingItem`)
3. Simplified HitlBaseStateAnnotation (use `taskId`, no version tracking)
4. Shared component interface definitions
5. Updated frontend hitlService.ts to use A2A JSON-RPC methods

**Key Principles**:
- Use existing `DeliverablesService` and `DeliverableVersionsService` - no new version tracking
- Use `taskId` consistently (LangGraph uses it as `thread_id` internally)
- No separate HITL controller - use existing A2A endpoint
- Modal-based UI - single pane + modals, no two-pane layout
- Shared components between HITL and Deliverables modals

---

## Task 1: Database Migration for hitl_pending on Tasks Table

### 1.1 Create Migration File

**File**: `apps/api/supabase/migrations/YYYYMMDD_add_hitl_pending_to_tasks.sql`

```sql
-- Add HITL pending tracking to TASKS (not conversations)
-- This is future-proof for multiple tasks per conversation
-- Task already knows its agent via agent_slug

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS hitl_pending BOOLEAN DEFAULT false;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS hitl_pending_since TIMESTAMP WITH TIME ZONE;

-- Link deliverables to their creating task
-- This allows us to find the deliverable for a task directly
ALTER TABLE deliverables
ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id);

-- Index for efficient pending query
CREATE INDEX IF NOT EXISTS idx_tasks_hitl_pending
ON tasks (hitl_pending, hitl_pending_since DESC)
WHERE hitl_pending = true;

-- Index for finding deliverables by task
CREATE INDEX IF NOT EXISTS idx_deliverables_task_id
ON deliverables (task_id)
WHERE task_id IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN tasks.hitl_pending IS 'True when this task has a pending HITL review';
COMMENT ON COLUMN tasks.hitl_pending_since IS 'Timestamp when HITL became pending (for ordering)';
COMMENT ON COLUMN deliverables.task_id IS 'Task that created this deliverable (for HITL tracking)';
```

### 1.2 Backfill Existing Deliverables

**IMPORTANT**: Existing deliverables need `task_id` populated to avoid being orphaned from the new query paths.

**File**: `apps/api/supabase/migrations/YYYYMMDD_backfill_deliverable_task_ids.sql`

```sql
-- Backfill task_id for existing deliverables
-- Strategy: Link each deliverable to the most recent task for its conversation
-- This assumes 1:1 conversation:task relationship (current state)

-- First, create a temp table mapping conversation_id -> latest task_id
CREATE TEMP TABLE conversation_task_mapping AS
SELECT DISTINCT ON (conversation_id)
  conversation_id,
  id as task_id
FROM tasks
ORDER BY conversation_id, created_at DESC;

-- Update deliverables with null task_id
UPDATE deliverables d
SET task_id = ctm.task_id
FROM conversation_task_mapping ctm
WHERE d.conversation_id = ctm.conversation_id
  AND d.task_id IS NULL;

-- Log orphaned deliverables (conversations with no tasks)
-- These would be from before task tracking was implemented
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM deliverables
  WHERE task_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE NOTICE 'WARNING: % deliverables have no matching task (legacy data)', orphan_count;
  END IF;
END $$;

-- Clean up
DROP TABLE conversation_task_mapping;
```

**Handling Orphaned Deliverables**:
- Deliverables without a matching task are from legacy data before task tracking
- These will NOT appear in `findByTaskId` queries (expected)
- They WILL still appear in `findByConversationId` queries (backward compatible)
- The `task_id` column is nullable to accommodate this

### 1.3 Verify Migration

After applying:
```sql
-- Verify columns exist on tasks
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name IN ('hitl_pending', 'hitl_pending_since');

-- Verify task_id column on deliverables
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'deliverables'
  AND column_name = 'task_id';

-- Verify indexes exist
SELECT indexname FROM pg_indexes
WHERE indexname IN ('idx_tasks_hitl_pending', 'idx_deliverables_task_id');
```

---

## Task 2: HITL Transport Types Updates

### 2.1 Update HITL Types to Use taskId and Reference Deliverables

**File**: `apps/transport-types/modes/hitl.types.ts`

Update existing types and add new ones:

```typescript
// ============================================================================
// HITL Decision & Status (existing, keep as-is)
// ============================================================================

export type HitlDecision = 'approve' | 'reject' | 'regenerate' | 'replace' | 'skip';

export type HitlStatus =
  | 'started'
  | 'generating'
  | 'hitl_waiting'
  | 'regenerating'
  | 'completed'
  | 'failed';

// ============================================================================
// Generated Content Structure (existing, keep as-is)
// ============================================================================

export interface HitlGeneratedContent {
  blogPost?: string;
  seoDescription?: string;
  socialPosts?: string[];
  // Extensible for other content types
  [key: string]: unknown;
}

// ============================================================================
// NEW: Deliverable-Based Response Types
// ============================================================================

/**
 * HITL Response with Deliverable (returned by API to frontend)
 * Used when workflow hits interrupt() and returns for review
 */
export interface HitlDeliverableResponse {
  /** Task ID for resuming (used as LangGraph thread_id) */
  taskId: string;
  /** Conversation ID */
  conversationId: string;
  /** Current HITL status */
  status: HitlStatus;
  /** Deliverable ID */
  deliverableId: string;
  /** Current version number */
  currentVersionNumber: number;
  /** Message for the user */
  message: string;
  /** Topic/subject */
  topic?: string;
  /** Agent that generated this */
  agentSlug?: string;
  /** Node that triggered HITL (for serialized HITL) */
  nodeName?: string;
  /** Generated content for immediate display */
  generatedContent: HitlGeneratedContent;
}

/**
 * HITL Resume Request (from frontend to API via A2A endpoint)
 */
export interface HitlResumeRequest {
  /** Task ID to resume */
  taskId: string;
  /** User's decision */
  decision: HitlDecision;
  /** Feedback for regeneration (required if decision is 'regenerate') */
  feedback?: string;
  /** Replacement content (required if decision is 'replace') */
  content?: HitlGeneratedContent;
}

/**
 * HITL Status Response
 */
export interface HitlStatusResponse {
  /** Task ID */
  taskId: string;
  /** Current status */
  status: HitlStatus;
  /** Whether HITL is pending review */
  hitlPending: boolean;
  /** Deliverable ID (if exists) */
  deliverableId?: string;
  /** Current version number */
  currentVersionNumber?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * HITL History Response (uses deliverable versions)
 */
export interface HitlHistoryResponse {
  /** Task ID */
  taskId: string;
  /** Deliverable ID */
  deliverableId: string;
  /** Total version count */
  versionCount: number;
  /** Current version number */
  currentVersionNumber: number;
}

// ============================================================================
// NEW: HITL Pending List Types (for sidebar)
// ============================================================================

/**
 * Single item in the HITL pending list (sidebar)
 * Note: taskId is the PRIMARY identifier since hitl_pending is on tasks table
 */
export interface HitlPendingItem {
  /** Task ID - primary identifier for resuming */
  taskId: string;
  /** Agent slug that generated this (from task) */
  agentSlug: string;
  /** When HITL became pending (from task.hitl_pending_since) */
  pendingSince: string;
  /** Conversation ID (for navigation) */
  conversationId: string;
  /** Conversation title */
  conversationTitle: string;
  /** Deliverable ID (if exists) */
  deliverableId?: string;
  /** Deliverable title (if exists) */
  deliverableTitle?: string;
  /** Current version number */
  currentVersionNumber?: number;
  /** Agent display name */
  agentName?: string;
  /** Topic/subject */
  topic?: string;
}

/**
 * Response for hitl.pending query
 */
export interface HitlPendingListResponse {
  /** List of pending HITL items */
  items: HitlPendingItem[];
  /** Total count */
  totalCount: number;
}

// ============================================================================
// UPDATE: Payload Types (use taskId instead of threadId)
// ============================================================================

export interface HitlResumePayload {
  action: 'resume';
  taskId: string;  // Changed from threadId
  decision: HitlDecision;
  editedContent?: Partial<HitlGeneratedContent>;
  feedback?: string;
}

export interface HitlStatusPayload {
  action: 'status';
  taskId: string;  // Changed from threadId
}

export interface HitlHistoryPayload {
  action: 'history';
  taskId: string;  // Changed from threadId
}

export interface HitlPendingPayload {
  action: 'pending';
  // No additional params - queries for current user
}

// ============================================================================
// LangGraph Response Structure (for API Runner detection)
// ============================================================================

/**
 * LangGraph interrupt response structure
 * This is what LangGraph returns when interrupt() is called
 */
export interface LangGraphInterruptValue {
  reason: string;           // 'human_review'
  nodeName: string;         // Node that called interrupt
  content: HitlGeneratedContent;
  message: string;          // User-facing message
  topic?: string;
}

export interface LangGraphInterruptItem {
  value: LangGraphInterruptValue;
  resumable: boolean;       // Always true for HITL
  ns: string[];             // Namespace
}

export interface LangGraphInterruptResponse {
  /** Present when interrupt() was called */
  __interrupt__: LangGraphInterruptItem[];
  /** Current state values */
  values: Record<string, unknown>;
}

/**
 * Type guard for LangGraph interrupt response
 */
export function isLangGraphInterruptResponse(
  response: unknown
): response is LangGraphInterruptResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    '__interrupt__' in response &&
    Array.isArray((response as LangGraphInterruptResponse).__interrupt__) &&
    (response as LangGraphInterruptResponse).__interrupt__.length > 0
  );
}
```

### 2.2 Export New Types

**File**: `apps/transport-types/index.ts`

Update HITL Mode exports:
```typescript
// HITL Mode
export type {
  HitlDecision,
  HitlStatus,
  HitlGeneratedContent,
  // Deliverable-based types
  HitlDeliverableResponse,
  HitlResumeRequest,
  HitlStatusResponse,
  HitlHistoryResponse,
  // Pending list types
  HitlPendingItem,
  HitlPendingListResponse,
  // Payload types
  HitlResumePayload,
  HitlStatusPayload,
  HitlHistoryPayload,
  HitlPendingPayload,
  // LangGraph types
  LangGraphInterruptValue,
  LangGraphInterruptItem,
  LangGraphInterruptResponse,
} from './modes/hitl.types';

export { isLangGraphInterruptResponse } from './modes/hitl.types';
```

---

## Task 3: Simplified HitlBaseStateAnnotation

### 3.1 Create Base State (taskId, No Version Tracking)

**File**: `apps/langgraph/src/hitl/hitl-base.state.ts`

```typescript
import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { HitlDecision, HitlStatus } from '@orchestrator-ai/transport-types';

/**
 * Base state annotation for all HITL-capable workflows.
 * Individual agents extend this with their domain-specific fields.
 *
 * KEY DESIGN DECISIONS:
 * 1. Uses `taskId` consistently (passed to LangGraph as thread_id config)
 * 2. NO version tracking in state - API Runner handles via DeliverablesService
 * 3. NO direct DB access from LangGraph - framework-agnostic
 * 4. HITL state (pending, decision, feedback) stored here for checkpointer
 */
export const HitlBaseStateAnnotation = Annotation.Root({
  // Include message history from LangGraph
  ...MessagesAnnotation.spec,

  // === Task Identification ===
  // taskId is THE identifier - passed to LangGraph as thread_id config
  taskId: Annotation<string>({
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
  // These are stored in LangGraph checkpointer - no separate table needed
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
    'hitlDecision' in state &&
    'hitlPending' in state
  );
}
```

### 3.2 Create Index Export

**File**: `apps/langgraph/src/hitl/index.ts`

```typescript
export * from './hitl-base.state';
```

---

## Task 4: Shared Component Interfaces

### 4.1 Define Shared Component Props Types

**File**: `apps/web/src/components/shared/types.ts`

```typescript
import type { DeliverableVersion } from '@/services/deliverablesService';

// ============================================================================
// ContentViewer Props
// ============================================================================

export interface ContentViewerProps {
  /** Blog post content (markdown) */
  blogPost?: string;
  /** SEO description */
  seoDescription?: string;
  /** Social media posts */
  socialPosts?: string[];
  /** Which tab to show initially */
  initialTab?: 'blog' | 'seo' | 'social';
  /** Whether content is loading */
  loading?: boolean;
}

// ============================================================================
// ContentEditor Props
// ============================================================================

export interface ContentEditorProps {
  /** Blog post content (markdown) */
  blogPost?: string;
  /** SEO description */
  seoDescription?: string;
  /** Social media posts (joined by newlines) */
  socialPosts?: string;
  /** Which tab to show initially */
  initialTab?: 'blog' | 'seo' | 'social';
  /** Whether editing is disabled */
  disabled?: boolean;
}

export interface ContentEditorEmits {
  /** Emitted when content changes */
  (e: 'update:blogPost', value: string): void;
  (e: 'update:seoDescription', value: string): void;
  (e: 'update:socialPosts', value: string): void;
  /** Emitted when any content changes (for dirty checking) */
  (e: 'change'): void;
}

// ============================================================================
// VersionSelector Props
// ============================================================================

export interface VersionSelectorProps {
  /** List of versions */
  versions: DeliverableVersion[];
  /** Currently selected version ID */
  selectedVersionId?: string;
  /** Whether to show the comparison toggle */
  showCompareToggle?: boolean;
  /** Whether versions are loading */
  loading?: boolean;
}

export interface VersionSelectorEmits {
  /** Emitted when a version is selected */
  (e: 'select', version: DeliverableVersion): void;
  /** Emitted when compare mode is toggled */
  (e: 'compare', enabled: boolean): void;
}

// ============================================================================
// VersionBadge Props
// ============================================================================

export type VersionCreationType =
  | 'ai_response'
  | 'manual_edit'
  | 'ai_enhancement'
  | 'user_request'
  | 'llm_rerun';

export interface VersionBadgeProps {
  /** Version number */
  versionNumber: number;
  /** How this version was created */
  creationType: VersionCreationType;
  /** Whether this is the current version */
  isCurrent?: boolean;
  /** Size variant */
  size?: 'small' | 'medium';
}

// ============================================================================
// FeedbackInput Props
// ============================================================================

export interface FeedbackInputProps {
  /** Current feedback value */
  modelValue: string;
  /** Placeholder text */
  placeholder?: string;
  /** Label text */
  label?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Whether feedback is required (shows validation) */
  required?: boolean;
  /** Maximum character count */
  maxLength?: number;
}

export interface FeedbackInputEmits {
  (e: 'update:modelValue', value: string): void;
}

// ============================================================================
// Card Props (for conversation history)
// ============================================================================

export interface HitlPendingCardProps {
  /** Task ID for resuming */
  taskId: string;
  /** Topic/title */
  topic: string;
  /** Current version number */
  versionNumber: number;
  /** Agent slug */
  agentSlug: string;
  /** When HITL became pending */
  pendingSince: string;
}

export interface HitlPendingCardEmits {
  (e: 'review'): void;
}

export interface DeliverableCardProps {
  /** Deliverable ID */
  deliverableId: string;
  /** Title */
  title: string;
  /** Current version number */
  currentVersionNumber: number;
  /** How current version was created */
  creationType: VersionCreationType;
  /** When deliverable was last updated */
  updatedAt: string;
}

export interface DeliverableCardEmits {
  (e: 'view'): void;
}
```

### 4.2 Create Shared Components Index

**File**: `apps/web/src/components/shared/index.ts`

```typescript
// Types
export * from './types';

// Components (to be implemented in Session 3)
// export { default as ContentViewer } from './ContentViewer.vue';
// export { default as ContentEditor } from './ContentEditor.vue';
// export { default as VersionSelector } from './VersionSelector.vue';
// export { default as VersionBadge } from './VersionBadge.vue';
// export { default as FeedbackInput } from './FeedbackInput.vue';
```

---

## Task 5: Update Frontend hitlService to Use A2A JSON-RPC

### 5.1 Update hitlService.ts

**File**: `apps/web/src/services/hitlService.ts`

```typescript
import { apiClient } from './apiClient';
import type {
  HitlDecision,
  HitlDeliverableResponse,
  HitlResumeRequest,
  HitlStatusResponse,
  HitlHistoryResponse,
  HitlPendingListResponse,
  HitlGeneratedContent,
} from '@orchestrator-ai/transport-types';

/**
 * JSON-RPC request structure for A2A endpoint
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
  id: number;
}

/**
 * JSON-RPC response structure
 */
interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  result?: {
    success: boolean;
    payload: T;
  };
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

/**
 * HITL Service
 *
 * All HITL operations go through the A2A endpoint using JSON-RPC methods:
 * - hitl.resume: Resume workflow with decision
 * - hitl.status: Get current HITL status
 * - hitl.history: Get version history
 * - hitl.pending: Get all pending HITL reviews for user
 */
class HitlService {
  private requestId = 0;

  /**
   * Build A2A endpoint URL
   */
  private getEndpoint(organizationSlug: string, agentSlug: string): string {
    return `/agent-to-agent/${organizationSlug}/${agentSlug}/tasks`;
  }

  /**
   * Send JSON-RPC request to A2A endpoint
   */
  private async sendJsonRpc<T>(
    organizationSlug: string,
    agentSlug: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const endpoint = this.getEndpoint(organizationSlug, agentSlug);

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++this.requestId,
    };

    const response = await apiClient.post<JsonRpcResponse<T>>(endpoint, request);

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    if (!response.data.result?.success) {
      throw new Error('HITL request failed');
    }

    return response.data.result.payload;
  }

  /**
   * Resume HITL workflow with a decision
   */
  async resume(
    organizationSlug: string,
    agentSlug: string,
    request: HitlResumeRequest
  ): Promise<HitlDeliverableResponse> {
    return this.sendJsonRpc<HitlDeliverableResponse>(
      organizationSlug,
      agentSlug,
      'hitl.resume',
      {
        taskId: request.taskId,
        decision: request.decision,
        feedback: request.feedback,
        content: request.content,
      }
    );
  }

  /**
   * Approve current content and continue workflow
   */
  async approve(
    organizationSlug: string,
    agentSlug: string,
    taskId: string
  ): Promise<HitlDeliverableResponse> {
    return this.resume(organizationSlug, agentSlug, {
      taskId,
      decision: 'approve',
    });
  }

  /**
   * Regenerate content with feedback
   */
  async regenerate(
    organizationSlug: string,
    agentSlug: string,
    taskId: string,
    feedback: string
  ): Promise<HitlDeliverableResponse> {
    return this.resume(organizationSlug, agentSlug, {
      taskId,
      decision: 'regenerate',
      feedback,
    });
  }

  /**
   * Replace content with user-provided content
   */
  async replace(
    organizationSlug: string,
    agentSlug: string,
    taskId: string,
    content: HitlGeneratedContent
  ): Promise<HitlDeliverableResponse> {
    return this.resume(organizationSlug, agentSlug, {
      taskId,
      decision: 'replace',
      content,
    });
  }

  /**
   * Reject current content and regenerate from scratch
   */
  async reject(
    organizationSlug: string,
    agentSlug: string,
    taskId: string
  ): Promise<HitlDeliverableResponse> {
    return this.resume(organizationSlug, agentSlug, {
      taskId,
      decision: 'reject',
    });
  }

  /**
   * Skip this review point (auto-approve)
   */
  async skip(
    organizationSlug: string,
    agentSlug: string,
    taskId: string
  ): Promise<HitlDeliverableResponse> {
    return this.resume(organizationSlug, agentSlug, {
      taskId,
      decision: 'skip',
    });
  }

  /**
   * Get current HITL status for a task
   */
  async getStatus(
    organizationSlug: string,
    agentSlug: string,
    taskId: string
  ): Promise<HitlStatusResponse> {
    return this.sendJsonRpc<HitlStatusResponse>(
      organizationSlug,
      agentSlug,
      'hitl.status',
      { taskId }
    );
  }

  /**
   * Get version history for a task's deliverable
   */
  async getHistory(
    organizationSlug: string,
    agentSlug: string,
    taskId: string
  ): Promise<HitlHistoryResponse> {
    return this.sendJsonRpc<HitlHistoryResponse>(
      organizationSlug,
      agentSlug,
      'hitl.history',
      { taskId }
    );
  }

  /**
   * Get all pending HITL reviews for current user
   * Note: This doesn't need agent-specific routing, but we use a default agent
   */
  async getPendingReviews(
    organizationSlug: string
  ): Promise<HitlPendingListResponse> {
    // Use a system agent or first available agent for this query
    // The backend will query across all conversations regardless of agent
    return this.sendJsonRpc<HitlPendingListResponse>(
      organizationSlug,
      '_system',  // Special slug for cross-agent queries
      'hitl.pending',
      {}
    );
  }
}

export const hitlService = new HitlService();
```

---

## Task 6: Create hitlPendingStore for Sidebar

### 6.1 Create Pinia Store

**File**: `apps/web/src/stores/hitlPendingStore.ts`

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { HitlPendingItem } from '@orchestrator-ai/transport-types';
import { hitlService } from '@/services/hitlService';
import { useAuthStore } from './authStore';

export const useHitlPendingStore = defineStore('hitlPending', () => {
  // State
  const items = ref<HitlPendingItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastFetched = ref<Date | null>(null);

  // Getters
  const count = computed(() => items.value.length);
  const hasItems = computed(() => items.value.length > 0);

  const sortedItems = computed(() => {
    return [...items.value].sort((a, b) => {
      // Sort by pending since, newest first
      return new Date(b.pendingSince).getTime() - new Date(a.pendingSince).getTime();
    });
  });

  // Actions
  async function fetchPendingReviews() {
    const authStore = useAuthStore();
    const orgSlug = authStore.currentOrganizationSlug;

    if (!orgSlug) {
      error.value = 'No organization selected';
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await hitlService.getPendingReviews(orgSlug);
      items.value = response.items;
      lastFetched.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch pending reviews';
      console.error('Failed to fetch HITL pending reviews:', e);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Add a new pending item (called when workflow returns HITL response)
   * Uses taskId as the key since hitl_pending is on tasks table
   */
  function addPendingItem(item: HitlPendingItem) {
    // Remove existing item for same task if present
    items.value = items.value.filter(i => i.taskId !== item.taskId);
    // Add new item
    items.value.push(item);
  }

  /**
   * Remove a pending item (called when user makes decision)
   * Uses taskId as the key
   */
  function removePendingItem(taskId: string) {
    items.value = items.value.filter(i => i.taskId !== taskId);
  }

  /**
   * Clear all items (e.g., on logout)
   */
  function clear() {
    items.value = [];
    lastFetched.value = null;
    error.value = null;
  }

  return {
    // State
    items,
    loading,
    error,
    lastFetched,
    // Getters
    count,
    hasItems,
    sortedItems,
    // Actions
    fetchPendingReviews,
    addPendingItem,
    removePendingItem,
    clear,
  };
});
```

---

## Success Criteria

1. [ ] Database migration applied: `hitl_pending` and `hitl_pending_since` columns on **tasks** table
2. [ ] Database migration applied: `task_id` column on **deliverables** table
3. [ ] HITL transport types updated with `taskId` (no `threadId`)
4. [ ] `HitlPendingItem` uses `taskId` as primary identifier
5. [ ] `LangGraphInterruptResponse` type and type guard added
6. [ ] HitlBaseStateAnnotation created with `taskId` (no version tracking)
7. [ ] Shared component interfaces defined in `apps/web/src/components/shared/types.ts`
8. [ ] Frontend hitlService.ts uses A2A JSON-RPC methods
9. [ ] hitlPendingStore uses `taskId` as key for add/remove operations
10. [ ] All tests pass: `npm run test`
11. [ ] Build passes: `npm run build`

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `apps/api/supabase/migrations/YYYYMMDD_add_hitl_pending_to_tasks.sql` | Add hitl_pending to tasks, task_id to deliverables |
| `apps/langgraph/src/hitl/hitl-base.state.ts` | Simplified base state with taskId |
| `apps/langgraph/src/hitl/index.ts` | Barrel export |
| `apps/web/src/components/shared/types.ts` | Shared component interfaces |
| `apps/web/src/components/shared/index.ts` | Shared components barrel export |
| `apps/web/src/stores/hitlPendingStore.ts` | Pinia store for pending list (taskId-keyed) |

### Modified Files
| File | Changes |
|------|---------|
| `apps/transport-types/modes/hitl.types.ts` | Use `taskId`, add deliverable response types, add pending list types, add LangGraph types |
| `apps/transport-types/index.ts` | Export new types |
| `apps/web/src/services/hitlService.ts` | Rewrite to use A2A JSON-RPC methods |

### Files NOT Created (Removed from Original Plan)
| File | Reason |
|------|--------|
| ~~`hitl.controller.ts`~~ | Use existing A2A endpoint |
| ~~`hitl.service.ts`~~ | Logic goes in API Runner (Session 2) |
| ~~`hitl.module.ts`~~ | No separate module needed |
| ~~`hitl_thread_states` migration~~ | Use LangGraph checkpointer |

---

## Next Session
Session 2 will add HITL method handling to the mode router and API Runner, including `__interrupt__` detection and `hitl_pending` flag updates.
