# HITL Refactoring Session 2: API Runner Integration (v2 - Deliverable-Centric)

## Goal
Add HITL method routing to the mode router and implement HITL detection/handling in the API Runner.

## Prerequisites
- Session 1 completed (transport types with taskId, HitlBaseStateAnnotation)
- Supabase running
- LangGraph service running
- API service running

---

## Overview

This session implements:
1. HITL method routing in mode router (`hitl.resume`, `hitl.status`, `hitl.history`)
2. HITL response detection in API Runner
3. Deliverable creation on first HITL response
4. Resume handlers for each decision type
5. Wire up to LangGraph (passing taskId as thread_id)

**Key Principles**:
- API Runner is the single point of control for HITL logic
- No separate HITL controller/service - logic in API Runner
- No hitl_thread_states table - LangGraph checkpointer stores HITL state
- Deliverable found via conversation_id
- Use `taskId` consistently (passed to LangGraph as thread_id)

---

## Task 1: Add HITL Method Routing in Mode Router

### 1.1 Update Mode Router to Handle HITL Methods

**File**: `apps/api/src/agent2agent/services/agent-mode-router.service.ts`

Add HITL method detection:

```typescript
/**
 * Route request based on method
 */
async routeRequest(
  request: JsonRpcRequest,
  agent: AgentRuntimeDefinition,
  context: ExecutionContext,
): Promise<TaskResponse> {
  const method = request.method;

  // Route HITL methods to API agent runner
  if (method.startsWith('hitl.')) {
    return this.routeHitlMethod(method, request, agent, context);
  }

  // Existing routing logic for tasks/send, etc.
  // ...
}

/**
 * Route HITL-specific methods
 */
private async routeHitlMethod(
  method: string,
  request: JsonRpcRequest,
  agent: AgentRuntimeDefinition,
  context: ExecutionContext,
): Promise<TaskResponse> {
  // API agents handle all HITL methods
  const apiRunner = this.runnerRegistry.getRunner('api');

  // Pass the method in the request so runner knows what to do
  const hitlRequest = {
    ...request,
    params: {
      ...request.params,
      hitlMethod: method,  // hitl.resume, hitl.status, hitl.history
    },
  };

  return apiRunner.execute(agent, hitlRequest, context);
}
```

---

## Task 2: Update API Agent Runner for HITL Detection

### 2.1 Add HITL Response Detection

**File**: `apps/api/src/agent2agent/services/api-agent-runner.service.ts`

Add imports:
```typescript
import { DeliverablesService } from '../deliverables/deliverables.service';
import { DeliverableVersionsService } from '../deliverables/deliverable-versions.service';
import {
  DeliverableVersionCreationType,
  DeliverableFormat,
} from '../deliverables/dto';
import type {
  HitlDecision,
  HitlGeneratedContent,
  HitlResumePayload,
} from '@orchestrator-ai/transport-types';
```

Add to constructor:
```typescript
constructor(
  // ... existing dependencies ...
  private readonly deliverablesService: DeliverablesService,
  private readonly versionsService: DeliverableVersionsService,
) {}
```

### 2.2 Add Main HITL Handler

```typescript
/**
 * Handle HITL methods (called from executeTask when hitlMethod is present)
 */
private async handleHitlMethod(
  hitlMethod: string,
  request: TaskRequestParams,
  definition: AgentRuntimeDefinition,
  context: ExecutionContext,
): Promise<TaskResponse> {
  switch (hitlMethod) {
    case 'hitl.resume':
      return this.handleHitlResume(definition, request, context);

    case 'hitl.status':
      return this.handleHitlStatus(request, context);

    case 'hitl.history':
      return this.handleHitlHistory(request, context);

    default:
      return this.buildErrorResponse(`Unknown HITL method: ${hitlMethod}`);
  }
}
```

### 2.3 Add HITL Response Processing

Add method to detect and handle HITL responses from LangGraph:

