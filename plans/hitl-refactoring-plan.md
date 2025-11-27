# HITL Refactoring Plan: Canonical Human-in-the-Loop Pattern

## Executive Summary

Refactor HITL (Human-in-the-Loop) to create a canonical, repeatable pattern for all API agents:

1. **LangGraph's ONLY job**: Call `interrupt()` when content needs review, handle `Command(resume=...)` to continue
2. **API Agent Runner centralizes ALL decision logic**: All HITL decisions handled in one place
3. **Workflow Versions**: Track multiple content versions during HITL iterations
4. **Five Decision Types**: APPROVE, REJECT, REGENERATE, REPLACE, SKIP
5. **Two-Switch Architecture**: Switch on incoming request type, switch on response type

---

## Decision Types

| Decision | Description | AI Involved? | Creates Version? | Resume Payload |
|----------|-------------|--------------|------------------|----------------|
| **APPROVE** | Accept current content, continue to completion | No | No | `{ decision: 'approve' }` |
| **REJECT** | Discard current, regenerate from scratch | Yes | Yes | `{ decision: 'reject' }` |
| **REGENERATE** | AI creates new version using user's feedback | Yes | Yes | `{ decision: 'regenerate', feedback: string }` |
| **REPLACE** | User's exact edited content becomes the version | No | Yes | `{ decision: 'replace', content: object }` |
| **SKIP** | Auto-approve this review point, continue | No | No | `{ decision: 'skip' }` |

---

## Two-Switch Architecture

### Switch 1: Incoming Request Mode
```typescript
switch (request.method) {
  case 'tasks/send':           // Normal BUILD/CONVERSE request
  case 'hitl.resume':          // User made a decision
  case 'hitl.status':          // Query workflow status
  case 'hitl.history':         // Query version history
}
```

### Switch 2: Response from LangGraph
```typescript
if (response.hitlPending) {
  // LangGraph called interrupt() - return HITL response
  return buildHitlPendingResponse(response);
} else {
  // Normal completion - return BUILD response with deliverable
  return buildBuildResponse(response);
}
```

---

## Phase 1: Database & Types Setup

### 1.1 Create Migration: `workflow_content_versions` Table

**File**: `apps/api/supabase/migrations/YYYYMMDD_create_workflow_content_versions.sql`

```sql
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
```

### 1.2 Add Transport Types

**File**: `libs/transport-types/src/hitl.types.ts`

```typescript
// Decision types
export type HitlDecision = 'approve' | 'reject' | 'regenerate' | 'replace' | 'skip';

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
}

// Resume payloads for each decision type
export interface HitlResumePayload {
  action: 'resume';
  threadId: string;
  decision: HitlDecision;
  feedback?: string;           // For REGENERATE
  content?: HitlGeneratedContent;  // For REPLACE
}

// HITL pending response (includes version history)
export interface HitlPendingPayload {
  threadId: string;
  status: 'pending_review';
  currentContent: HitlGeneratedContent;
  contentVersions: WorkflowContentVersion[];
  topic: string;
  message: string;
}
```

### 1.3 Create WorkflowVersionsService (Complete Contract)

**File**: `apps/api/src/agent2agent/services/workflow-versions.service.ts`

```typescript
@Injectable()
export class WorkflowVersionsService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Create a new version (auto-increments version_number, sets as current)
   * Uses SELECT FOR UPDATE to handle concurrency
   */
  async createVersion(
    threadId: string,
    conversationId: string,
    content: HitlGeneratedContent,
    source: 'ai_generated' | 'ai_regenerated' | 'user_replaced',
    feedback?: string,
    userId?: string
  ): Promise<WorkflowContentVersion> {
    // Transaction: get next version number, unset previous current, insert new
    return this.supabase.rpc('create_workflow_version', {
      p_thread_id: threadId,
      p_conversation_id: conversationId,
      p_content: content,
      p_source: source,
      p_feedback: feedback,
      p_created_by: userId,
    });
  }

  // Get all versions for a thread (ordered by version_number ASC)
  async getVersions(threadId: string): Promise<WorkflowContentVersion[]>;

  // Get current version (is_current = true)
  async getCurrentVersion(threadId: string): Promise<WorkflowContentVersion | null>;

  // Get specific version by number
  async getVersionByNumber(threadId: string, versionNumber: number): Promise<WorkflowContentVersion | null>;

  // Promote a historical version to current (for "select older version" UX)
  async promoteVersion(threadId: string, versionNumber: number): Promise<void> {
    // Unset all is_current, set specified version as current
  }

  // Delete a version (optional - for cleanup)
  async deleteVersion(threadId: string, versionNumber: number): Promise<void>;

  // Get version count for a thread
  async getVersionCount(threadId: string): Promise<number>;
}
```

### 1.4 Version Lifecycle Rules

```
┌─────────────────────────────────────────────────────────────────┐
│                    VERSION LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CREATE: When LangGraph hits interrupt() with new content     │
│     - API Runner calls createVersion()                           │
│     - Auto-increments version_number (MAX + 1)                   │
│     - Sets is_current = true (unsets previous)                   │
│     - Handles concurrency via SELECT FOR UPDATE                  │
│                                                                  │
│  2. PROMOTE: When user selects an older version                  │
│     - API Runner calls promoteVersion(threadId, versionNumber)   │
│     - Sets that version as is_current = true                     │
│     - Does NOT delete other versions (history preserved)         │
│                                                                  │
│  3. QUERY: When building HITL response                           │
│     - getVersions() returns all versions (for UI selector)       │
│     - getCurrentVersion() returns the active one                 │
│                                                                  │
│  4. CLEANUP (optional): On workflow completion or abandonment    │
│     - Keep versions for audit trail, or                          │
│     - Delete after N days via scheduled job                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.5 Database Function for Atomic Version Creation

```sql
-- Handles concurrency with row-level locking
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

### 1.6 Create Module

**File**: `apps/api/src/agent2agent/services/workflow-versions.module.ts`

---

