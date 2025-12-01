/**
 * HITL (Human-in-the-Loop) Handlers
 *
 * Handlers for HITL mode operations: resume, status, and history.
 * These handlers work with LangGraph or n8n workflows that have paused for human review.
 *
 * HITL requests come through the A2A transport layer, allowing any agent type
 * (context, tool, API, function, etc.) to support HITL workflows.
 *
 * After HITL completion, this handler creates deliverables from the finalContent
 * and returns a BUILD mode response (not HITL) so the frontend can process deliverables normally.
 */

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { Agent2AgentConversationsService } from '../agent-conversations.service';
import { DeliverablesService } from '../../deliverables/deliverables.service';
import {
  DeliverableFormat,
  DeliverableType,
  DeliverableVersionCreationType,
} from '../../deliverables/dto/create-deliverable.dto';
import { TaskRequestDto, AgentTaskMode } from '../../dto/task-request.dto';
import {
  TaskResponseDto,
  HitlResponsePayload,
} from '../../dto/task-response.dto';
import type {
  HitlDecision,
  HitlGeneratedContent,
  HitlStatus,
} from '@orchestrator-ai/transport-types';
import {
  handleError,
  resolveUserId,
  resolveConversationId,
} from './shared.helpers';

export interface HitlHandlerDependencies {
  httpService?: HttpService;
  conversationsService: Agent2AgentConversationsService;
  deliverablesService?: DeliverablesService;
}

interface HitlResumePayload {
  action: 'resume';
  taskId: string;
  decision: HitlDecision;
  editedContent?: Partial<HitlGeneratedContent>;
  feedback?: string;
}

interface HitlStatusPayload {
  action: 'status';
  taskId: string;
}

interface HitlHistoryPayload {
  action: 'history';
  taskId: string;
  limit?: number;
}

/**
 * Send resume to LangGraph and return the raw HTTP response.
 *
 * This is a helper function that just sends the resume request to LangGraph.
 * The caller is responsible for processing the response through normal BUILD flow.
 *
 * @returns The raw axios response from LangGraph, or null on error
 */
