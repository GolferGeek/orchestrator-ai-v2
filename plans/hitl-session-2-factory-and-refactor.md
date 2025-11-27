# HITL Refactoring Session 2: Factory Pattern & Extended Post Writer Refactor

## Goal
Create the `createHitlWorkflow` factory and refactor extended-post-writer to use it, enabling serialized HITL with automatic version hydration.

## Prerequisites
- Session 1 completed (database, types, services in place)
- All services from Session 1 tested and working

---

## Overview

This session implements:
1. `createHitlWorkflow` factory function
2. Refactor extended-post-writer to use the factory (~400 lines → ~50 lines)
3. Test serialized HITL (next node routing, not hardcoded finalize)
4. Update API Runner HITL handlers to use new pattern

---

## Task 1: Create the HITL Workflow Factory

### 1.1 Node Configuration Types

**File**: `apps/langgraph/src/hitl/types.ts`

```typescript
import type { HitlBaseState } from './hitl-base.state';

/**
 * Configuration for a node in an HITL workflow
 */
export interface HitlNodeConfig<TState extends HitlBaseState> {
  /** Node name (used in graph) */
  name: string;

  /** The node function - receives state, returns partial state update */
  fn: (state: TState) => Promise<Partial<TState>>;

  /**
   * Does this node require HITL review after execution?
   * Can be a boolean or a function that evaluates state
   */
  needsHitl?: boolean | ((state: TState) => boolean);

  /**
   * Extract content for HITL review
   * Required if needsHitl is true
   */
  getContentForReview?: (state: TState) => unknown;

  /**
   * Custom message shown to user during HITL review
   */
  hitlMessage?: string;

  /**
   * Progress percentage to report (0-100)
   */
  progress?: number;
}

/**
 * Configuration for createHitlWorkflow
 */
export interface HitlWorkflowConfig<TState extends HitlBaseState> {
  /** Agent slug for observability and identification */
  agentSlug: string;

  /** State annotation (must extend HitlBaseStateAnnotation) */
  stateAnnotation: unknown; // Annotation.Root type

  /** Ordered list of nodes - executed in sequence */
  nodes: HitlNodeConfig<TState>[];

  /**
   * Optional: Custom routing after HITL decision
   * Return node name or node index to route to
   * Return undefined to use default routing
   */
  routeAfterHitl?: (
    state: TState,
    decision: string,
    currentNodeIndex: number,
  ) => string | number | undefined;

  /**
   * Optional: Extract content for version creation
   * If not provided, uses getContentForReview from the triggering node
   */
  getContentForVersion?: (state: TState) => unknown;
}

/**
 * Dependencies required by createHitlWorkflow
 */
export interface HitlWorkflowDependencies {
  checkpointer: unknown; // PostgresCheckpointerService
  versionsHydrator: unknown; // WorkflowVersionsHydratorService
  observability: unknown; // ObservabilityService
}
```

### 1.2 Create the Factory Function

**File**: `apps/langgraph/src/hitl/create-hitl-workflow.ts`