## Phase 2: LangGraph Hydrates Versions (Like Checkpoints)

### Design Principle: LangGraph Hydrates All State from Database

LangGraph already hydrates checkpoints from PostgreSQL. It should also hydrate versions from the same database. This keeps data access patterns consistent and gives LangGraph full context for decision routing.

**LangGraph responsibilities:**
- Hydrate checkpoint from PostgreSQL checkpointer
- Hydrate versions from `workflow_content_versions` table (same DB)
- Call `interrupt()` with current content AND version history
- Receive `Command(resume=...)` with decision
- Persist new versions when content is generated
- Route based on decision in state

**API Runner responsibilities:**
- Validate and authorize HITL requests
- Send resume to LangGraph
- Receive LangGraph response (includes versions)
- Build final response for frontend
- Handle errors

### 2.1 Update State Annotation (With Versions)

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.state.ts`

```typescript
// Versions ARE in state - hydrated from database like checkpoints
const ExtendedPostWriterAnnotation = Annotation.Root({
  // ... existing content fields (blogPost, seoDescription, socialPosts) ...

  // Decision from human (set by resume)
  hitlDecision: Annotation<HitlDecision | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Feedback from human (for REGENERATE)
  hitlFeedback: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Version history - hydrated from DB, updated by nodes
  contentVersions: Annotation<WorkflowContentVersion[]>({
    reducer: (_, next) => next,  // Replace on update (DB is source of truth)
    default: () => [],
  }),

  // Current version number
  currentVersionNumber: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
});
```

### 2.2 Automatic Version Hydration Service (Inherited by All HITL Workflows)

**Pattern:** Just like `PostgresCheckpointer` automatically hydrates/persists checkpoints, we create a `WorkflowVersionsHydrator` that automatically handles version hydration and persistence.

**Key Insight:** This is a **base service** that any HITL-capable workflow inherits. Individual agents (extended-post-writer, future agents) don't need to implement version handling - they just inherit it.

```
┌─────────────────────────────────────────────────────────────────┐
│                    INHERITANCE PATTERN                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LangGraph Base Services (shared by all workflows)               │
│  ├── PostgresCheckpointer    ← Checkpoints (existing)           │
│  └── WorkflowVersionsHydrator ← Versions (new)                  │
│                                                                  │
│  Extended Post Writer (specific agent)                           │
│  ├── Uses checkpointer automatically                             │
│  ├── Uses versions hydrator automatically                        │
│  └── Just defines nodes & edges - no version logic              │
│                                                                  │
│  Future HITL Agent (new agent)                                   │
│  ├── Uses checkpointer automatically                             │
│  ├── Uses versions hydrator automatically                        │
│  └── Just defines nodes & edges - no version logic              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**File**: `apps/langgraph/src/persistence/workflow-versions-hydrator.service.ts`

```typescript
/**
 * Automatic version hydration/persistence for LangGraph workflows.
 * Works alongside PostgresCheckpointer - when checkpoint is loaded,
 * versions are automatically hydrated into state.
 *
 * Usage: Wrap your graph with this service, it handles the rest.
 */
@Injectable()
export class WorkflowVersionsHydrator {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly checkpointer: PostgresCheckpointer,
  ) {}

  /**
   * Wraps a graph to add automatic version hydration/persistence
   */
  wrapGraph<T extends StateGraph>(graph: T): T {
    // Hook into checkpoint load to hydrate versions
    this.checkpointer.onCheckpointLoad(async (threadId, checkpoint) => {
      const versions = await this.hydrateVersions(threadId);
      return {
        ...checkpoint,
        state: {
          ...checkpoint.state,
          contentVersions: versions,
          currentVersionNumber: versions.length > 0
            ? Math.max(...versions.map(v => v.versionNumber))
            : 0,
        },
      };
    });

    // Hook into state changes to persist new versions
    graph.onStateChange(async (threadId, prevState, newState) => {
      // Detect if new content was generated (version-worthy change)
      if (this.isNewContent(prevState, newState)) {
        await this.persistVersion(threadId, newState);
      }
    });

    return graph;
  }

  private async hydrateVersions(threadId: string): Promise<WorkflowContentVersion[]> {
    const { data, error } = await this.supabase
      .from('workflow_content_versions')
      .select('*')
      .eq('thread_id', threadId)
      .order('version_number', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  private async persistVersion(threadId: string, state: GraphState): Promise<void> {
    const content = {
      blogPost: state.blogPost,
      seoDescription: state.seoDescription,
      socialPosts: state.socialPosts,
    };

    const source = state.hitlDecision === 'regenerate'
      ? 'ai_regenerated'
      : state.hitlDecision === 'replace'
        ? 'user_replaced'
        : 'ai_generated';

    await this.supabase.rpc('create_workflow_version', {
      p_thread_id: threadId,
      p_content: content,
      p_source: source,
      p_feedback: state.hitlFeedback,
    });
  }

  private isNewContent(prev: GraphState, next: GraphState): boolean {
    // Content changed and we're at an HITL checkpoint
    return (
      prev.blogPost !== next.blogPost ||
      prev.seoDescription !== next.seoDescription ||
      JSON.stringify(prev.socialPosts) !== JSON.stringify(next.socialPosts)
    );
  }
}
```

### 2.3 Graph Setup (Automatic - No Manual Hydration Needed)

```typescript
// In graph factory - just wrap the graph, versions handled automatically
export function createExtendedPostWriterGraph(
  checkpointer: PostgresCheckpointer,
  versionsHydrator: WorkflowVersionsHydrator,
) {
  const graph = new StateGraph(ExtendedPostWriterAnnotation)
    .addNode('generate_blog_post', generateBlogPost)
    .addNode('hitl_interrupt', hitlInterrupt)
    .addNode('process_hitl', processHitl)
    // ... other nodes
    .compile({ checkpointer });

  // Wrap with automatic version hydration - that's it!
  return versionsHydrator.wrapGraph(graph);
}

// Graph nodes don't need to know about versions - they're just in state
async function hitlInterrupt(state: GraphState) {
  // Versions are already in state.contentVersions (auto-hydrated)
  return interrupt({
    type: 'content_review',
    content: state.currentContent,
    versions: state.contentVersions,  // Available automatically
    message: 'Please review the generated content',
  });
}
```