```typescript
/**
 * Process LangGraph response and detect HITL
 */
private async processLangGraphResponse(
  response: LangGraphResponse,
  request: TaskRequestParams,
  context: {
    conversationId: string;
    userId: string;
    organizationSlug: string;
    agentSlug: string;
    taskId: string;
  },
): Promise<TaskResponse> {
  // Check if this is an HITL response
  if (this.isHitlResponse(response)) {
    return this.handleHitlPendingResponse(response, request, context);
  }

  // Normal completion - build standard response
  return this.buildCompletionResponse(response, request, context);
}

/**
 * Check if LangGraph response indicates HITL pause
 */
private isHitlResponse(response: LangGraphResponse): boolean {
  // LangGraph interrupt() returns with specific markers
  return (
    response.status === 'hitl_waiting' ||
    response.hitlPending === true ||
    response.__interrupt__ !== undefined
  );
}

/**
 * Handle HITL pending response - create deliverable and return HITL payload
 */
private async handleHitlPendingResponse(
  response: LangGraphResponse,
  request: TaskRequestParams,
  context: {
    conversationId: string;
    userId: string;
    organizationSlug: string;
    agentSlug: string;
    taskId: string;
  },
): Promise<TaskResponse> {
  // taskId IS the thread identifier
  const taskId = context.taskId;

  // Extract generated content from response
  const generatedContent = this.extractGeneratedContent(response);
  const topic = response.topic || this.extractTopic(response);

  // Create or update deliverable with the generated content
  const deliverable = await this.createOrUpdateDeliverable(
    generatedContent,
    context,
    response.isRegenerated ? 'ai_regenerated' : 'ai_generated',
    response.feedback,
  );

  // Get current version info
  const currentVersion = await this.versionsService.getCurrentVersion(
    deliverable.id,
    context.userId,
  );

  // Build HITL response
  return {
    success: true,
    mode: 'hitl',
    payload: {
      taskId,  // Use taskId consistently
      status: 'hitl_waiting',
      deliverableId: deliverable.id,
      currentVersionNumber: currentVersion?.versionNumber || 1,
      message: response.message || 'Please review the generated content',
      topic,
      agentSlug: context.agentSlug,
      nodeName: response.nodeName,
      // Include content for immediate display
      generatedContent,
    },
    metadata: {
      taskId: context.taskId,
      conversationId: context.conversationId,
    },
  };
}
```

---

## Task 3: Implement HITL Resume Handler

### 3.1 Add Resume Handler

```typescript
/**
 * Handle HITL resume request
 */
private async handleHitlResume(
  definition: AgentRuntimeDefinition,
  request: TaskRequestParams,
  context: ExecutionContext,
): Promise<TaskResponse> {
  const payload = request.payload as HitlResumePayload;
  const { taskId, decision, feedback, editedContent } = payload;

  this.logger.log(`HITL resume: taskId=${taskId}, decision=${decision}`);

  // Validate the request
  if (!taskId) {
    return this.buildErrorResponse('HITL resume requires taskId');
  }

  // Validate decision-specific requirements
  if (decision === 'regenerate' && !feedback?.trim()) {
    return this.buildErrorResponse('Feedback is required for regenerate decision');
  }

  if (decision === 'replace' && !editedContent) {
    return this.buildErrorResponse('Content is required for replace decision');
  }

  // Find deliverable via conversation
  const deliverables = await this.deliverablesService.findByConversationId(
    context.conversationId,
    context.userId,
  );

  const deliverable = deliverables[0];

  // Handle REPLACE decision - create version before resuming
  if (decision === 'replace' && editedContent && deliverable) {
    await this.versionsService.createVersion(
      deliverable.id,
      {
        content: this.contentToString(editedContent),
        format: DeliverableFormat.MARKDOWN,
        createdByType: DeliverableVersionCreationType.MANUAL_EDIT,
        metadata: {
          hitlDecision: 'replace',
          replacedAt: new Date().toISOString(),
        },
      },
      context.userId,
    );
  }

  // Build resume payload for LangGraph
  const resumePayload = {
    hitlDecision: decision,
    hitlFeedback: decision === 'regenerate' ? feedback : undefined,
    // If replace, update the content in state
    ...(decision === 'replace' && editedContent ? {
      blogPost: editedContent.blogPost,
      seoDescription: editedContent.seoDescription,
      socialPosts: editedContent.socialPosts,
    } : {}),
  };

  // Resume the LangGraph workflow
  const response = await this.resumeLangGraph(
    definition,
    taskId,  // Use taskId as LangGraph thread_id
    resumePayload,
    context,
  );

  // Process the response (may return another HITL or completion)
  return this.processLangGraphResponse(response, request, {
    conversationId: context.conversationId,
    userId: context.userId,
    organizationSlug: context.organizationSlug,
    agentSlug: definition.slug,
    taskId: context.taskId,
  });
}

/**
 * Resume LangGraph workflow with decision
 */
private async resumeLangGraph(
  definition: AgentRuntimeDefinition,
  taskId: string,
  resumePayload: {
    hitlDecision: HitlDecision;
    hitlFeedback?: string;
    blogPost?: string;
    seoDescription?: string;
    socialPosts?: string[];
  },
  context: ExecutionContext,
): Promise<LangGraphResponse> {
  // Build the resume command
  const command = {
    resume: resumePayload,
  };

  // Get the LangGraph endpoint from agent definition
  const endpoint = this.getLangGraphEndpoint(definition);

  // Call LangGraph with Command(resume=...)
  // taskId is passed as thread_id in LangGraph's config
  const response = await this.httpService.axiosRef.post(
    `${endpoint}/runs/resume`,
    {
      thread_id: taskId,  // LangGraph's internal thread ID = our taskId
      command,
      config: {
        configurable: {
          thread_id: taskId,
        },
      },
    },
    {
      headers: this.buildHeaders(definition),
      timeout: 120000, // 2 minute timeout
    },
  );

  return response.data;
}
```

