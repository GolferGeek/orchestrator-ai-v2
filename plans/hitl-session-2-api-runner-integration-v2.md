# HITL Refactoring Session 2: API Runner Integration (v2 - Deliverable-Centric)

## Goal
Add HITL method routing to the mode router and implement HITL detection/handling in the API Runner, including `__interrupt__` detection and `hitl_pending` flag management.

## Prerequisites
- Session 1 completed (transport types with taskId, HitlBaseStateAnnotation, hitl_pending migration)
- Supabase running with migration applied
- LangGraph service running
- API service running

---

## Overview

This session implements:
1. HITL method routing in mode router (`hitl.resume`, `hitl.status`, `hitl.history`, `hitl.pending`)
2. HITL response detection in API Runner (`__interrupt__` in response)
3. Deliverable creation on first HITL response with `task_id` linkage
4. **`task.hitl_pending` flag updates** (NOT conversation-level)
5. Resume handlers for each decision type
6. Wire up to LangGraph (passing taskId as thread_id)
7. Update extended-post-writer to use simplified state

**Key Principles**:
- API Runner is the single point of control for HITL logic
- No separate HITL controller/service - logic in API Runner
- Use `__interrupt__` array to detect LangGraph interrupt responses
- **Update `hitl_pending` on TASK** for efficient sidebar query (future-proof for multiple tasks)
- Use `taskId` consistently (passed to LangGraph as thread_id)
- **Deliverables link to tasks via `task_id`**

---

## Task 1: Add HITL Method Routing in Mode Router

### 1.1 Update Mode Router to Handle HITL Methods

**File**: `apps/api/src/agent2agent/services/agent-mode-router.service.ts`

Add HITL method detection and routing:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import type { JsonRpcRequest, TaskResponse, ExecutionContext } from '../types';
import type { AgentRuntimeDefinition } from '../agents/types';

@Injectable()
export class AgentModeRouterService {
  private readonly logger = new Logger(AgentModeRouterService.name);

  constructor(
    private readonly runnerRegistry: RunnerRegistry,
    // ... other dependencies
  ) {}

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
    switch (method) {
      case 'tasks/send':
        return this.routeTaskSend(request, agent, context);
      // ... other methods
      default:
        return this.buildErrorResponse(`Unknown method: ${method}`);
    }
  }

  /**
   * Route HITL-specific methods
   * All HITL methods are handled by the API agent runner
   */
  private async routeHitlMethod(
    method: string,
    request: JsonRpcRequest,
    agent: AgentRuntimeDefinition,
    context: ExecutionContext,
  ): Promise<TaskResponse> {
    this.logger.log(`Routing HITL method: ${method}`);

    // Get API runner (handles all agent types for HITL)
    const apiRunner = this.runnerRegistry.getRunner('api');

    // Pass the HITL method in request params so runner knows what to do
    const hitlRequest = {
      ...request,
      params: {
        ...request.params,
        hitlMethod: method, // hitl.resume, hitl.status, hitl.history, hitl.pending
      },
    };

    return apiRunner.execute(agent, hitlRequest, context);
  }

  /**
   * Route request - with special handling for _system agent slug
   * The _system slug is used for cross-agent queries like hitl.pending
   */
  async routeRequest(
    request: JsonRpcRequest,
    agent: AgentRuntimeDefinition | null,
    context: ExecutionContext,
    agentSlug: string,
  ): Promise<TaskResponse> {
    const method = request.method;

    // Handle _system agent slug for cross-agent queries
    if (agentSlug === '_system') {
      return this.routeSystemRequest(method, request, context);
    }

    // Route HITL methods to API agent runner
    if (method.startsWith('hitl.')) {
      return this.routeHitlMethod(method, request, agent!, context);
    }

    // ... existing routing logic
  }

  /**
   * Handle requests to the _system pseudo-agent
   * This is for cross-agent queries that don't need a specific agent definition
   */
  private async routeSystemRequest(
    method: string,
    request: JsonRpcRequest,
    context: ExecutionContext,
  ): Promise<TaskResponse> {
    // Only hitl.pending is supported for _system
    if (method !== 'hitl.pending') {
      return this.buildErrorResponse(
        `Method ${method} not supported for _system agent. Only hitl.pending is allowed.`
      );
    }

    return this.handleHitlPending(request, context);
  }

  private async handleHitlPending(
    request: JsonRpcRequest,
    context: ExecutionContext,
  ): Promise<TaskResponse> {
    // hitl.pending is a cross-agent query - no agent definition needed
    // Route directly to API Runner with null agent
    const apiRunner = this.runnerRegistry.getRunner('api');

    return apiRunner.execute(
      null, // No specific agent needed for pending list
      {
        ...request,
        params: {
          ...request.params,
          hitlMethod: 'hitl.pending',
        },
      },
      context,
    );
  }

  private buildErrorResponse(message: string): TaskResponse {
    return {
      success: false,
      error: message,
    };
  }
}
```

---

## Task 2: Update API Agent Runner for HITL Detection

### 2.1 Add HITL Imports and Dependencies

**File**: `apps/api/src/agent2agent/services/api-agent-runner.service.ts`

Add imports:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { DeliverableVersionsService } from '../deliverables/deliverable-versions.service';
import { TasksService } from '../../tasks/tasks.service';
import { ConversationsService } from '../../conversations/conversations.service';
import {
  DeliverableVersionCreationType,
  DeliverableFormat,
} from '../deliverables/dto';
import {
  isLangGraphInterruptResponse,
  type HitlDecision,
  type HitlGeneratedContent,
  type HitlDeliverableResponse,
  type HitlStatusResponse,
  type HitlHistoryResponse,
  type HitlPendingListResponse,
  type HitlPendingItem,
  type LangGraphInterruptResponse,
} from '@orchestrator-ai/transport-types';
```