### 2.2 Simplify `hitl_interrupt` Node

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts`

```typescript
// ONLY calls interrupt() with current content - no version tracking
async function hitl_interrupt(state: typeof ExtendedPostWriterAnnotation.State) {
  const pendingContent = {
    blogPost: state.blogPost,
    seoDescription: state.seoDescription,
    socialPosts: state.socialPosts,
  };

  // Just interrupt with content - API Runner handles versioning
  return interrupt({
    type: 'content_review',
    content: pendingContent,
    message: 'Please review the generated content',
  });
}
```

### 2.3 Simplify `process_hitl` Node

```typescript
// ONLY receives resume value and updates state - no version logic
async function process_hitl(state: typeof ExtendedPostWriterAnnotation.State) {
  // Resume value comes from Command(resume=...)
  // API Runner already processed the decision and persisted versions
  const resumeValue = state.__interrupt_resume_value__;

  return {
    hitlDecision: resumeValue.decision,
    hitlFeedback: resumeValue.feedback || null,
    // For REPLACE: use user's content (already versioned by API Runner)
    ...(resumeValue.content && {
      blogPost: resumeValue.content.blogPost,
      seoDescription: resumeValue.content.seoDescription,
      socialPosts: resumeValue.content.socialPosts,
    }),
  };
}
```

### 2.4 Simplify Graph Edges

```typescript
// route_after_hitl checks state.hitlDecision
function route_after_hitl(state) {
  switch (state.hitlDecision) {
    case 'approve':
    case 'skip':
      return 'generate_supporting';  // Continue forward
    case 'reject':
    case 'regenerate':
      return 'generate_blog_post';   // Go back and regenerate
    case 'replace':
      return 'generate_supporting';  // Use user content, continue
  }
}
```

---

## Phase 2.5: LangGraph Service-Level Abstraction (createHitlWorkflow Factory)

### Design Goal: Lift Common Logic to Service Level

Individual graphs should only define **domain-specific logic**. All HITL mechanics (state fields, interrupt/resume nodes, edge routing) should be inherited automatically from the service level.

```
┌────────────────────────────────────────────────────────────────┐
│          LANGGRAPH SERVICE LEVEL (inherited by all)            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. BASE STATE ANNOTATION (common HITL fields)                 │
│     - hitlPending, hitlResponse, hitlDecision, hitlFeedback   │
│     - status, error, startedAt, completedAt                    │
│     - taskId, threadId, userId, conversationId, orgSlug        │
│     - contentVersions, currentVersionNumber                    │
│                                                                │
│  2. HITL NODES (generic, reusable)                             │
│     - createHitlInterruptNode(getContent)                      │
│     - createProcessHitlNode()                                  │
│                                                                │
│  3. STANDARD EDGE ROUTING                                      │
│     - routeAfterError → handleError                            │
│     - routeAfterHitl → next node (not hardcoded finalize!)    │
│                                                                │
│  4. VERSION HYDRATION (automatic)                              │
│     - WorkflowVersionsHydrator wraps all HITL graphs          │
│                                                                │
│  5. OBSERVABILITY (automatic)                                  │
│     - Emit events for each state transition                    │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│        GRAPH LEVEL (agent-specific, minimal)                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. DOMAIN STATE (content-specific fields only)                │
│     - blogPost, seoDescription, socialPosts                    │
│     - keywords, tone, context                                  │
│                                                                │
│  2. DOMAIN NODES (content generation only)                     │
│     - generateBlogPostNode                                     │
│     - generateSupportingContentNode                            │
│                                                                │
│  3. NODE SEQUENCE (workflow-specific order)                    │
│     - Which nodes run, in what order                           │
│     - Which nodes require HITL review                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.5.1 Base HITL State Annotation

**File**: `apps/langgraph/src/hitl/hitl-base.state.ts`

```typescript
import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { WorkflowContentVersion, HitlDecision } from '@orchestrator-ai/transport-types';

/**
 * Base state annotation for all HITL-capable workflows.
 * Individual agents extend this with their domain-specific fields.
 */
export const HitlBaseStateAnnotation = Annotation.Root({
  // Include message history
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
  status: Annotation<string>({
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
```

### 2.5.2 createHitlWorkflow Factory

**File**: `apps/langgraph/src/hitl/create-hitl-workflow.ts`