```typescript
import { StateGraph, END, interrupt } from '@langchain/langgraph';
import type { HitlBaseState } from './hitl-base.state';
import type {
  HitlNodeConfig,
  HitlWorkflowConfig,
  HitlWorkflowDependencies,
} from './types';
import type { PostgresCheckpointerService } from '../persistence/postgres-checkpointer.service';
import type { WorkflowVersionsHydratorService } from '../persistence/workflow-versions-hydrator.service';
import type { ObservabilityService } from '../services/observability.service';
import type { HitlDecision, HitlGeneratedContent } from '@orchestrator-ai/transport-types';

/**
 * Create an HITL-capable workflow with automatic:
 * - HITL interrupt/resume handling
 * - Version hydration and persistence
 * - Observability events
 * - Error handling
 *
 * Nodes are executed in sequence. After each node with needsHitl=true,
 * an HITL interrupt is inserted. After approval, execution continues
 * to the NEXT node in the sequence (not hardcoded to "finalize").
 *
 * This enables SERIALIZED HITL - multiple review points in a single workflow.
 *
 * @example
 * ```typescript
 * const graph = createHitlWorkflow({
 *   agentSlug: 'my-agent',
 *   stateAnnotation: MyStateAnnotation,
 *   nodes: [
 *     { name: 'step1', fn: step1Fn, needsHitl: true, getContentForReview: s => s.content1 },
 *     { name: 'step2', fn: step2Fn, needsHitl: false },
 *     { name: 'step3', fn: step3Fn, needsHitl: true, getContentForReview: s => s.content3 },
 *   ],
 * }, deps);
 * ```
 */
export function createHitlWorkflow<TState extends HitlBaseState>(
  config: HitlWorkflowConfig<TState>,
  deps: HitlWorkflowDependencies,
) {
  const { agentSlug, stateAnnotation, nodes } = config;
  const checkpointer = deps.checkpointer as PostgresCheckpointerService;
  const versionsHydrator = deps.versionsHydrator as WorkflowVersionsHydratorService;
  const observability = deps.observability as ObservabilityService;

  // Build the graph
  const graph = new StateGraph(stateAnnotation as Parameters<typeof StateGraph>[0]);

  // === Add standard infrastructure nodes ===

  // Start workflow node (emits observability event)
  graph.addNode('__start_workflow__', async (state: TState): Promise<Partial<TState>> => {
    await observability.emitStarted({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug,
      userId: state.userId,
      conversationId: state.conversationId,
      organizationSlug: state.organizationSlug,
      message: `Starting ${agentSlug} workflow`,
    });

    // Hydrate versions from database
    const versions = await versionsHydrator.hydrateVersions(state.threadId);
    const currentVersionNumber = versions.length > 0
      ? Math.max(...versions.map(v => v.versionNumber))
      : 0;

    return {
      status: 'started',
      startedAt: Date.now(),
      contentVersions: versions,
      currentVersionNumber,
    } as Partial<TState>;
  });

  // Error handler node
  graph.addNode('__handle_error__', async (state: TState): Promise<Partial<TState>> => {
    await observability.emitFailed({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug,
      userId: state.userId,
      conversationId: state.conversationId,
      error: state.error || 'Unknown error',
      duration: Date.now() - state.startedAt,
    });

    return {
      status: 'failed',
      completedAt: Date.now(),
    } as Partial<TState>;
  });

  // Finalize node (emits completion event)
  graph.addNode('__finalize__', async (state: TState): Promise<Partial<TState>> => {
    await observability.emitCompleted({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug,
      userId: state.userId,
      conversationId: state.conversationId,
      result: { status: 'completed' },
      duration: Date.now() - state.startedAt,
    });

    return {
      status: 'completed',
      completedAt: Date.now(),
    } as Partial<TState>;
  });

  // === Add user-defined nodes with HITL wrappers ===

  nodes.forEach((nodeConfig, index) => {
    const { name, fn, needsHitl, getContentForReview, hitlMessage, progress } = nodeConfig;
    const nextNodeName = index < nodes.length - 1 ? nodes[index + 1].name : '__finalize__';

    // Add the domain node (with progress reporting)
    graph.addNode(name, async (state: TState): Promise<Partial<TState>> => {
      // Emit progress if specified
      if (progress !== undefined) {
        await observability.emitProgress({
          taskId: state.taskId,
          threadId: state.threadId,
          agentSlug,
          userId: state.userId,
          conversationId: state.conversationId,
          message: `Executing ${name}`,
          step: name,
          progress,
        });
      }

      // Execute the domain function
      return fn(state);
    });

    // If this node needs HITL, add interrupt and process nodes
    if (needsHitl) {
      const hitlInterruptName = `${name}__hitl_interrupt`;
      const hitlProcessName = `${name}__hitl_process`;

      // HITL interrupt node - calls interrupt() and pauses workflow
      graph.addNode(hitlInterruptName, async (state: TState): Promise<Partial<TState>> => {
        const content = getContentForReview?.(state);

        // Persist the generated content as a version
        if (content) {
          const source = state.hitlDecision === 'regenerate' ? 'ai_regenerated' : 'ai_generated';
          await versionsHydrator.persistVersion(
            state.threadId,
            state.conversationId,
            content as HitlGeneratedContent,
            source,
            state.hitlFeedback || undefined,
            state.userId,
          );
        }

        // Emit HITL waiting event
        await observability.emitHitlWaiting({
          taskId: state.taskId,
          threadId: state.threadId,
          agentSlug,
          userId: state.userId,
          conversationId: state.conversationId,
          message: hitlMessage || `Review content from ${name}`,
          pendingContent: content,
        });

        // Call interrupt - this pauses the graph and waits for resume
        const resumeValue = interrupt({
          reason: 'human_review',
          taskId: state.taskId,
          threadId: state.threadId,
          agentSlug,
          nodeName: name,
          content,
          message: hitlMessage || `Please review the output from ${name}`,
        });

        // When resumed, resumeValue contains the decision
        return {
          hitlPending: false,
          hitlDecision: (resumeValue as { decision: HitlDecision }).decision,
          hitlFeedback: (resumeValue as { feedback?: string }).feedback || null,
          hitlNodeName: name,
        } as Partial<TState>;
      });

      // HITL process node - emits resume event and prepares for routing
      graph.addNode(hitlProcessName, async (state: TState): Promise<Partial<TState>> => {
        await observability.emitHitlResumed({
          taskId: state.taskId,
          threadId: state.threadId,
          agentSlug,
          userId: state.userId,
          conversationId: state.conversationId,
          decision: state.hitlDecision || 'unknown',
          message: state.hitlFeedback || `Decision: ${state.hitlDecision}`,
        });

        // For REPLACE decision, the content should already be in resumeValue
        // The API Runner handles persisting it before sending resume

        return {} as Partial<TState>;
      });

      // === Edges for HITL flow ===

      // Domain node → conditional (error check, then HITL or next)
      graph.addConditionalEdges(name, (state: TState) => {
        if (state.error) return '__handle_error__';

        // Check if HITL is needed (could be dynamic based on state)
        const shouldHitl = typeof needsHitl === 'function'
          ? needsHitl(state)
          : needsHitl;

        return shouldHitl ? hitlInterruptName : nextNodeName;
      });

      // HITL interrupt → HITL process
      graph.addEdge(hitlInterruptName, hitlProcessName);

      // HITL process → conditional (route based on decision)
      graph.addConditionalEdges(hitlProcessName, (state: TState) => {
        if (state.error) return '__handle_error__';

        // Custom routing if provided
        if (config.routeAfterHitl) {
          const result = config.routeAfterHitl(state, state.hitlDecision || '', index);
          if (typeof result === 'string') return result;
          if (typeof result === 'number') {
            return nodes[result]?.name || '__finalize__';
          }
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
            // Unknown decision - continue forward
            return nextNodeName;
        }
      });

    } else {
      // No HITL needed - simple conditional edge to next node
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

  // === Compile with checkpointer ===
  return graph.compile({
    checkpointer: checkpointer.getSaver(),
  });
}

export type HitlWorkflowGraph = ReturnType<typeof createHitlWorkflow>;
```