Add to constructor:
```typescript
constructor(
  private readonly httpService: HttpService,
  private readonly deliverablesService: DeliverablesService,
  private readonly versionsService: DeliverableVersionsService,
  private readonly tasksService: TasksService,
  private readonly conversationsService: ConversationsService,
  // ... existing dependencies
) {
  super();
}
```

### 2.2 Add Main HITL Method Handler

```typescript
/**
 * Handle HITL methods (called from executeTask when hitlMethod is present)
 */
private async handleHitlMethod(
  hitlMethod: string,
  request: TaskRequestParams,
  definition: AgentRuntimeDefinition | null,
  context: ExecutionContext,
): Promise<TaskResponse> {
  this.logger.log(`Handling HITL method: ${hitlMethod}`);

  switch (hitlMethod) {
    case 'hitl.resume':
      if (!definition) {
        return this.buildErrorResponse('Agent definition required for hitl.resume');
      }
      return this.handleHitlResume(definition, request, context);

    case 'hitl.status':
      return this.handleHitlStatus(request, context);

    case 'hitl.history':
      return this.handleHitlHistory(request, context);

    case 'hitl.pending':
      return this.handleHitlPending(context);

    default:
      return this.buildErrorResponse(`Unknown HITL method: ${hitlMethod}`);
  }
}

/**
 * Update executeTask to check for HITL methods
 */
async executeTask(
  definition: AgentRuntimeDefinition | null,
  request: TaskRequestParams,
  context: ExecutionContext,
): Promise<TaskResponse> {
  // Check if this is an HITL method
  const hitlMethod = request.params?.hitlMethod as string | undefined;
  if (hitlMethod) {
    return this.handleHitlMethod(hitlMethod, request, definition, context);
  }

  // Normal task execution...
  // (existing implementation)
}
```

### 2.3 Add HITL Response Detection and Processing