```typescript
import { StateGraph, END, interrupt } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import { HitlBaseStateAnnotation, HitlBaseState } from './hitl-base.state';
import { WorkflowVersionsHydrator } from '../persistence/workflow-versions-hydrator.service';
import { PostgresCheckpointerService } from '../persistence/postgres-checkpointer.service';
import { ObservabilityService } from '../services/observability.service';

/**
 * Configuration for a node in the workflow
 */
interface HitlNodeConfig<TState extends HitlBaseState> {
  /** Node name (used in graph) */
  name: string;

  /** The node function */
  fn: (state: TState) => Promise<Partial<TState>>;

  /** Does this node require HITL review after execution? */
  needsHitl?: boolean | ((state: TState) => boolean);

  /** Extract content for HITL review (required if needsHitl is true) */
  getContentForReview?: (state: TState) => unknown;

  /** Custom message for HITL review */
  hitlMessage?: string;
}

/**
 * Configuration for createHitlWorkflow
 */
interface HitlWorkflowConfig<TState extends HitlBaseState> {
  /** Agent slug for observability */
  agentSlug: string;

  /** State annotation (must extend HitlBaseStateAnnotation) */
  stateAnnotation: ReturnType<typeof Annotation.Root>;

  /** Ordered list of nodes - executed in sequence */
  nodes: HitlNodeConfig<TState>[];

  /** Optional: Custom routing after HITL decision */
  routeAfterHitl?: (state: TState, decision: string, currentNodeIndex: number) => string | number;
}

/**
 * Create an HITL-capable workflow with automatic:
 * - HITL interrupt/resume handling
 * - Version hydration
 * - Observability
 * - Error handling
 *
 * Nodes are executed in sequence. After each node with needsHitl=true,
 * an HITL interrupt is inserted. After approval, execution continues
 * to the NEXT node in the sequence (not hardcoded to "finalize").
 *
 * This enables SERIALIZED HITL - multiple review points in a single workflow.
 */
export function createHitlWorkflow<TState extends HitlBaseState>(
  config: HitlWorkflowConfig<TState>,
  deps: {
    checkpointer: PostgresCheckpointerService;
    versionsHydrator: WorkflowVersionsHydrator;
    observability: ObservabilityService;
  },
) {
  const { agentSlug, stateAnnotation, nodes } = config;
  const { checkpointer, versionsHydrator, observability } = deps;

  // Build the graph
  const graph = new StateGraph(stateAnnotation);

  // === Add standard nodes ===

  // Start node (observability)
  graph.addNode('__start_workflow__', async (state: TState) => {
    await observability.emitStarted({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug,
      userId: state.userId,
      conversationId: state.conversationId,
      organizationSlug: state.organizationSlug,
      message: `Starting ${agentSlug} workflow`,
    });
    return { status: 'started', startedAt: Date.now() };
  });

  // Error handler node
  graph.addNode('__handle_error__', async (state: TState) => {
    await observability.emitFailed({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug,
      userId: state.userId,
      conversationId: state.conversationId,
      error: state.error || 'Unknown error',
      duration: Date.now() - state.startedAt,
    });
    return { status: 'failed', completedAt: Date.now() };
  });

  // Finalize node (observability)
  graph.addNode('__finalize__', async (state: TState) => {
    await observability.emitCompleted({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug,
      userId: state.userId,
      conversationId: state.conversationId,
      result: { status: 'completed' },
      duration: Date.now() - state.startedAt,
    });
    return { status: 'completed', completedAt: Date.now() };
  });

  // === Add user-defined nodes with HITL wrappers ===

  nodes.forEach((nodeConfig, index) => {
    const { name, fn, needsHitl, getContentForReview, hitlMessage } = nodeConfig;
    const nextNodeName = index < nodes.length - 1 ? nodes[index + 1].name : '__finalize__';

    // Add the domain node
    graph.addNode(name, fn);

    // If this node needs HITL, add interrupt and process nodes
    if (needsHitl) {
      const hitlInterruptName = `${name}__hitl_interrupt`;
      const hitlProcessName = `${name}__hitl_process`;

      // HITL interrupt node - calls interrupt()
      graph.addNode(hitlInterruptName, async (state: TState) => {
        const content = getContentForReview?.(state);

        await observability.emitHitlWaiting({
          taskId: state.taskId,
          threadId: state.threadId,
          agentSlug,
          userId: state.userId,
          conversationId: state.conversationId,
          message: hitlMessage || `Review content from ${name}`,
          pendingContent: content,
        });

        // Call interrupt - this pauses the graph
        const resumeValue = interrupt({
          reason: 'human_review',
          taskId: state.taskId,
          threadId: state.threadId,
          agentSlug,
          nodeName: name,
          content,
          message: hitlMessage || `Please review the output from ${name}`,
        });

        return {
          hitlPending: false,
          hitlDecision: resumeValue.decision,
          hitlFeedback: resumeValue.feedback || null,
        } as Partial<TState>;
      });

      // HITL process node - routes based on decision
      graph.addNode(hitlProcessName, async (state: TState) => {
        await observability.emitHitlResumed({
          taskId: state.taskId,
          threadId: state.threadId,
          agentSlug,
          userId: state.userId,
          conversationId: state.conversationId,
          decision: state.hitlDecision || 'unknown',
          message: state.hitlFeedback || `Decision: ${state.hitlDecision}`,
        });

        // Clear HITL state for next potential interrupt
        return {
          hitlPending: false,
        } as Partial<TState>;
      });

      // Edges: node → hitl_interrupt → hitl_process → conditional routing
      graph.addConditionalEdges(name, (state: TState) => {
        if (state.error) return '__handle_error__';

        // Check if HITL is needed (could be dynamic)
        const shouldHitl = typeof needsHitl === 'function' ? needsHitl(state) : needsHitl;
        return shouldHitl ? hitlInterruptName : nextNodeName;
      });

      graph.addEdge(hitlInterruptName, hitlProcessName);

      // After HITL process, route based on decision
      graph.addConditionalEdges(hitlProcessName, (state: TState) => {
        if (state.error) return '__handle_error__';

        // Custom routing if provided
        if (config.routeAfterHitl) {
          const result = config.routeAfterHitl(state, state.hitlDecision || '', index);
          if (typeof result === 'string') return result;
          if (typeof result === 'number') return nodes[result]?.name || '__finalize__';
        }

        // Default routing based on decision
        switch (state.hitlDecision) {
          case 'approve':
          case 'skip':
          case 'replace':
            // Continue to NEXT node in sequence
            return nextNodeName;
          case 'reject':
          case 'regenerate':
            // Go back to THIS node (regenerate content)
            return name;
          default:
            return nextNodeName;
        }
      });

    } else {
      // No HITL needed - simple edge to next node
      graph.addConditionalEdges(name, (state: TState) => {
        if (state.error) return '__handle_error__';
        return nextNodeName;
      });
    }
  });

  // === Entry and exit edges ===
  graph.addEdge('__start__', '__start_workflow__');
  graph.addEdge('__start_workflow__', nodes[0].name);
  graph.addEdge('__finalize__', END);
  graph.addEdge('__handle_error__', END);

  // === Compile with checkpointer and version hydration ===
  const compiled = graph.compile({
    checkpointer: checkpointer.getSaver(),
  });

  // Wrap with automatic version hydration
  return versionsHydrator.wrapGraph(compiled);
}
```