### 1.3 Update Index Export

**File**: `apps/langgraph/src/hitl/index.ts`

```typescript
export * from './hitl-base.state';
export * from './types';
export * from './create-hitl-workflow';
```

---

## Task 2: Refactor Extended Post Writer

### 2.1 Create Domain State (Extend Base)

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.state.ts` (replace)

```typescript
import { Annotation } from '@langchain/langgraph';
import { HitlBaseStateAnnotation } from '../../hitl';

/**
 * Extended Post Writer State
 *
 * Extends HitlBaseState with domain-specific fields for blog post generation.
 * The base state provides all HITL mechanics - this just adds content fields.
 */
export const ExtendedPostWriterStateAnnotation = Annotation.Root({
  // Inherit all HITL base fields
  ...HitlBaseStateAnnotation.spec,

  // === Domain-specific: User input ===
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  context: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  keywords: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  tone: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'professional',
  }),

  // === Domain-specific: Generated content ===
  blogPost: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  seoDescription: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  socialPosts: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
});

export type ExtendedPostWriterState = typeof ExtendedPostWriterStateAnnotation.State;

/**
 * Input interface for starting the workflow
 */
export interface ExtendedPostWriterInput {
  taskId: string;
  userId: string;
  conversationId?: string;
  organizationSlug: string;
  userMessage: string;
  context?: string;
  keywords?: string[];
  tone?: string;
  provider?: string;
  model?: string;
}