```typescript
/**
 * Process LangGraph response and detect HITL interrupt
 */
private async processLangGraphResponse(
  response: unknown,
  request: TaskRequestParams,
  context: {
    conversationId: string;
    userId: string;
    organizationSlug: string;
    agentSlug: string;
    taskId: string;
  },
): Promise<TaskResponse> {
  // Check if this is an HITL interrupt response
  if (isLangGraphInterruptResponse(response)) {
    return this.handleHitlInterruptResponse(response, request, context);
  }

  // Normal completion - build standard response
  return this.buildCompletionResponse(response, request, context);
}

/**
 * Handle HITL interrupt response from LangGraph
 * - Creates/updates deliverable with generated content (linked to task via task_id)
 * - Sets task.hitl_pending = true (NOT conversation-level)
 * - Returns HITL response to frontend
 */
private async handleHitlInterruptResponse(
  response: LangGraphInterruptResponse,
  request: TaskRequestParams,
  context: {
    conversationId: string;
    userId: string;
    organizationSlug: string;
    agentSlug: string;
    taskId: string;
  },
): Promise<TaskResponse> {
  const taskId = context.taskId;

  // Extract interrupt data
  const interruptData = response.__interrupt__[0];
  const interruptValue = interruptData.value;

  this.logger.log(`HITL interrupt detected: node=${interruptValue.nodeName}, taskId=${taskId}`);

  // Extract generated content from interrupt or state values
  const generatedContent = this.extractGeneratedContent(interruptValue, response.values);
  const topic = interruptValue.topic || this.extractTopic(response.values);
  const message = interruptValue.message || 'Please review the generated content';

  // Determine if this is a regeneration (deliverable already exists for this task)
  const existingDeliverable = await this.deliverablesService.findByTaskId(
    taskId,
    context.userId,
  );
  const isRegeneration = !!existingDeliverable;

  // Create or update deliverable with the generated content
  // Note: deliverable is linked to task via task_id
  const deliverable = await this.createOrUpdateDeliverable(
    generatedContent,
    context,
    isRegeneration ? 'ai_regenerated' : 'ai_generated',
  );

  // Set TASK as HITL pending (not conversation)
  await this.setTaskHitlPending(taskId, true);

  // Get current version info
  const currentVersion = await this.versionsService.getCurrentVersion(
    deliverable.id,
    context.userId,
  );

  // Build HITL response
  const hitlResponse: HitlDeliverableResponse = {
    taskId,
    conversationId: context.conversationId,
    status: 'hitl_waiting',
    deliverableId: deliverable.id,
    currentVersionNumber: currentVersion?.versionNumber || 1,
    message,
    topic,
    agentSlug: context.agentSlug,
    nodeName: interruptValue.nodeName,
    generatedContent,
  };

  return {
    success: true,
    mode: 'hitl',
    payload: hitlResponse,
    metadata: {
      taskId: context.taskId,
      conversationId: context.conversationId,
    },
  };
}

/**
 * Set task hitl_pending flag
 * Note: HITL pending is on TASKS table, not conversations
 * This is future-proof for multiple tasks per conversation
 */
private async setTaskHitlPending(
  taskId: string,
  pending: boolean,
): Promise<void> {
  await this.tasksService.update(taskId, {
    hitl_pending: pending,
    hitl_pending_since: pending ? new Date() : null,
  });
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
  const { taskId, decision, feedback, content } = request.params as {
    taskId: string;
    decision: HitlDecision;
    feedback?: string;
    content?: HitlGeneratedContent;
  };

  this.logger.log(`HITL resume: taskId=${taskId}, decision=${decision}`);

  // Validate the request
  if (!taskId) {
    return this.buildErrorResponse('HITL resume requires taskId');
  }

  // Validate decision-specific requirements
  if (decision === 'regenerate' && !feedback?.trim()) {
    return this.buildErrorResponse('Feedback is required for regenerate decision');
  }

  if (decision === 'replace' && !content) {
    return this.buildErrorResponse('Content is required for replace decision');
  }

  // Find deliverable via conversation
  const conversationId = context.conversationId;
  const deliverables = await this.deliverablesService.findByConversationId(
    conversationId,
    context.userId,
  );

  const deliverable = deliverables[0];

  // Handle REPLACE decision - create version before resuming
  if (decision === 'replace' && content && deliverable) {
    await this.versionsService.createVersion(
      deliverable.id,
      {
        content: this.contentToString(content),
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

  // Build resume command for LangGraph
  const resumePayload = this.buildResumePayload(decision, feedback, content);

  // Resume the LangGraph workflow
  const response = await this.resumeLangGraph(
    definition,
    taskId,
    resumePayload,
    context,
  );

  // Process the response (may return another HITL or completion)
  return this.processLangGraphResponse(response, request, {
    conversationId: context.conversationId,
    userId: context.userId,
    organizationSlug: context.organizationSlug,
    agentSlug: definition.slug,
    taskId,
  });
}

/**
 * Build resume payload based on decision
 */
private buildResumePayload(
  decision: HitlDecision,
  feedback?: string,
  content?: HitlGeneratedContent,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    hitlDecision: decision,
    hitlPending: false, // Clear pending flag in state
  };

  if (decision === 'regenerate' && feedback) {
    payload.hitlFeedback = feedback;
  }

  if (decision === 'replace' && content) {
    // Pass the user's content to update state
    if (content.blogPost) payload.blogPost = content.blogPost;
    if (content.seoDescription) payload.seoDescription = content.seoDescription;
    if (content.socialPosts) payload.socialPosts = content.socialPosts;
  }

  return payload;
}

/**
 * Resume LangGraph workflow with decision
 */
private async resumeLangGraph(
  definition: AgentRuntimeDefinition,
  taskId: string,
  resumePayload: Record<string, unknown>,
  context: ExecutionContext,
): Promise<unknown> {
  // Get the LangGraph endpoint from agent definition
  const endpoint = this.getLangGraphEndpoint(definition);

  this.logger.log(`Resuming LangGraph: endpoint=${endpoint}, taskId=${taskId}`);

  // Build the Command(resume=...) structure
  // LangGraph expects the resume values to update state
  const requestBody = {
    thread_id: taskId, // taskId IS the thread_id
    command: {
      resume: resumePayload,
    },
    config: {
      configurable: {
        thread_id: taskId,
      },
    },
  };

  try {
    const response = await this.httpService.axiosRef.post(
      `${endpoint}/runs/resume`,
      requestBody,
      {
        headers: this.buildHeaders(definition),
        timeout: 120000, // 2 minute timeout for LLM operations
      },
    );

    return response.data;
  } catch (error) {
    this.logger.error(`LangGraph resume failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get LangGraph endpoint from agent definition
 */