### 2.5.3 Example: Extended Post Writer Using Factory

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts` (simplified)

```typescript
import { Annotation } from '@langchain/langgraph';
import { createHitlWorkflow } from '../../hitl/create-hitl-workflow';
import { HitlBaseStateAnnotation } from '../../hitl/hitl-base.state';

// === DOMAIN STATE ONLY ===
// Extend base with content-specific fields
const ExtendedPostWriterStateAnnotation = Annotation.Root({
  ...HitlBaseStateAnnotation.spec,

  // Domain-specific fields
  userMessage: Annotation<string>({ reducer: (_, n) => n, default: () => '' }),
  keywords: Annotation<string[]>({ reducer: (_, n) => n, default: () => [] }),
  tone: Annotation<string>({ reducer: (_, n) => n, default: () => 'professional' }),
  context: Annotation<string | undefined>({ reducer: (_, n) => n, default: () => undefined }),

  // Generated content
  blogPost: Annotation<string>({ reducer: (_, n) => n, default: () => '' }),
  seoDescription: Annotation<string>({ reducer: (_, n) => n, default: () => '' }),
  socialPosts: Annotation<string[]>({ reducer: (_, n) => n, default: () => [] }),
});

type ExtendedPostWriterState = typeof ExtendedPostWriterStateAnnotation.State;

// === DOMAIN NODES ONLY ===
// Just the content generation logic - no HITL mechanics

async function generateBlogPost(state: ExtendedPostWriterState) {
  // ... LLM call to generate blog post ...
  return { blogPost: generatedBlogPost, status: 'blog_generated' };
}

async function generateSupportingContent(state: ExtendedPostWriterState) {
  // ... LLM call to generate SEO + social ...
  return { seoDescription, socialPosts, status: 'supporting_generated' };
}

// === CREATE GRAPH USING FACTORY ===
export function createExtendedPostWriterGraph(deps: GraphDependencies) {
  return createHitlWorkflow<ExtendedPostWriterState>(
    {
      agentSlug: 'extended-post-writer',
      stateAnnotation: ExtendedPostWriterStateAnnotation,
      nodes: [
        {
          name: 'generate_blog_post',
          fn: generateBlogPost,
          needsHitl: true,  // Pause for review after blog post
          getContentForReview: (state) => ({ blogPost: state.blogPost }),
          hitlMessage: 'Please review the blog post before we generate SEO and social content',
        },
        {
          name: 'generate_supporting_content',
          fn: generateSupportingContent,
          needsHitl: false,  // No review needed for supporting content
        },
      ],
      // Optional: Custom routing (e.g., skip SEO if user says so)
      routeAfterHitl: (state, decision, nodeIndex) => {
        // Default behavior - let factory handle it
        return undefined;
      },
    },
    deps,
  );
}
```

### 2.5.4 Serialized HITL Example (Multiple Review Points)

```typescript
// A workflow with THREE HITL review points
export function createMultiReviewWorkflow(deps: GraphDependencies) {
  return createHitlWorkflow({
    agentSlug: 'multi-review-writer',
    stateAnnotation: MultiReviewStateAnnotation,
    nodes: [
      {
        name: 'generate_outline',
        fn: generateOutline,
        needsHitl: true,  // HITL #1: Review outline
        getContentForReview: (state) => state.outline,
        hitlMessage: 'Review the outline before we write the draft',
      },
      {
        name: 'generate_draft',
        fn: generateDraft,
        needsHitl: true,  // HITL #2: Review draft
        getContentForReview: (state) => state.draft,
        hitlMessage: 'Review the draft before we finalize',
      },
      {
        name: 'generate_final',
        fn: generateFinal,
        needsHitl: true,  // HITL #3: Review final
        getContentForReview: (state) => state.final,
        hitlMessage: 'Final review before publishing',
      },
    ],
  }, deps);
}

// Flow:
// generate_outline → HITL #1 → generate_draft → HITL #2 → generate_final → HITL #3 → END
//
// At each HITL point:
// - APPROVE/SKIP → continue to next node
// - REJECT/REGENERATE → re-run current node
// - REPLACE → use user content, continue to next node
```

### 2.5.5 Key Benefits

| Before (Manual) | After (Factory) |
|-----------------|-----------------|
| ~400 lines per graph | ~50 lines per graph |
| Manual HITL node creation | Automatic HITL wrappers |
| Hardcoded `finalize` after HITL | Automatic "next node" routing |
| Manual version hydration | Automatic via wrapper |
| Manual observability calls | Automatic at each transition |
| Copy-paste for new agents | Just define nodes + needsHitl |
| Single HITL point pattern | Serialized HITL built-in |

---

## Phase 3: Centralize HITL Logic in API Agent Runner

### 3.1 Add HITL Method Routing (Switch 1)

**File**: `apps/api/src/agent2agent/services/api-agent-runner.service.ts`

```typescript
async executeTask(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string,
): Promise<TaskResponseDto> {
  // SWITCH 1: Route based on request method
  const method = request.method || 'tasks/send';

  switch (method) {
    case 'hitl.resume':
      return this.handleHitlResume(definition, request, organizationSlug);
    case 'hitl.status':
      return this.handleHitlStatus(definition, request, organizationSlug);
    case 'hitl.history':
      return this.handleHitlHistory(definition, request, organizationSlug);
    default:
      return this.handleBuildOrConverse(definition, request, organizationSlug);
  }
}
```

### 3.2 Implement Decision Handlers

```typescript
private async handleHitlResume(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string,
): Promise<TaskResponseDto> {
  const payload = request.payload as HitlResumePayload;
  const { threadId, decision, feedback, content } = payload;

  // Route based on decision type
  switch (decision) {
    case 'approve':
      return this.resumeWithApproval(definition, threadId, request);

    case 'reject':
      return this.resumeWithRejection(definition, threadId, request);

    case 'regenerate':
      return this.resumeWithRegeneration(definition, threadId, feedback, request);

    case 'replace':
      return this.resumeWithReplacement(definition, threadId, content, request);

    case 'skip':
      return this.resumeWithSkip(definition, threadId, request);

    default:
      return TaskResponseDto.failure('hitl', `Unknown decision: ${decision}`);
  }
}
```

### 3.3 Implement Each Decision Handler

```typescript
// APPROVE: Continue workflow to completion
private async resumeWithApproval(
  definition: AgentRuntimeDefinition,
  threadId: string,
  request: TaskRequestDto,
): Promise<TaskResponseDto> {
  const resumePayload = { decision: 'approve' };
  const lgResponse = await this.sendResumeToLangGraph(definition, threadId, resumePayload);
  return this.processLangGraphResponse(lgResponse, threadId, request);
}

