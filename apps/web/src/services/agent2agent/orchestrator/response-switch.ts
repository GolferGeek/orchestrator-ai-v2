/**
 * Response Switch - Handles all A2A responses based on response mode
 *
 * This module processes API responses and updates the appropriate stores.
 * The response mode determines what we do - and it may differ from request mode!
 *
 * CRITICAL: The response mode may differ from the request mode!
 * - BUILD request can return HITL response (hitl_waiting)
 * - HITL request can return BUILD response (completed with deliverable)
 *
 * CRITICAL: Updates ExecutionContext store after every response!
 * The backend may have updated the context (added planId/deliverableId),
 * so we must update the store with the returned context.
 *
 * @see docs/prd/unified-a2a-orchestrator.md - Response Switch Implementation
 */

import type { A2AResult } from './types';
import type {
  TaskResponse,
  HitlDeliverableResponse,
  PlanData,
  PlanVersionData,
  DeliverableData,
  DeliverableVersionData,
  ExecutionContext,
} from '@orchestrator-ai/transport-types';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { usePlanStore } from '@/stores/planStore';
import { useConversationsStore } from '@/stores/conversationsStore';
import type {
  Deliverable,
  DeliverableVersion,
  DeliverableType,
  DeliverableFormat,
  DeliverableVersionCreationType,
} from '@/services/deliverablesService';

/**
 * Extended TaskResponse with context - what we expect from the backend
 * The standard TaskResponse doesn't include context, but our backend adds it
 */
interface TaskResponseWithContext extends TaskResponse {
  context?: ExecutionContext;
}

/**
 * Helper to map transport type to store DeliverableType
 */
function mapDeliverableType(type?: string): DeliverableType | undefined {
  if (!type) return undefined;
  const validTypes = ['document', 'analysis', 'report', 'plan', 'requirements'];
  return validTypes.includes(type.toLowerCase())
    ? (type.toLowerCase() as DeliverableType)
    : undefined;
}

/**
 * Helper to map transport format to store DeliverableFormat
 */
function mapDeliverableFormat(format?: string): DeliverableFormat | undefined {
  if (!format) return undefined;
  const validFormats = ['markdown', 'text', 'json', 'html'];
  return validFormats.includes(format.toLowerCase())
    ? (format.toLowerCase() as DeliverableFormat)
    : undefined;
}

/**
 * Helper to map createdByType
 */
function mapCreatedByType(createdByType?: string): DeliverableVersionCreationType {
  const validTypes = ['ai_response', 'manual_edit', 'ai_enhancement', 'user_request'];
  if (createdByType && validTypes.includes(createdByType)) {
    return createdByType as DeliverableVersionCreationType;
  }
  return 'ai_response' as DeliverableVersionCreationType;
}

/**
 * Handles all A2A responses - the response mode determines what we do
 *
 * CRITICAL: The response mode may differ from the request mode!
 * - BUILD request can return HITL response (hitl_waiting)
 * - HITL request can return BUILD response (completed with deliverable)
 *
 * CRITICAL: Updates ExecutionContext store after every response!
 * The backend may have updated the context (added planId/deliverableId),
 * so we must update the store with the returned context.
 *
 * **Context Handling (Store-First Approach):**
 * - Gets ExecutionContext from store internally (never passed as parameter)
 * - Updates ExecutionContext store with response.context after processing
 * - All store updates happen here - single source of truth for response handling
 *
 * @param response - The TaskResponse from the API (with optional context)
 * @returns Unified result that UI can switch on
 */