private getLangGraphEndpoint(definition: AgentRuntimeDefinition): string {
  // Check api_configuration for endpoint
  if (definition.api_configuration?.endpoint) {
    return definition.api_configuration.endpoint;
  }

  // Default to LangGraph service URL
  const baseUrl = process.env.LANGGRAPH_SERVICE_URL || 'http://localhost:6500';
  return `${baseUrl}/agents/${definition.slug}`;
}

/**
 * Build headers for LangGraph request
 */
private buildHeaders(definition: AgentRuntimeDefinition): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth if configured
  if (definition.api_configuration?.authentication?.headers) {
    Object.assign(headers, definition.api_configuration.authentication.headers);
  }

  return headers;
}
```

---

## Task 4: Implement HITL Status, History, and Pending Handlers

### 4.1 Add Status Handler

```typescript
/**
 * Handle HITL status request
 * Gets status from TASK (not conversation) and deliverable
 */
private async handleHitlStatus(
  request: TaskRequestParams,
  context: ExecutionContext,
): Promise<TaskResponse> {
  const { taskId } = request.params as { taskId: string };

  if (!taskId) {
    return this.buildErrorResponse('taskId is required');
  }

  // Get task to check hitl_pending (NOT conversation)
  const task = await this.tasksService.findOne(taskId);

  // Find deliverable via task_id (NOT conversation)
  const deliverable = await this.deliverablesService.findByTaskId(
    taskId,
    context.userId,
  );

  let currentVersionNumber: number | undefined;

  if (deliverable) {
    const currentVersion = await this.versionsService.getCurrentVersion(
      deliverable.id,
      context.userId,
    );
    currentVersionNumber = currentVersion?.versionNumber;
  }

  const statusResponse: HitlStatusResponse = {
    taskId,
    status: task?.hitl_pending ? 'hitl_waiting' : 'completed',
    hitlPending: task?.hitl_pending || false,
    deliverableId: deliverable?.id,
    currentVersionNumber,
  };

  return {
    success: true,
    mode: 'hitl',
    payload: statusResponse,
  };
}
```

### 4.2 Add History Handler

```typescript
/**
 * Handle HITL history request (version history via deliverables)
 * Note: Finds deliverable by task_id, not conversation_id
 */
private async handleHitlHistory(
  request: TaskRequestParams,
  context: ExecutionContext,
): Promise<TaskResponse> {
  const { taskId } = request.params as { taskId: string };

  if (!taskId) {
    return this.buildErrorResponse('taskId is required');
  }

  // Find deliverable via task_id (NOT conversation)
  const deliverable = await this.deliverablesService.findByTaskId(
    taskId,
    context.userId,
  );

  if (!deliverable) {
    const historyResponse: HitlHistoryResponse = {
      taskId,
      deliverableId: '',
      versionCount: 0,
      currentVersionNumber: 0,
    };

    return {
      success: true,
      mode: 'hitl',
      payload: historyResponse,
    };
  }

  // Get version history
  const versions = await this.versionsService.getVersionHistory(
    deliverable.id,
    context.userId,
  );

  const currentVersion = versions.find((v) => v.isCurrentVersion);

  const historyResponse: HitlHistoryResponse = {
    taskId,
    deliverableId: deliverable.id,
    versionCount: versions.length,
    currentVersionNumber: currentVersion?.versionNumber || 0,
  };

  return {
    success: true,
    mode: 'hitl',
    payload: historyResponse,
  };
}
```

### 4.3 Add Pending Handler

```typescript
/**
 * Handle HITL pending request (all pending reviews for user)
 * This queries TASKS with hitl_pending = true (NOT conversations)
 * Future-proof for multiple tasks per conversation
 */