// REJECT: Regenerate from scratch (no feedback)
private async resumeWithRejection(
  definition: AgentRuntimeDefinition,
  threadId: string,
  request: TaskRequestDto,
): Promise<TaskResponseDto> {
  const resumePayload = { decision: 'reject' };
  const lgResponse = await this.sendResumeToLangGraph(definition, threadId, resumePayload);
  return this.processLangGraphResponse(lgResponse, threadId, request);
}

// REGENERATE: AI creates new version with feedback
private async resumeWithRegeneration(
  definition: AgentRuntimeDefinition,
  threadId: string,
  feedback: string,
  request: TaskRequestDto,
): Promise<TaskResponseDto> {
  const resumePayload = { decision: 'regenerate', feedback };
  const lgResponse = await this.sendResumeToLangGraph(definition, threadId, resumePayload);
  return this.processLangGraphResponse(lgResponse, threadId, request);
}

// REPLACE: User's content becomes the version
private async resumeWithReplacement(
  definition: AgentRuntimeDefinition,
  threadId: string,
  content: HitlGeneratedContent,
  request: TaskRequestDto,
): Promise<TaskResponseDto> {
  // Save user's content as a version first
  await this.workflowVersionsService.createVersion(
    threadId,
    request.conversationId,
    content,
    'user_replaced',
    undefined,
    request.metadata?.userId,
  );

  const resumePayload = { decision: 'replace', content };
  const lgResponse = await this.sendResumeToLangGraph(definition, threadId, resumePayload);
  return this.processLangGraphResponse(lgResponse, threadId, request);
}

// SKIP: Auto-approve and continue
private async resumeWithSkip(
  definition: AgentRuntimeDefinition,
  threadId: string,
  request: TaskRequestDto,
): Promise<TaskResponseDto> {
  const resumePayload = { decision: 'skip' };
  const lgResponse = await this.sendResumeToLangGraph(definition, threadId, resumePayload);
  return this.processLangGraphResponse(lgResponse, threadId, request);
}
```

### 3.4 Implement Response Handler (Switch 2)

```typescript
private async processLangGraphResponse(
  lgResponse: LangGraphResponse,
  threadId: string,
  request: TaskRequestDto,
): Promise<TaskResponseDto> {
  // SWITCH 2: Route based on response type
  if (lgResponse.hitlPending) {
    // LangGraph called interrupt() - save version and return HITL response
    await this.workflowVersionsService.createVersion(
      threadId,
      request.conversationId,
      lgResponse.content,
      lgResponse.isRegenerated ? 'ai_regenerated' : 'ai_generated',
      lgResponse.feedback,
    );

    const versions = await this.workflowVersionsService.getVersions(threadId);

    return TaskResponseDto.hitlWaiting({
      threadId,
      status: 'pending_review',
      currentContent: lgResponse.content,
      contentVersions: versions,
      topic: lgResponse.topic,
      message: 'Please review the generated content',
    });
  } else {
    // Normal completion - create deliverable and return BUILD response
    const deliverable = await this.createDeliverableFromContent(
      lgResponse.finalContent,
      request,
    );

    return TaskResponseDto.buildSuccess({
      deliverable,
      humanResponse: { message: 'Content approved and finalized' },
    });
  }
}
```

---

## Phase 4: Update Response Formats

### 4.1 HITL Pending Response Format

```typescript
{
  jsonrpc: '2.0',
  id: 'request-id',
  result: {
    mode: 'hitl',
    success: true,
    hitlPending: true,
    payload: {
      threadId: 'thread-123',
      status: 'pending_review',
      currentContent: {
        blogPost: '...',
        seoDescription: '...',
        socialPosts: ['...', '...'],
      },
      contentVersions: [
        {
          versionNumber: 1,
          content: {...},
          source: 'ai_generated',
          createdAt: '2025-01-15T10:00:00Z',
        },
        {
          versionNumber: 2,
          content: {...},
          source: 'ai_regenerated',
          feedback: 'Make it shorter',
          createdAt: '2025-01-15T10:05:00Z',
        },
      ],
      topic: 'AI in Healthcare',
      message: 'Please review the generated content',
    },
  },
}
```

### 4.2 BUILD Response Format (After Approval)

```typescript
{
  jsonrpc: '2.0',
  id: 'request-id',
  result: {
    mode: 'build',
    success: true,
    payload: {
      deliverable: {
        id: 'deliverable-uuid',
        name: 'Blog Post: AI in Healthcare',
        deliverableType: 'blog-post',
        currentVersion: {
          id: 'version-uuid',
          versionNumber: 1,
          content: '...',
        },
      },
      humanResponse: {
        message: 'Content approved and finalized',
      },
    },
  },
}
```

---

## Phase 5: Validation, Authorization & Error Handling

### 5.1 Request Validation

```typescript
// Validation schemas for each decision type
const HitlResumeSchema = z.object({
  action: z.literal('resume'),
  threadId: z.string().min(1),
  decision: z.enum(['approve', 'reject', 'regenerate', 'replace', 'skip']),
  feedback: z.string().optional(),
  content: HitlGeneratedContentSchema.optional(),
});