---

## Task 4: Implement HITL Status and History Handlers

### 4.1 Add Status Handler

```typescript
/**
 * Handle HITL status request
 * Gets status from LangGraph state (via checkpointer)
 */
private async handleHitlStatus(
  request: TaskRequestParams,
  context: ExecutionContext,
): Promise<TaskResponse> {
  const { taskId } = request.payload as { taskId: string };

  // Get LangGraph state for this task
  const state = await this.getLangGraphState(taskId, context);

  // Find deliverable via conversation
  const deliverables = await this.deliverablesService.findByConversationId(
    context.conversationId,
    context.userId,
  );

  const deliverable = deliverables[0];
  let currentVersionNumber: number | undefined;

  if (deliverable) {
    const currentVersion = await this.versionsService.getCurrentVersion(
      deliverable.id,
      context.userId,
    );
    currentVersionNumber = currentVersion?.versionNumber;
  }

  return {
    success: true,
    mode: 'hitl',
    payload: {
      taskId,
      status: state?.status || 'unknown',
      hitlPending: state?.hitlPending || false,
      deliverableId: deliverable?.id,
      currentVersionNumber,
    },
  };
}

/**
 * Get LangGraph state for a task
 */
private async getLangGraphState(
  taskId: string,
  context: ExecutionContext,
): Promise<{ status: string; hitlPending: boolean } | null> {
  // This would query LangGraph's checkpointer
  // The exact implementation depends on LangGraph's API
  // For now, return null to indicate state should be fetched
  return null;
}
```

### 4.2 Add History Handler

```typescript
/**
 * Handle HITL history request (version history via deliverables)
 */
private async handleHitlHistory(
  request: TaskRequestParams,
  context: ExecutionContext,
): Promise<TaskResponse> {
  const { taskId } = request.payload as { taskId: string };

  // Find deliverable via conversation
  const deliverables = await this.deliverablesService.findByConversationId(
    context.conversationId,
    context.userId,
  );

  const deliverable = deliverables[0];

  if (!deliverable) {
    return {
      success: true,
      mode: 'hitl',
      payload: {
        taskId,
        deliverableId: '',
        versionCount: 0,
        currentVersionNumber: 0,
      },
    };
  }

  // Frontend uses deliverablesService.getVersionHistory() directly
  // This endpoint just returns the deliverable ID and counts
  const versions = await this.versionsService.getVersionHistory(
    deliverable.id,
    context.userId,
  );

  const currentVersion = versions.find((v) => v.isCurrentVersion);

  return {
    success: true,
    mode: 'hitl',
    payload: {
      taskId,
      deliverableId: deliverable.id,
      versionCount: versions.length,
      currentVersionNumber: currentVersion?.versionNumber || 0,
    },
  };
}
```

---

## Task 5: Add Helper Methods

### 5.1 Content Extraction and Conversion

```typescript
/**
 * Create or update deliverable with generated content
 */
private async createOrUpdateDeliverable(
  content: HitlGeneratedContent,
  context: {
    conversationId: string;
    userId: string;
    taskId: string;
    agentSlug: string;
  },
  source: 'ai_generated' | 'ai_regenerated',
  feedback?: string,
): Promise<Deliverable> {
  // Check if deliverable already exists for this conversation
  const existingDeliverables = await this.deliverablesService.findByConversationId(
    context.conversationId,
    context.userId,
  );

  const contentString = this.contentToString(content);

  if (existingDeliverables.length > 0) {
    // Add new version to existing deliverable
    const deliverable = existingDeliverables[0];

    const creationType = source === 'ai_regenerated'
      ? DeliverableVersionCreationType.AI_ENHANCEMENT
      : DeliverableVersionCreationType.AI_RESPONSE;

    await this.versionsService.createVersion(
      deliverable.id,
      {
        content: contentString,
        format: DeliverableFormat.MARKDOWN,
        createdByType: creationType,
        taskId: context.taskId,
        metadata: {
          source,
          feedback,
          agentSlug: context.agentSlug,
          generatedAt: new Date().toISOString(),
        },
      },
      context.userId,
    );

    // Return updated deliverable
    return this.deliverablesService.findOne(deliverable.id, context.userId);
  }

  // Create new deliverable
  const title = this.extractTitle(content);

  return this.deliverablesService.create(
    {
      conversationId: context.conversationId,
      title,
      agentName: context.agentSlug,
      initialContent: contentString,
      initialFormat: DeliverableFormat.MARKDOWN,
      initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
      initialTaskId: context.taskId,
      initialMetadata: {
        source,
        agentSlug: context.agentSlug,
        generatedAt: new Date().toISOString(),
      },
    },
    context.userId,
  );
}

/**
 * Extract generated content from LangGraph response
 */
private extractGeneratedContent(response: LangGraphResponse): HitlGeneratedContent {
  // Handle different response structures
  if (response.content) {
    return response.content;
  }

  // Extract from state
  const state = response.state || response.values || {};

  return {
    blogPost: state.blogPost,
    seoDescription: state.seoDescription,
    socialPosts: state.socialPosts,
  };
}

/**
 * Convert HITL content to string for deliverable
 */
private contentToString(content: HitlGeneratedContent): string {
  let result = '';

  if (content.blogPost) {
    result += content.blogPost + '\n\n';
  }

  if (content.seoDescription) {
    result += '---\n\n## SEO Description\n\n' + content.seoDescription + '\n\n';
  }

  if (content.socialPosts) {
    result += '---\n\n## Social Posts\n\n';
    const posts = Array.isArray(content.socialPosts)
      ? content.socialPosts
      : [content.socialPosts];
    posts.forEach((post, i) => {
      result += `### Post ${i + 1}\n\n${post}\n\n`;
    });
  }

  return result.trim() || JSON.stringify(content, null, 2);
}

