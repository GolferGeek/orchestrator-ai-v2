/**
 * HITL (Human-in-the-Loop) Handlers
 *
 * Handlers for HITL mode operations: resume, status, and history.
 * These handlers work with LangGraph or n8n workflows that have paused for human review.
 *
 * HITL requests come through the A2A transport layer, allowing any agent type
 * (context, tool, API, function, etc.) to support HITL workflows.
 */

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { Agent2AgentConversationsService } from '../agent-conversations.service';
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
import { handleError } from './shared.helpers';

export interface HitlHandlerDependencies {
  httpService?: HttpService;
  conversationsService: Agent2AgentConversationsService;
}

interface HitlResumePayload {
  action: 'resume';
  threadId: string;
  decision: HitlDecision;
  editedContent?: Partial<HitlGeneratedContent>;
  feedback?: string;
}

interface HitlStatusPayload {
  action: 'status';
  threadId: string;
}

interface HitlHistoryPayload {
  action: 'history';
  threadId: string;
  limit?: number;
}

/**
 * Handle HITL resume action - resume a paused workflow with human decision.
 *
 * This handler forwards the resume request to the LangGraph service endpoint.
 * The agent's transport.api configuration should include the LangGraph base URL.
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
    const payload = (request.payload ?? {}) as Partial<HitlResumePayload>;

    if (!payload.threadId) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'threadId is required for HITL resume',
      );
    }

    if (!payload.decision) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'decision is required for HITL resume (approve, edit, or reject)',
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

    // Build the resume request for LangGraph
    const resumeUrl = `${endpoint}/resume/${payload.threadId}`;
    const resumeBody: Record<string, unknown> = {
      decision: payload.decision,
    };

    if (payload.editedContent) {
      resumeBody.editedContent = payload.editedContent;
    }
    if (payload.feedback) {
      resumeBody.feedback = payload.feedback;
    }

    // Forward to LangGraph
    if (!services.httpService) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'HttpService not available for HITL requests',
      );
    }

    const response = await firstValueFrom(
      services.httpService.post(resumeUrl, resumeBody, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const responseData = response.data as Record<string, unknown>;

    // Build HITL response payload
    const hitlPayload: HitlResponsePayload = {
      threadId: payload.threadId,
      status: (responseData.status as HitlStatus) || 'completed',
      topic: (responseData.topic as string) || '',
      hitlPending: false,
      finalContent: responseData.finalContent as HitlGeneratedContent,
      duration: responseData.duration as number,
    };

    // Return appropriate response based on decision result
    const status = responseData.status as HitlStatus;
    if (status === 'completed') {
      return TaskResponseDto.hitlCompleted(hitlPayload, {
        agentSlug: definition.slug,
        decision: payload.decision,
      });
    } else if (status === 'rejected') {
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
    return handleError(AgentTaskMode.HITL, error);
  }
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

    if (!payload.threadId) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'threadId is required for HITL status',
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
    const statusUrl = `${endpoint}/status/${payload.threadId}`;

    if (!services.httpService) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'HttpService not available for HITL requests',
      );
    }

    const response = await firstValueFrom(
      services.httpService.get(statusUrl, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const responseData = response.data as Record<string, unknown>;

    // Build HITL response payload
    const hitlPayload: HitlResponsePayload = {
      threadId: payload.threadId,
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

    if (!payload.threadId) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'threadId is required for HITL history',
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
    const limit = payload.limit || 10;
    const historyUrl = `${endpoint}/history/${payload.threadId}?limit=${limit}`;

    if (!services.httpService) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'HttpService not available for HITL requests',
      );
    }

    const response = await firstValueFrom(
      services.httpService.get(historyUrl, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const responseData = response.data as Record<string, unknown>;

    // Return history as task response
    return TaskResponseDto.success(AgentTaskMode.HITL, {
      content: {
        threadId: payload.threadId,
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
  if (transport.api?.endpoint) {
    return transport.api.endpoint;
  }

  // Check for external A2A endpoint
  if (transport.external?.endpoint) {
    return transport.external.endpoint;
  }

  return null;
}