// Decision-specific validation
function validateResumePayload(payload: HitlResumePayload): ValidationResult {
  // REGENERATE requires feedback
  if (payload.decision === 'regenerate' && !payload.feedback?.trim()) {
    return { valid: false, error: 'Feedback is required for regenerate decision' };
  }

  // REPLACE requires content matching schema
  if (payload.decision === 'replace') {
    if (!payload.content) {
      return { valid: false, error: 'Content is required for replace decision' };
    }
    // Validate content structure
    const contentResult = HitlGeneratedContentSchema.safeParse(payload.content);
    if (!contentResult.success) {
      return { valid: false, error: `Invalid content: ${contentResult.error.message}` };
    }
  }

  return { valid: true };
}
```

### 5.2 Authorization

```typescript
async function authorizeHitlRequest(
  request: TaskRequestDto,
  threadId: string,
  organizationSlug: string,
): Promise<AuthorizationResult> {
  const userId = request.metadata?.userId;

  // 1. Verify user is authenticated
  if (!userId) {
    return { authorized: false, error: 'Authentication required' };
  }

  // 2. Verify user belongs to organization
  const isMember = await this.orgService.isUserMember(userId, organizationSlug);
  if (!isMember) {
    return { authorized: false, error: 'Not authorized for this organization' };
  }

  // 3. Verify thread belongs to a conversation the user can access
  const version = await this.workflowVersionsService.getCurrentVersion(threadId);
  if (version) {
    const canAccess = await this.conversationsService.canUserAccess(
      userId,
      version.conversationId,
    );
    if (!canAccess) {
      return { authorized: false, error: 'Not authorized for this thread' };
    }
  }

  return { authorized: true };
}
```

### 5.3 Error Handling & Response Contract

```typescript
// Error response format
interface HitlErrorResponse {
  mode: 'hitl';
  success: false;
  error: {
    code: HitlErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Error codes
enum HitlErrorCode {
  VALIDATION_ERROR = 'HITL_VALIDATION_ERROR',
  AUTHORIZATION_ERROR = 'HITL_AUTHORIZATION_ERROR',
  THREAD_NOT_FOUND = 'HITL_THREAD_NOT_FOUND',
  WORKFLOW_ERROR = 'HITL_WORKFLOW_ERROR',
  LANGGRAPH_ERROR = 'HITL_LANGGRAPH_ERROR',
  LANGGRAPH_TIMEOUT = 'HITL_LANGGRAPH_TIMEOUT',
  VERSION_CONFLICT = 'HITL_VERSION_CONFLICT',
  INTERNAL_ERROR = 'HITL_INTERNAL_ERROR',
}

// Unified error handler
private handleHitlError(error: unknown, context: string): TaskResponseDto {
  console.error(`[HITL] Error in ${context}:`, error);

  if (error instanceof ValidationError) {
    return TaskResponseDto.hitlError(HitlErrorCode.VALIDATION_ERROR, error.message);
  }
  if (error instanceof AuthorizationError) {
    return TaskResponseDto.hitlError(HitlErrorCode.AUTHORIZATION_ERROR, error.message);
  }
  if (error instanceof LangGraphTimeoutError) {
    return TaskResponseDto.hitlError(HitlErrorCode.LANGGRAPH_TIMEOUT, 'Workflow timed out');
  }
  if (error instanceof LangGraphError) {
    return TaskResponseDto.hitlError(HitlErrorCode.LANGGRAPH_ERROR, error.message);
  }

  // Unknown error - don't expose internals
  return TaskResponseDto.hitlError(HitlErrorCode.INTERNAL_ERROR, 'An unexpected error occurred');
}
```

### 5.4 Rate Limiting & Replay Protection

```typescript
// Rate limit HITL resume calls per thread
const HITL_RATE_LIMIT = {
  maxRequestsPerThread: 10,
  windowMs: 60000, // 1 minute
};

// Prevent duplicate resume calls (idempotency)
async function checkReplayProtection(
  threadId: string,
  requestId: string,
): Promise<boolean> {
  // Check if this requestId was already processed for this thread
  const exists = await this.redis.exists(`hitl:processed:${threadId}:${requestId}`);
  if (exists) {
    return false; // Already processed
  }

  // Mark as processed (TTL 1 hour)
  await this.redis.setex(`hitl:processed:${threadId}:${requestId}`, 3600, '1');
  return true; // OK to process
}
```

---

## Phase 6: Testing & Cleanup

### 6.1 Test Cases - Happy Path

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| APPROVE | `{ decision: 'approve' }` | BUILD response with deliverable |
| REJECT | `{ decision: 'reject' }` | HITL response with new AI-generated version |
| REGENERATE | `{ decision: 'regenerate', feedback: 'shorter' }` | HITL response with new AI-regenerated version |
| REPLACE | `{ decision: 'replace', content: {...} }` | Continues workflow with user content |
| SKIP | `{ decision: 'skip' }` | Continues workflow (BUILD or next HITL) |
| Multiple HITL | Workflow with 2 interrupt points | Each returns HITL, final returns BUILD |

### 6.2 Test Cases - Error Paths

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Missing threadId | `{ decision: 'approve' }` | VALIDATION_ERROR |
| Invalid decision | `{ decision: 'invalid' }` | VALIDATION_ERROR |
| REGENERATE without feedback | `{ decision: 'regenerate' }` | VALIDATION_ERROR |
| REPLACE with invalid content | `{ decision: 'replace', content: {} }` | VALIDATION_ERROR |
| Unauthorized user | Valid payload, wrong org | AUTHORIZATION_ERROR |
| Thread not found | `{ threadId: 'nonexistent' }` | THREAD_NOT_FOUND |
| LangGraph timeout | Valid payload, LG hangs | LANGGRAPH_TIMEOUT |
| Concurrent resumes | Same threadId, racing | VERSION_CONFLICT or idempotent |
| Replay attack | Same requestId twice | Idempotent (return cached) |

### 6.3 Test Cases - Concurrency & Edge Cases

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| Concurrent version create | Two resumes hit interrupt simultaneously | Only one version created (SELECT FOR UPDATE) |
| Version ordering | Create v1, v2, v3 | Versions returned in order, v3 is current |
| Promote older version | Select v1 after v3 exists | v1 becomes current, v2/v3 still exist |
| Workflow restart after REJECT | User rejects, new content generated | New version created, old preserved |
| Long-running workflow | HITL paused for hours | Resume works, checkpoint valid |

### 6.4 Cleanup Tasks

1. Remove decision routing from LangGraph graph
2. Reduce `hitl.handlers.ts` to thin wrappers
3. Remove scattered HITL logic from frontend services
4. Update frontend HITL panel to display version selector

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `apps/api/supabase/migrations/YYYYMMDD_create_workflow_content_versions.sql` | Version tracking table |
| `apps/api/src/agent2agent/services/workflow-versions.service.ts` | Version CRUD operations |
| `apps/api/src/agent2agent/services/workflow-versions.module.ts` | NestJS module |
| `apps/langgraph/src/hitl/hitl-base.state.ts` | Base state annotation for all HITL workflows |
| `apps/langgraph/src/hitl/create-hitl-workflow.ts` | Factory function for creating HITL-capable workflows |
| `apps/langgraph/src/persistence/workflow-versions-hydrator.service.ts` | Automatic version hydration/persistence |

### Modified Files
| File | Changes |
|------|---------|
| `libs/transport-types/src/hitl.types.ts` | Add decision types, version types, payload types |
| `apps/api/src/agent2agent/services/api-agent-runner.service.ts` | Add Switch 1, decision handlers, Switch 2 |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.state.ts` | Add version tracking to state |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts` | Simplify nodes, remove decision routing |
| `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts` | Reduce to thin wrappers |
| `apps/api/src/agent2agent/dto/task-response.dto.ts` | Ensure consistent response formats |

---

## Success Criteria

1. **LangGraph is minimal**: Only `interrupt()` and `Command(resume=...)` calls
2. **API Runner owns decisions**: All 5 decision types handled in one place
3. **Consistent responses**: Frontend always knows format (HITL or BUILD)
4. **Workflow versions work**: Users see version history, can compare
5. **Pattern is repeatable**: Any API agent can add HITL by following this pattern
6. **All 5 decisions work**: APPROVE, REJECT, REGENERATE, REPLACE, SKIP tested
7. **Factory pattern works**: New agents use `createHitlWorkflow()` with ~50 lines of domain code
8. **Serialized HITL works**: Multiple HITL review points in a single workflow chain correctly
9. **Service-level inheritance**: Base state, nodes, and version hydration inherited automatically

---

## Phase 7: Migration & Rollout Strategy

### 7.1 Existing HITL Threads Migration

```
┌─────────────────────────────────────────────────────────────────┐
│              MIGRATION STRATEGY FOR EXISTING THREADS             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  APPROACH: New threads use new system, old threads grandfathered │
│                                                                  │
│  1. DO NOT backfill workflow_content_versions for old threads    │
│     - Old threads continue with current behavior until completed │
│     - No data loss, no complex migration                         │
│                                                                  │
│  2. Feature flag for new HITL system                             │
│     - HITL_V2_ENABLED = true for new conversations               │
│     - Old conversations fall back to legacy handlers             │
│                                                                  │
│  3. Cutover timeline:                                            │
│     - Week 1: Deploy with flag OFF, monitor                      │
│     - Week 2: Enable for new conversations only                  │
│     - Week 3: Monitor, fix issues                                │
│     - Week 4: Remove legacy code path                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Transport Types Versioning

```typescript
// Add version field to transport types
export interface HitlResumePayload {
  version: '2.0';  // New field for API versioning
  action: 'resume';
  threadId: string;
  decision: HitlDecision;
  // ...
}

// Backend accepts both v1 and v2 payloads during transition
function parseResumePayload(payload: unknown): HitlResumePayload {
  if (isV2Payload(payload)) {
    return parseV2(payload);
  }
  // Legacy v1 format - convert to v2
  return convertV1ToV2(payload);
}
```

### 7.3 Frontend Backward Compatibility

```typescript
// Frontend service handles both response formats
function handleHitlResponse(response: TaskResponse) {
  // New format (with contentVersions)
  if (response.payload?.contentVersions) {
    return handleV2Response(response);
  }
  // Legacy format (without versions)
  return handleLegacyResponse(response);
}
```

### 7.4 Rollout Checklist

- [ ] Deploy database migration (workflow_content_versions table)
- [ ] Deploy WorkflowVersionsService (inactive)
- [ ] Deploy API Runner changes behind feature flag
- [ ] Deploy LangGraph simplifications (backward compatible)
- [ ] Enable feature flag for test organization
- [ ] Run full E2E test suite
- [ ] Enable for 10% of new conversations
- [ ] Monitor error rates, latency, version creation
- [ ] Enable for 100% of new conversations
- [ ] Remove legacy code paths after 2 weeks
- [ ] Update frontend to use version selector UI

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Who is authority for version numbering? | **Database** - auto-increment via `create_workflow_version` function |
| Who hydrates versions? | **LangGraph's WorkflowVersionsHydrator** - automatic, like checkpointer |
| Who persists versions? | **LangGraph's WorkflowVersionsHydrator** - detects state changes, persists |
| How to migrate existing threads? | **Grandfather them** - new system for new threads only |
| What validates hitl.* methods? | **Zod schemas + authorization checks in API Runner** |
| Should LangGraph carry contentVersions? | **Yes** - hydrated from DB like checkpoints, available in state |

---

## Future Enhancements (Phase 2)

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Parallel Variants** | Generate 2-3 content variants for user selection | High |
| **Node-Targeted Navigation** | User specifies checkpoint to return to or skip to | High |
| **Multi-Path Branching** | User chooses between workflow paths | Medium |
| **Human Delegation** | Route to specific reviewer based on role | Medium |
| **Streaming** | Stream partial results during generation | Medium |