export async function sendHitlResume(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  services: HitlHandlerDependencies,
): Promise<{ response: unknown; error?: string } | null> {
  console.log(`🔍 [HITL-RESUME] Sending resume for agent: ${definition.slug}`);

  const payload = (request.payload ?? {}) as Partial<HitlResumePayload>;

  if (!payload.taskId) {
    return { response: null, error: 'taskId is required for HITL resume' };
  }

  if (!payload.decision) {
    return {
      response: null,
      error: 'decision is required for HITL resume (approve, edit, or reject)',
    };
  }

  // Get the LangGraph endpoint from agent's transport configuration
  const endpoint = resolveLangGraphEndpoint(definition);
  console.log(`🔍 [HITL-RESUME] Resolved LangGraph endpoint: ${endpoint}`);

  if (!endpoint) {
    return {
      response: null,
      error: 'Agent does not have a configured HITL endpoint',
    };
  }

  if (!services.httpService) {
    return {
      response: null,
      error: 'HttpService not available for HITL requests',
    };
  }

  // Build the resume request for LangGraph
  // Note: taskId is used as the LangGraph thread_id
  const resumeUrl = `${endpoint}/resume/${payload.taskId}`;
  console.log(`🔍 [HITL-RESUME] Resume URL: ${resumeUrl}`);

  const resumeBody: Record<string, unknown> = {
    decision: payload.decision,
  };

  if (payload.editedContent) {
    resumeBody.editedContent = payload.editedContent;
  }
  if (payload.feedback) {
    resumeBody.feedback = payload.feedback;
  }

  console.log(
    `🔍 [HITL-RESUME] Resume body:`,
    JSON.stringify(resumeBody, null, 2),
  );

  try {
    const response = await firstValueFrom(
      services.httpService.post(resumeUrl, resumeBody, {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    console.log(
      `🔍 [HITL-RESUME] LangGraph response status: ${response.status}`,
    );
    return { response: response };
  } catch (error) {
    console.log(`🔍 [HITL-RESUME] Error sending resume:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { response: null, error: errorMessage };
  }
}

/**
 * Handle HITL resume action - resume a paused workflow with human decision.
 *
 * IMPORTANT: After sending resume to LangGraph, the response is processed
 * through the normal BUILD flow. This function is only used for status/history
 * actions or when the caller needs an HITL-typed response.
 *
 * For resume actions that should return BUILD responses with deliverables,
 * use sendHitlResume() directly and process the response through BUILD flow.
 */
export async function handleHitlResume(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: HitlHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.conversationsService;

  try {
    const result = await sendHitlResume(definition, request, services);

    if (!result || result.error) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        result?.error || 'Failed to send resume to LangGraph',
      );
    }

    const axiosResponse = result.response as { status: number; data: unknown };
    const responseData = axiosResponse.data as Record<string, unknown>;
    const dataObj = responseData.data as Record<string, unknown> | undefined;

    console.log(
      `🔍 [HITL-RESUME] LangGraph response data:`,
      JSON.stringify(responseData, null, 2).slice(0, 500),
    );

    // Extract status from nested data object or top-level response
    const resultStatus =
      (dataObj?.status as string) || (responseData.status as string);
    const payload = (request.payload ?? {}) as Partial<HitlResumePayload>;

    // Build HITL response payload
    const hitlPayload: HitlResponsePayload = {
      taskId: payload.taskId || '',
      status: (resultStatus as HitlStatus) || 'completed',
      topic: (responseData.topic as string) || '',
      hitlPending: false,
      finalContent: (dataObj?.finalContent ||
        responseData.finalContent) as HitlGeneratedContent,
      generatedContent: (dataObj?.generatedContent ||
        responseData.generatedContent) as HitlGeneratedContent,
      duration: (dataObj?.duration || responseData.duration) as number,
    };

    // When HITL completes successfully, create deliverable and return BUILD format
    // Frontend expects standard BUILD response with { deliverable, version }
    if (resultStatus === 'completed' && services.deliverablesService) {
      const finalContent = hitlPayload.finalContent;
      if (finalContent) {
        // Build deliverable content from HITL finalContent
        const content = buildDeliverableContentFromHitl(finalContent);
        const title = hitlPayload.topic || 'HITL Content';

        // Get userId and conversationId from request context
        const userId = resolveUserId(request);
        const conversationId = resolveConversationId(request);

        if (userId && conversationId) {
          // Create deliverable through the service
          const deliverable = await services.deliverablesService.create(
            {
              title,
              conversationId,
              agentName: definition.slug,
              taskId: payload.taskId,
              type: DeliverableType.DOCUMENT,
              initialContent: content,
              initialFormat: DeliverableFormat.MARKDOWN,
              initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
              initialTaskId: payload.taskId,
              initialMetadata: {
                source: 'hitl_completed',
                decision: payload.decision,
              },
            },
            userId,
          );

          // Mark task as handled so controller doesn't try to create another deliverable
          const buildResponse = TaskResponseDto.success(AgentTaskMode.BUILD, {
            content: {
              deliverable: {
                id: deliverable.id,
                userId: deliverable.userId,
                conversationId: deliverable.conversationId,
                agentName: deliverable.agentName,
                title: deliverable.title,
                type: deliverable.type,
                createdAt: deliverable.createdAt,
                updatedAt: deliverable.updatedAt,
              },
              version: deliverable.currentVersion
                ? {
                    id: deliverable.currentVersion.id,
                    deliverableId: deliverable.id,
                    versionNumber: deliverable.currentVersion.versionNumber,
                    content: deliverable.currentVersion.content,
                    format: deliverable.currentVersion.format,
                    isCurrentVersion: deliverable.currentVersion.isCurrentVersion,
                    createdByType: deliverable.currentVersion.createdByType,
                    createdAt: deliverable.currentVersion.createdAt,
                    updatedAt: deliverable.currentVersion.updatedAt,
                  }
                : undefined,
            },
            metadata: {
              source: 'hitl_completed',
              agentSlug: definition.slug,
              decision: payload.decision,
            },
          });

          // Set flag to prevent duplicate deliverable creation in controller
          // Also set deliverableId so controller can update context
          const responseObj = buildResponse as unknown as Record<string, unknown>;
          responseObj.taskCompletionHandled = true;
          responseObj.deliverableId = deliverable.id;
          return buildResponse;
        }
      }
    }

    // Fallback to HITL response if deliverable creation fails or no finalContent
    if (resultStatus === 'completed') {
      return TaskResponseDto.hitlCompleted(hitlPayload, {
        agentSlug: definition.slug,
        decision: payload.decision,
      });
    } else if (resultStatus === 'rejected') {
      return TaskResponseDto.hitlRejected(hitlPayload, {
        agentSlug: definition.slug,
        decision: payload.decision,
      });
    } else {
      return TaskResponseDto.hitlStatus(hitlPayload, {
        agentSlug: definition.slug,
        decision: payload.decision,
      });
    }
  } catch (error) {
    console.log(`🔍 [HITL-RESUME] Error in handleHitlResume:`, error);
    return handleError(AgentTaskMode.HITL, error);
  }
}

/**
 * Build deliverable content from HITL finalContent
 * Combines blog post, SEO description, and social posts into a single markdown document
 */
function buildDeliverableContentFromHitl(
  finalContent: HitlGeneratedContent,
): string {
  const parts: string[] = [];

  if (finalContent.blogPost) {
    parts.push(finalContent.blogPost);
  }

  if (finalContent.seoDescription) {
    parts.push(
      '\n\n---\n\n## SEO Description\n\n' + finalContent.seoDescription,
    );
  }

  if (finalContent.socialPosts) {
    let socialPostsText = '';
    if (Array.isArray(finalContent.socialPosts)) {
      socialPostsText = finalContent.socialPosts
        .map((post, i) => {
          // Handle objects by serializing them properly
          if (typeof post === 'object' && post !== null) {
            return `${i + 1}. ${JSON.stringify(post, null, 2)}`;
          }
          return `${i + 1}. ${String(post)}`;
        })
        .join('\n\n');
    } else if (typeof finalContent.socialPosts === 'string') {
      socialPostsText = finalContent.socialPosts;
    } else if (typeof finalContent.socialPosts === 'object') {
      // Handle case where socialPosts is an object instead of array
      socialPostsText = JSON.stringify(finalContent.socialPosts, null, 2);
    }

    if (socialPostsText) {
      parts.push('\n\n---\n\n## Social Media Posts\n\n' + socialPostsText);
    }
  }

  return parts.join('') || 'No content generated';
}

/**
 * Handle HITL status action - get current status of a HITL workflow.
 *
 * This handler queries the LangGraph service for the current workflow status.
 */
export async function handleHitlStatus(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: HitlHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.conversationsService;

  try {
    const payload = (request.payload ?? {}) as Partial<HitlStatusPayload>;

    if (!payload.taskId) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'taskId is required for HITL status',
      );
    }

    // Get the LangGraph endpoint from agent's transport configuration
    const endpoint = resolveLangGraphEndpoint(definition);
    if (!endpoint) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'Agent does not have a configured HITL endpoint',
      );
    }

    // Query LangGraph for status
    // Note: taskId is used as the LangGraph thread_id
    const statusUrl = `${endpoint}/status/${payload.taskId}`;

    if (!services.httpService) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'HttpService not available for HITL requests',
      );
    }

    const response = await firstValueFrom(
      services.httpService.get(statusUrl, {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const responseData = response.data as Record<string, unknown>;

    // Build HITL response payload
    const hitlPayload: HitlResponsePayload = {
      taskId: payload.taskId,
      status: (responseData.status as HitlStatus) || 'started',
      topic: (responseData.topic as string) || '',
      hitlPending: (responseData.hitlPending as boolean) ?? false,
      generatedContent: responseData.generatedContent as HitlGeneratedContent,
      finalContent: responseData.finalContent as HitlGeneratedContent,
      error: responseData.error as string,
      duration: responseData.duration as number,
    };

    // Return status response
    if (hitlPayload.hitlPending) {
      return TaskResponseDto.hitlWaiting(hitlPayload, {
        agentSlug: definition.slug,
      });
    } else {
      return TaskResponseDto.hitlStatus(hitlPayload, {
        agentSlug: definition.slug,
      });
    }
  } catch (error) {
    return handleError(AgentTaskMode.HITL, error);
  }
}

/**
 * Handle HITL history action - get execution history for a HITL workflow.
 *
 * This handler queries the LangGraph service for workflow execution history.
 */
export async function handleHitlHistory(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: HitlHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.conversationsService;

  try {
    const payload = (request.payload ?? {}) as Partial<HitlHistoryPayload>;

    if (!payload.taskId) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'taskId is required for HITL history',
      );
    }

    // Get the LangGraph endpoint from agent's transport configuration
    const endpoint = resolveLangGraphEndpoint(definition);
    if (!endpoint) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'Agent does not have a configured HITL endpoint',
      );
    }

    // Query LangGraph for history
    // Note: taskId is used as the LangGraph thread_id
    const limit = payload.limit || 10;
    const historyUrl = `${endpoint}/history/${payload.taskId}?limit=${limit}`;

    if (!services.httpService) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'HttpService not available for HITL requests',
      );
    }

    const response = await firstValueFrom(
      services.httpService.get(historyUrl, {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const responseData = response.data as Record<string, unknown>;

    // Return history as task response
    return TaskResponseDto.success(AgentTaskMode.HITL, {
      content: {
        taskId: payload.taskId,
        history: responseData.history || responseData.checkpoints || [],
        status: responseData.status,
      },
      metadata: {
        agentSlug: definition.slug,
        action: 'history',
      },
    });
  } catch (error) {
    return handleError(AgentTaskMode.HITL, error);
  }
}

/**
 * Resolve the LangGraph endpoint from the agent's transport configuration.
 *
 * For HITL support, agents need either:
 * 1. A `transport.api.endpoint` that points to a LangGraph service
 * 2. A `transport.external.endpoint` for external A2A endpoints
 * 3. A dedicated HITL endpoint in `transport.raw.hitl.endpoint`
 *
 * The endpoint URL is normalized to remove common suffixes like /generate
 * since HITL endpoints use /resume/:threadId and /status/:threadId paths.
 */
function resolveLangGraphEndpoint(
  definition: AgentRuntimeDefinition,
): string | null {
  const transport = definition.transport;

  if (!transport) {
    return null;
  }

  // Check for dedicated HITL endpoint in raw config first
  const rawConfig = transport.raw as Record<string, unknown> | null | undefined;
  if (rawConfig?.hitl) {
    const hitlConfig = rawConfig.hitl as Record<string, unknown>;
    if (hitlConfig.endpoint && typeof hitlConfig.endpoint === 'string') {
      return hitlConfig.endpoint;
    }
  }

  // Fall back to API endpoint (for LangGraph/API agents)
  // Also check for 'url' in raw config as fallback
  let endpoint = transport.api?.endpoint;
  if (!endpoint && rawConfig) {
    endpoint =
      typeof rawConfig.url === 'string'
        ? rawConfig.url
        : typeof rawConfig.endpoint === 'string'
          ? rawConfig.endpoint
          : undefined;
  }

  if (endpoint) {
    // Strip common suffixes to get the base LangGraph endpoint
    // e.g., http://localhost:6200/extended-post-writer/generate -> http://localhost:6200/extended-post-writer
    return endpoint.replace(/\/(generate|invoke|run)$/, '');
  }

  // Check for external A2A endpoint
  if (transport.external?.endpoint) {
    return transport.external.endpoint.replace(/\/(generate|invoke|run)$/, '');
  }

  return null;
}