/**
 * Generated content structure (for HITL review)
 */
export interface GeneratedContent {
  blogPost: string;
  seoDescription: string;
  socialPosts: string[];
}
```

### 2.2 Create Domain Nodes

**File**: `apps/langgraph/src/agents/extended-post-writer/nodes.ts` (new)

```typescript
import type { ExtendedPostWriterState } from './extended-post-writer.state';
import type { LLMHttpClientService } from '../../services/llm-http-client.service';

const AGENT_SLUG = 'extended-post-writer';

/**
 * Create the generateBlogPost node function
 * This is the ONLY domain logic - no HITL mechanics
 */
export function createGenerateBlogPostNode(llmClient: LLMHttpClientService) {
  return async (state: ExtendedPostWriterState): Promise<Partial<ExtendedPostWriterState>> => {
    const keywordsStr = state.keywords.length > 0
      ? `Keywords to include: ${state.keywords.join(', ')}`
      : '';

    const contextStr = state.context
      ? `Additional context: ${state.context}`
      : '';

    // If regenerating, include feedback in prompt
    const feedbackStr = state.hitlFeedback
      ? `\n\nPrevious feedback to incorporate: ${state.hitlFeedback}`
      : '';

    const prompt = `You are a professional content writer. Create a compelling blog post for the following topic.

Topic: ${state.userMessage}
Tone: ${state.tone}
${keywordsStr}
${contextStr}
${feedbackStr}

Generate a well-structured blog post (800-1200 words) with:
- An engaging introduction that hooks the reader
- Clear body sections with subheadings (use markdown ## for headings)
- A compelling conclusion with a call to action

Return ONLY the blog post content in markdown format, no additional text or JSON wrapping.`;

    try {
      const response = await llmClient.callLLM({
        userMessage: prompt,
        provider: state.provider,
        model: state.model,
        userId: state.userId,
        callerName: AGENT_SLUG,
      });

      return {
        blogPost: response.text.trim(),
        // Clear feedback after using it
        hitlFeedback: null,
      };
    } catch (error) {
      return {
        error: `Failed to generate blog post: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };
}

/**
 * Create the generateSupportingContent node function
 * Generates SEO description and social posts based on approved blog
 */
export function createGenerateSupportingContentNode(llmClient: LLMHttpClientService) {
  return async (state: ExtendedPostWriterState): Promise<Partial<ExtendedPostWriterState>> => {
    const prompt = `Based on the following approved blog post, create supporting marketing content.

APPROVED BLOG POST:
${state.blogPost}

Generate the following in JSON format:
{
  "seoDescription": "A compelling SEO meta description (150-160 characters) that captures the main value proposition and includes relevant keywords.",
  "socialPosts": [
    "Twitter/X post (under 280 characters) - engaging hook with key insight",
    "LinkedIn post (2-3 paragraphs, professional tone) - valuable takeaways from the blog",
    "Instagram caption (engaging, conversational, with 3-5 relevant hashtags)"
  ]
}

Return ONLY the JSON object, no additional text.`;

    try {
      const response = await llmClient.callLLM({
        userMessage: prompt,
        provider: state.provider,
        model: state.model,
        userId: state.userId,
        callerName: AGENT_SLUG,
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse supporting content JSON');
      }

      const supportingContent = JSON.parse(jsonMatch[0]) as {
        seoDescription: string;
        socialPosts: string[];
      };

      return {
        seoDescription: supportingContent.seoDescription,
        socialPosts: supportingContent.socialPosts,
      };
    } catch (error) {
      return {
        error: `Failed to generate supporting content: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };
}
```

### 2.3 Create Graph Using Factory

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts` (replace)

```typescript
import { createHitlWorkflow } from '../../hitl';
import {
  ExtendedPostWriterStateAnnotation,
  ExtendedPostWriterState,
} from './extended-post-writer.state';
import {
  createGenerateBlogPostNode,
  createGenerateSupportingContentNode,
} from './nodes';
import type { LLMHttpClientService } from '../../services/llm-http-client.service';
import type { ObservabilityService } from '../../services/observability.service';
import type { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';
import type { WorkflowVersionsHydratorService } from '../../persistence/workflow-versions-hydrator.service';

/**
 * Create the Extended Post Writer graph using the HITL factory.
 *
 * This is now ~30 lines instead of ~400 lines!
 *
 * Flow:
 * 1. generate_blog_post → HITL review
 * 2. After approval → generate_supporting_content → finalize
 * 3. If rejected/regenerate → back to generate_blog_post
 */
export function createExtendedPostWriterGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
  versionsHydrator: WorkflowVersionsHydratorService,
) {
  // Create domain node functions
  const generateBlogPost = createGenerateBlogPostNode(llmClient);
  const generateSupportingContent = createGenerateSupportingContentNode(llmClient);

  // Use the factory to create the graph
  return createHitlWorkflow<ExtendedPostWriterState>(
    {
      agentSlug: 'extended-post-writer',
      stateAnnotation: ExtendedPostWriterStateAnnotation,
      nodes: [
        {
          name: 'generate_blog_post',
          fn: generateBlogPost,
          needsHitl: true,
          progress: 30,
          getContentForReview: (state) => ({
            blogPost: state.blogPost,
            seoDescription: '', // Not yet generated
            socialPosts: [],    // Not yet generated
          }),
          hitlMessage: 'Please review the blog post before we generate SEO and social content',
        },
        {
          name: 'generate_supporting_content',
          fn: generateSupportingContent,
          needsHitl: false,  // No review needed for supporting content
          progress: 70,
        },
      ],
    },
    {
      checkpointer,
      versionsHydrator,
      observability,
    },
  );
}

export type ExtendedPostWriterGraph = ReturnType<typeof createExtendedPostWriterGraph>;
```

### 2.4 Update Service to Use New Graph

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.service.ts` (update)

Update the constructor and onModuleInit to inject WorkflowVersionsHydratorService:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Command } from '@langchain/langgraph';
import {
  createExtendedPostWriterGraph,
  ExtendedPostWriterGraph,
} from './extended-post-writer.graph';
import {
  ExtendedPostWriterInput,
  ExtendedPostWriterState,
} from './extended-post-writer.state';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ObservabilityService } from '../../services/observability.service';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';
import { WorkflowVersionsHydratorService } from '../../persistence/workflow-versions-hydrator.service';

// Result interfaces stay the same...

@Injectable()
export class ExtendedPostWriterService implements OnModuleInit {
  private readonly logger = new Logger(ExtendedPostWriterService.name);
  private graph!: ExtendedPostWriterGraph;

  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly observability: ObservabilityService,
    private readonly checkpointer: PostgresCheckpointerService,
    private readonly versionsHydrator: WorkflowVersionsHydratorService, // NEW
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Extended Post Writer graph...');
    this.graph = createExtendedPostWriterGraph(
      this.llmClient,
      this.observability,
      this.checkpointer,
      this.versionsHydrator, // NEW
    );
    this.logger.log('Extended Post Writer graph initialized');
  }

  // ... rest of service methods stay the same
}
```

### 2.5 Update Module

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.module.ts` (update)

Add WorkflowVersionsHydratorService to imports/providers.

---

## Task 3: Update API Runner HITL Handlers

### 3.1 Update handleHitlResume

**File**: `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts`

The existing `sendHitlResume` function should work, but update it to:
1. Use the new decision types
2. Handle version creation for REPLACE decision

```typescript
/**
 * Handle HITL resume with proper version management
 */
export async function handleHitlResumeWithVersions(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: HitlHandlerDependencies & { versionsService: WorkflowVersionsService },
): Promise<TaskResponseDto> {
  const payload = request.payload as HitlResumePayload;
  const { threadId, decision, feedback, content } = payload;

  // For REPLACE decision, persist user's content as a version first
  if (decision === 'replace' && content) {
    await services.versionsService.createVersion(
      threadId,
      request.conversationId,
      content,
      'user_replaced',
      undefined,
      request.metadata?.userId,
    );
  }

  // Send resume to LangGraph
  const result = await sendHitlResume(definition, request, services);

  if (!result || result.error) {
    return TaskResponseDto.failure(
      AgentTaskMode.HITL,
      result?.error || 'Failed to send resume to LangGraph',
    );
  }

  // Process response through normal BUILD flow
  // The factory already handles version creation for AI-generated content
  return processLangGraphResponse(result.response, definition, request, services);
}
```

---

## Task 4: Test the Refactored Workflow

### 4.1 Manual Test Script

Create a test script to verify the workflow:

```bash
# 1. Start a new workflow
curl -X POST http://localhost:6200/extended-post-writer/generate \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-123",
    "userId": "user-1",
    "conversationId": "conv-1",
    "organizationSlug": "demo",
    "userMessage": "Write about AI in healthcare"
  }'

# Response should have status: "hitl_waiting" and threadId

# 2. Check status
curl http://localhost:6200/extended-post-writer/status/test-123

# 3. Resume with approval
curl -X POST http://localhost:6200/extended-post-writer/resume/test-123 \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approve"
  }'