private async handleHitlPending(
  context: ExecutionContext,
): Promise<TaskResponse> {
  // Query TASKS with hitl_pending = true for this user
  const pendingTasks = await this.tasksService.findPendingHitl(
    context.userId,
    context.organizationSlug,
  );

  // Build pending items list
  const items: HitlPendingItem[] = [];

  for (const task of pendingTasks) {
    // Get conversation for context
    const conversation = await this.conversationsService.findOne(task.conversation_id);

    // Get deliverable for this task (via task_id)
    const deliverable = await this.deliverablesService.findByTaskId(
      task.id,
      context.userId,
    );

    let currentVersionNumber: number | undefined;

    if (deliverable) {
      const currentVersion = await this.versionsService.getCurrentVersion(
        deliverable.id,
        context.userId,
      );
      currentVersionNumber = currentVersion?.versionNumber;
    }

    items.push({
      // taskId is the PRIMARY identifier
      taskId: task.id,
      agentSlug: task.agent_slug || 'unknown',
      pendingSince: task.hitl_pending_since?.toISOString() || new Date().toISOString(),
      // Conversation info for navigation/display
      conversationId: task.conversation_id,
      conversationTitle: conversation?.title || 'Untitled Conversation',
      // Deliverable info
      deliverableId: deliverable?.id,
      deliverableTitle: deliverable?.title,
      currentVersionNumber,
      agentName: task.agent_name,
      topic: deliverable?.title,
    });
  }

  const pendingResponse: HitlPendingListResponse = {
    items,
    totalCount: items.length,
  };

  return {
    success: true,
    mode: 'hitl',
    payload: pendingResponse,
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
 * Extract generated content from interrupt value and state
 */
private extractGeneratedContent(
  interruptValue: { content?: HitlGeneratedContent },
  stateValues: Record<string, unknown>,
): HitlGeneratedContent {
  // Prefer content from interrupt value
  if (interruptValue.content) {
    return interruptValue.content;
  }

  // Fall back to state values
  return {
    blogPost: stateValues.blogPost as string | undefined,
    seoDescription: stateValues.seoDescription as string | undefined,
    socialPosts: stateValues.socialPosts as string[] | undefined,
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
    // Look for H1 heading
    const h1Match = content.blogPost.match(/^#\s+(.+)$/m);
    if (h1Match?.[1]) {
      return h1Match[1].trim();
    }

    // Fall back to first line
    const firstLine = content.blogPost.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100) {
      return firstLine.replace(/^#+\s*/, '');
    }
  }

  return 'Generated Content';
}

/**
 * Extract topic from state values
 */
private extractTopic(stateValues: Record<string, unknown>): string {
  if (typeof stateValues.topic === 'string') {
    return stateValues.topic;
  }

  if (typeof stateValues.userMessage === 'string') {
    return stateValues.userMessage.substring(0, 50);
  }

  return 'Content Generation';
}

/**
 * Build error response
 */
private buildErrorResponse(message: string): TaskResponse {
  return {
    success: false,
    error: message,
  };
}

/**
 * Build completion response (non-HITL)
 */
private buildCompletionResponse(
  response: unknown,
  request: TaskRequestParams,
  context: {
    conversationId: string;
    userId: string;
    taskId: string;
    agentSlug: string;
  },
): TaskResponse {
  // Clear HITL pending on TASK (not conversation) on completion
  this.setTaskHitlPending(context.taskId, false);

  return {
    success: true,
    mode: 'build',
    payload: response,
    metadata: {
      taskId: context.taskId,
      conversationId: context.conversationId,
    },
  };
}
```

---

## Task 6: Add TasksService and DeliverablesService Methods

### 6.1 Update TasksService for HITL Pending Query

**File**: `apps/api/src/tasks/tasks.service.ts`

Add method to find pending HITL tasks:

```typescript
/**
 * Find all tasks with pending HITL reviews for a user
 * Note: HITL pending is on TASKS table, not conversations
 */
async findPendingHitl(
  userId: string,
  organizationSlug?: string,
): Promise<Task[]> {
  const query = this.tasksRepository
    .createQueryBuilder('task')
    .innerJoin('task.conversation', 'conversation')
    .where('conversation.user_id = :userId', { userId })
    .andWhere('task.hitl_pending = :pending', { pending: true })
    .orderBy('task.hitl_pending_since', 'DESC');

  if (organizationSlug) {
    query.andWhere('conversation.organization_slug = :organizationSlug', {
      organizationSlug,
    });
  }

  return query.getMany();
}

/**
 * Update task with HITL pending support
 *
 * IMPORTANT: Safe Partial Update Pattern
 * - TypeORM's .update() only modifies specified columns
 * - Audit columns (updated_at) are handled by @UpdateDateColumn decorator
 * - Only whitelisted fields can be updated to prevent accidental overwrites
 */
async updateHitlPending(
  id: string,
  pending: boolean,
): Promise<Task> {
  // Explicitly update only HITL-related columns
  await this.tasksRepository
    .createQueryBuilder()
    .update(Task)
    .set({
      hitl_pending: pending,
      hitl_pending_since: pending ? new Date() : null,
      // updated_at is auto-handled by TypeORM @UpdateDateColumn
    })
    .where('id = :id', { id })
    .execute();

  return this.findOne(id);
}

/**
 * Generic partial update with field whitelist
 * Prevents accidental overwrites of unrelated fields
 */
async update(
  id: string,
  updates: Partial<{
    hitl_pending: boolean;
    hitl_pending_since: Date | null;
    status: string;
  }>,
): Promise<Task> {
  // Whitelist: only these fields can be updated via this method
  const allowedFields = ['hitl_pending', 'hitl_pending_since', 'status'];
  const safeUpdates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      safeUpdates[key] = value;
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return this.findOne(id);
  }

  await this.tasksRepository.update(id, safeUpdates);
  return this.findOne(id);
}
```

### 6.2 Update DeliverablesService for Task Lookup

**File**: `apps/api/src/deliverables/deliverables.service.ts`

Add method to find deliverable by task_id with proper access control:

```typescript
/**
 * Find deliverable by task_id with access control
 * Used by HITL handlers since deliverables link to tasks
 *
 * SECURITY: Verifies user has access via conversation ownership
 */
async findByTaskId(
  taskId: string,
  userId: string,
): Promise<Deliverable | null> {
  // Join through conversation to verify user access
  const deliverable = await this.deliverablesRepository
    .createQueryBuilder('deliverable')
    .innerJoin('deliverable.conversation', 'conversation')
    .where('deliverable.task_id = :taskId', { taskId })
    .andWhere('conversation.user_id = :userId', { userId })
    .getOne();

  return deliverable;
}

/**
 * Find deliverable by task_id with org-level access control
 * For cases where org membership grants access (e.g., team workspaces)
 */
async findByTaskIdWithOrgAccess(
  taskId: string,
  userId: string,
  organizationSlug: string,
): Promise<Deliverable | null> {
  const deliverable = await this.deliverablesRepository
    .createQueryBuilder('deliverable')
    .innerJoin('deliverable.conversation', 'conversation')
    .where('deliverable.task_id = :taskId', { taskId })
    .andWhere(
      '(conversation.user_id = :userId OR conversation.organization_slug = :organizationSlug)',
      { userId, organizationSlug }
    )
    .getOne();

  return deliverable;
}
```

---

## Task 7: Update Extended Post Writer to Use Simplified State

### 7.1 Update State Definition

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
  // Include all HITL base state (includes taskId, hitlDecision, etc.)
  ...HitlBaseStateAnnotation.spec,

  // === User Input ===
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  topic: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // === Generated Content ===
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

  // === Generation Tracking ===
  generationCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
});

export type ExtendedPostWriterState = typeof ExtendedPostWriterStateAnnotation.State;
```

### 7.2 Simplify HITL Nodes

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts`

```typescript
import { interrupt, Command } from '@langchain/langgraph';
import type { ExtendedPostWriterState } from './extended-post-writer.state';

/**
 * HITL Interrupt Node
 * Simply calls interrupt() - API Runner handles everything else
 */
async function hitl_interrupt(
  state: ExtendedPostWriterState,
): Promise<Partial<ExtendedPostWriterState>> {
  // Build content payload for interrupt
  const content = {
    blogPost: state.blogPost,
    seoDescription: state.seoDescription,
    socialPosts: state.socialPosts,
  };

  // Mark as pending and call interrupt
  // The interrupt value is returned to the API Runner
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
 * Decision is set by API Runner when resuming
 */
function route_after_hitl(state: ExtendedPostWriterState): string {
  const decision = state.hitlDecision;

  switch (decision) {
    case 'approve':
    case 'skip':
      // Content accepted, move to finalization
      return 'finalize';

    case 'replace':
      // User provided their own content (already in state)
      return 'finalize';

    case 'reject':
      // Start over completely
      return 'generate_blog_post';

    case 'regenerate':
      // Regenerate with feedback (feedback in state.hitlFeedback)
      return 'generate_blog_post';

    default:
      // Default to finalize
      return 'finalize';
  }
}

/**
 * Generate blog post node (uses feedback if regenerating)
 */
async function generate_blog_post(
  state: ExtendedPostWriterState,
): Promise<Partial<ExtendedPostWriterState>> {
  const { topic, hitlFeedback, generationCount } = state;

  // Build prompt with feedback if regenerating
  let prompt = `Write a comprehensive blog post about: ${topic}`;

  if (hitlFeedback) {
    prompt += `\n\nPrevious feedback to incorporate: ${hitlFeedback}`;
  }

  // ... LLM call to generate content ...

  return {
    blogPost: generatedBlogPost,
    generationCount: generationCount + 1,
    // Clear feedback after using it
    hitlFeedback: null,
    hitlDecision: null,
  };
}

// Graph construction
const graph = new StateGraph(ExtendedPostWriterStateAnnotation)
  .addNode('generate_blog_post', generate_blog_post)
  .addNode('generate_seo', generate_seo)
  .addNode('generate_social', generate_social)
  .addNode('hitl_interrupt', hitl_interrupt)
  .addNode('finalize', finalize)
  .addEdge(START, 'generate_blog_post')
  .addEdge('generate_blog_post', 'generate_seo')
  .addEdge('generate_seo', 'generate_social')
  .addEdge('generate_social', 'hitl_interrupt')
  .addConditionalEdges('hitl_interrupt', route_after_hitl, {
    generate_blog_post: 'generate_blog_post',
    finalize: 'finalize',
  })
  .addEdge('finalize', END);

export const extendedPostWriterGraph = graph.compile({
  checkpointer: new MemorySaver(), // Or PostgresSaver for production
});
```

---

## Success Criteria

1. [ ] Mode router routes `hitl.*` methods to API Runner
2. [ ] API Runner detects `__interrupt__` in LangGraph responses
3. [ ] Deliverable created on first HITL response with `task_id` linkage
4. [ ] **`task.hitl_pending` set to `true` on interrupt** (NOT conversation)
5. [ ] **`task.hitl_pending` set to `false` on completion**
6. [ ] New version created on regeneration (AI_ENHANCEMENT)
7. [ ] User replacement creates MANUAL_EDIT version before resuming
8. [ ] LangGraph resumes correctly with taskId as thread_id
9. [ ] All decision types work: APPROVE, REJECT, REGENERATE, REPLACE, SKIP
10. [ ] `hitl.status` returns pending state **from task** (not conversation)
11. [ ] `hitl.history` returns deliverable version info (via `task_id`)
12. [ ] `hitl.pending` queries **tasks table** for pending HITL
13. [ ] **DeliverablesService.findByTaskId** method added
14. [ ] **TasksService.findPendingHitl** method added
15. [ ] Extended post writer uses simplified state with taskId
16. [ ] Build passes: `npm run build`

---

## Files Modified

| File | Changes |
|------|---------|
| `apps/api/src/agent2agent/services/agent-mode-router.service.ts` | Route HITL methods |
| `apps/api/src/agent2agent/services/api-agent-runner.service.ts` | Add HITL detection, handlers, resume logic (uses TasksService) |
| `apps/api/src/tasks/tasks.service.ts` | Add `findPendingHitl`, `update` with `hitl_pending` |
| `apps/api/src/deliverables/deliverables.service.ts` | Add `findByTaskId` method |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.state.ts` | Use HitlBaseState with taskId |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts` | Simplify HITL nodes |

---

## Next Session
Session 3 will focus on end-to-end testing, error handling, and creating the frontend modal components using the shared components defined in Session 1.