/**
 * Extract title from content
 */
private extractTitle(content: HitlGeneratedContent): string {
  if (content.blogPost) {
    const h1Match = content.blogPost.match(/^#\s+(.+)$/m);
    if (h1Match?.[1]) {
      return h1Match[1].trim();
    }

    const firstLine = content.blogPost.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100) {
      return firstLine.replace(/^#+\s*/, '');
    }
  }

  return 'Generated Content';
}

/**
 * Extract topic from response
 */
private extractTopic(response: LangGraphResponse): string {
  const state = response.state || response.values || {};
  return state.topic || state.userMessage?.substring(0, 50) || 'Content Generation';
}
```

---

## Task 6: Update LangGraph Extended Post Writer

### 6.1 Simplify the Graph to Use Base State with taskId

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.state.ts`

```typescript
import { Annotation } from '@langchain/langgraph';
import { HitlBaseStateAnnotation } from '../../hitl/hitl-base.state';

/**
 * Extended Post Writer State
 * Extends HitlBaseState with domain-specific content fields
 * Uses taskId (not threadId) consistently
 */
export const ExtendedPostWriterStateAnnotation = Annotation.Root({
  // Include all HITL base state (includes taskId)
  ...HitlBaseStateAnnotation.spec,

  // === Domain-specific fields ===
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  topic: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // === Generated content ===
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
```

### 6.2 Simplify HITL Nodes

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts`

```typescript
import { interrupt } from '@langchain/langgraph';

/**
 * HITL Interrupt Node
 * Simply calls interrupt() - API Runner handles everything else
 */
async function hitl_interrupt(state: ExtendedPostWriterState) {
  const content = {
    blogPost: state.blogPost,
    seoDescription: state.seoDescription,
    socialPosts: state.socialPosts,
  };

  return interrupt({
    reason: 'human_review',
    nodeName: 'hitl_interrupt',
    topic: state.topic,
    content,
    message: 'Please review the generated content',
  });
}

/**
 * Route after HITL decision
 */
function route_after_hitl(state: ExtendedPostWriterState): string {
  switch (state.hitlDecision) {
    case 'approve':
    case 'skip':
    case 'replace':
      return 'finalize';

    case 'reject':
    case 'regenerate':
      return 'generate_blog_post';

    default:
      return 'finalize';
  }
}
```

---

## Success Criteria

1. [ ] Mode router routes `hitl.*` methods to API Runner
2. [ ] API Runner detects HITL responses from LangGraph
3. [ ] Deliverable created on first HITL response
4. [ ] New version created on regeneration (AI_ENHANCEMENT)
5. [ ] User replacement creates MANUAL_EDIT version
6. [ ] LangGraph resumes correctly with taskId as thread_id
7. [ ] All decision types work: APPROVE, REJECT, REGENERATE, REPLACE, SKIP
8. [ ] hitl.status returns state from LangGraph
9. [ ] hitl.history returns deliverable info for frontend
10. [ ] Build passes: `npm run build`

---

## Files Modified

| File | Changes |
|------|---------|
| `apps/api/src/agent2agent/services/agent-mode-router.service.ts` | Route HITL methods |
| `apps/api/src/agent2agent/services/api-agent-runner.service.ts` | Add HITL detection and handlers |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.state.ts` | Use HitlBaseState with taskId |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts` | Simplify HITL nodes |

---

## Next Session
Session 3 will focus on end-to-end testing, error handling, and frontend component updates.