export async function handleA2AResponse(response: TaskResponse): Promise<A2AResult> {
  // Cast to extended type that may have context
  const responseWithContext = response as TaskResponseWithContext;

  // Get stores
  const executionContextStore = useExecutionContextStore();

  // Update ExecutionContext store with response context (backend may have updated it)
  // This is the ONLY place context changes (besides user changing provider/model)
  if (responseWithContext.context) {
    executionContextStore.update(responseWithContext.context);
  }

  // Get updated context from store for use in this function
  const ctx = executionContextStore.current;

  // Fail-fast on error responses
  // Note: HITL responses use success=true with status='hitl_waiting', so this is safe
  if (!response.success) {
    const errorMessage = response.error?.message || 'Request failed';
    const errorCode = response.error?.code;
    return {
      type: 'error',
      error: errorMessage,
      code: typeof errorCode === 'string' ? parseInt(errorCode, 10) : errorCode,
      context: responseWithContext.context,
    };
  }

  const mode = response.mode;
  const content = response.payload?.content as Record<string, unknown> | undefined;
  const metadata = response.payload?.metadata as Record<string, unknown> | undefined;

  switch (mode) {
    // =========================================================================
    // PLAN RESPONSES
    // =========================================================================
    case 'plan': {
      const planStore = usePlanStore();
      const plan = content?.plan as PlanData | undefined;
      const version = content?.version as PlanVersionData | undefined;

      if (plan) {
        planStore.addPlan(plan);
        planStore.associatePlanWithConversation(plan.id, ctx.conversationId);
      }

      if (version && plan) {
        planStore.addVersion(plan.id, version);
        if (version.isCurrentVersion) {
          planStore.setCurrentVersion(plan.id, version.id);
        }
      }

      return {
        type: 'plan',
        plan: plan!,
        version,
        context: responseWithContext.context || ctx,
      };
    }

    // =========================================================================
    // BUILD RESPONSES
    // =========================================================================
    case 'build': {
      const deliverablesStore = useDeliverablesStore();
      const deliverable = content?.deliverable as DeliverableData | undefined;
      const version = content?.version as DeliverableVersionData | undefined;

      if (deliverable) {
        // Map DeliverableData (transport type) to Deliverable (store type)
        const storeDeliverable: Deliverable = {
          id: deliverable.id,
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          title: deliverable.title || '',
          type: mapDeliverableType(deliverable.type),
          createdAt: deliverable.createdAt || new Date().toISOString(),
          updatedAt: deliverable.updatedAt || new Date().toISOString(),
          currentVersion: version ? {
            id: version.id,
            deliverableId: deliverable.id,
            versionNumber: version.versionNumber,
            content: version.content,
            format: mapDeliverableFormat(version.format),
            createdByType: mapCreatedByType(version.createdByType),
            isCurrentVersion: version.isCurrentVersion ?? true,
            createdAt: version.createdAt || new Date().toISOString(),
            updatedAt: version.createdAt || new Date().toISOString(),
          } : undefined,
        };

        deliverablesStore.addDeliverable(storeDeliverable);
        deliverablesStore.associateDeliverableWithConversation(
          deliverable.id,
          ctx.conversationId,
        );
      }

      if (version && deliverable) {
        const storeVersion: DeliverableVersion = {
          id: version.id,
          deliverableId: deliverable.id,
          versionNumber: version.versionNumber,
          content: version.content,
          format: mapDeliverableFormat(version.format),
          createdByType: mapCreatedByType(version.createdByType),
          isCurrentVersion: version.isCurrentVersion ?? true,
          createdAt: version.createdAt || new Date().toISOString(),
          updatedAt: version.createdAt || new Date().toISOString(),
        };

        deliverablesStore.addVersion(deliverable.id, storeVersion);
        if (version.isCurrentVersion) {
          deliverablesStore.setCurrentVersion(deliverable.id, version.id);
        }
      }

      return {
        type: 'deliverable',
        deliverable: deliverable!,
        version,
        context: responseWithContext.context || ctx,
      };
    }

    // =========================================================================
    // CONVERSE RESPONSES
    // =========================================================================
    case 'converse': {
      const conversationsStore = useConversationsStore();
      const message =
        (content?.message as string) ||
        response.humanResponse?.message ||
        '';
      const thinking = response.humanResponse?.thinking as string | undefined;

      if (message && ctx.conversationId) {
        conversationsStore.addMessage(ctx.conversationId, {
          conversationId: ctx.conversationId,
          role: 'assistant',
          content: message,
          timestamp: new Date().toISOString(),
          // Only add metadata if there's thinking content
          ...(thinking ? { metadata: { source: 'agent' as const } } : {}),
        });
      }

      return {
        type: 'message',
        message,
        metadata,
        context: responseWithContext.context || ctx,
      };
    }

    // =========================================================================
    // HITL RESPONSES
    // =========================================================================
    case 'hitl': {
      const hitlContent = content as HitlDeliverableResponse | undefined;
      const status = hitlContent?.status;

      // HITL still waiting (e.g., after regenerate)
      if (status === 'hitl_waiting' || status === 'regenerating') {
        return {
          type: 'hitl_waiting',
          taskId: hitlContent?.taskId || ctx.taskId,
          topic: hitlContent?.topic || '',
          generatedContent: hitlContent?.generatedContent || {},
          context: responseWithContext.context || ctx,
        };
      }

      // HITL completed - deliverable should be in response
      if (status === 'completed') {
        const deliverablesStore = useDeliverablesStore();
        const conversationsStore = useConversationsStore();
        const deliverableId = hitlContent?.deliverableId;

        if (deliverableId && hitlContent?.generatedContent) {
          // Create a deliverable from the HITL content
          const storeDeliverable: Deliverable = {
            id: deliverableId,
            userId: ctx.userId,
            conversationId: ctx.conversationId,
            title: hitlContent.topic || 'HITL Deliverable',
            type: 'document' as DeliverableType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentVersion: {
              id: crypto.randomUUID(),
              deliverableId,
              versionNumber: hitlContent.currentVersionNumber || 1,
              content: JSON.stringify(hitlContent.generatedContent),
              format: 'json' as DeliverableFormat,
              createdByType: 'ai_response' as DeliverableVersionCreationType,
              isCurrentVersion: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          };

          deliverablesStore.addDeliverable(storeDeliverable);
          deliverablesStore.associateDeliverableWithConversation(
            deliverableId,
            ctx.conversationId,
          );

          // Add completion message to conversation
          conversationsStore.addMessage(ctx.conversationId, {
            conversationId: ctx.conversationId,
            role: 'assistant',
            content: hitlContent.message || 'Content finalized!',
            timestamp: new Date().toISOString(),
          });

          return {
            type: 'deliverable',
            deliverable: {
              id: deliverableId,
              userId: ctx.userId,
              agentName: ctx.agentSlug,
              organization: ctx.orgSlug,
              conversationId: ctx.conversationId,
              title: hitlContent.topic || '',
              type: 'document',
              currentVersionId: storeDeliverable.currentVersion!.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            version: {
              id: storeDeliverable.currentVersion!.id,
              deliverableId,
              versionNumber: hitlContent.currentVersionNumber || 1,
              content: JSON.stringify(hitlContent.generatedContent),
              format: 'json',
              createdByType: 'agent',
              createdById: null,
              isCurrentVersion: true,
              createdAt: new Date().toISOString(),
            },
            context: responseWithContext.context || ctx,
          };
        }

        return {
          type: 'success',
          message: hitlContent?.message,
          context: responseWithContext.context || ctx,
        };
      }

      // HITL rejected
      if (status === 'rejected') {
        return {
          type: 'success',
          message: 'Content rejected',
          context: responseWithContext.context || ctx,
        };
      }

      // HITL pending list response
      if ((content as { items?: unknown[] })?.items) {
        const items = (content as { items: unknown[] }).items;
        return {
          type: 'success',
          message: `${items.length} pending reviews`,
          context: responseWithContext.context || ctx,
        };
      }

      // Default - return whatever we got
      return {
        type: 'success',
        message: hitlContent?.message,
        context: responseWithContext.context || ctx,
      };
    }

    // =========================================================================
    // UNKNOWN MODE
    // =========================================================================
    default:
      console.warn(`Unknown response mode: ${mode}`);
      return {
        type: 'error',
        error: `Unknown response mode: ${mode}`,
        context: responseWithContext.context,
      };
  }
}