# Should continue to generate_supporting_content and then finalize

# 4. Test regenerate
# Start new workflow, then:
curl -X POST http://localhost:6200/extended-post-writer/resume/test-456 \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "regenerate",
    "feedback": "Make it shorter and more casual"
  }'

# Should go back to generate_blog_post with feedback
```

### 4.2 Verify Version Creation

```sql
-- Check versions were created
SELECT * FROM workflow_content_versions
WHERE thread_id = 'test-123'
ORDER BY version_number;

-- Should see:
-- version 1: ai_generated (initial)
-- version 2: ai_regenerated (if regenerated)
```

---

## Success Criteria

1. [ ] `createHitlWorkflow` factory compiles without errors
2. [ ] Extended Post Writer uses factory (~50 lines graph code)
3. [ ] Generate workflow pauses at HITL correctly
4. [ ] APPROVE decision continues to supporting content
5. [ ] REGENERATE decision loops back with feedback
6. [ ] REPLACE decision uses user content
7. [ ] Versions are created in database
8. [ ] Observability events emit correctly
9. [ ] All tests pass: `npm run test`
10. [ ] Build passes: `npm run build`

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `apps/langgraph/src/hitl/types.ts` | Factory configuration types |
| `apps/langgraph/src/hitl/create-hitl-workflow.ts` | The factory function |
| `apps/langgraph/src/agents/extended-post-writer/nodes.ts` | Domain node functions |

### Modified Files
| File | Changes |
|------|---------|
| `apps/langgraph/src/hitl/index.ts` | Export new modules |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.state.ts` | Extend HitlBaseState |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts` | Use factory |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.service.ts` | Inject versionsHydrator |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.module.ts` | Import versionsHydrator |
| `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts` | Handle versions |

---

## Next Session
Session 3 will add validation, error handling, response formats, and testing.
