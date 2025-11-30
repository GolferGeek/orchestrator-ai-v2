/**
 * Request Switch - Maps triggers to transport mode x action and builds requests
 *
 * This module routes A2ATriggers to the appropriate request builder.
 * Context is obtained from the ExecutionContext store internally by each builder.
 *
 * Key Principle: Context is NEVER passed between methods.
 * Each builder function gets context from the store internally.
 * This function only maps triggers to the appropriate builder.
 *
 * @see docs/prd/unified-a2a-orchestrator.md - Request Switch Implementation
 */

import type { A2ATrigger, A2APayload } from './types';
import type { StrictA2ARequest, HitlGeneratedContent } from '@orchestrator-ai/transport-types';
import { buildRequest } from '../utils/builders';
import { useExecutionContextStore } from '@/stores/executionContextStore';

/**
 * Helper to get context from store
 * Used by the request switch to inject context into builder calls
 */
function getContext() {
  const store = useExecutionContextStore();
  return store.current;
}

/**
 * Maps triggers to transport mode x action and builds the request
 *
 * **Key Principle:** Context is obtained from the store and passed to builders.
 * Each builder still receives metadata with the context values.
 * This function only maps triggers to the appropriate builder.
 *
 * @param trigger - What action triggered this call (e.g., 'plan.create', 'hitl.approve')
 * @param payload - Trigger-specific payload data (versionId, feedback, etc.)
 * @returns A fully-formed JSON-RPC request ready to send to the API
 */
export function buildA2ARequest(
  trigger: A2ATrigger,
  payload: A2APayload,
): StrictA2ARequest {
  // Get context from store
  const ctx = getContext();

  // Build common metadata object for builders
  const metadata = {
    conversationId: ctx.conversationId,
    taskId: ctx.taskId,
    userMessage: payload.userMessage,
  };

  switch (trigger) {
    // =========================================================================
    // PLAN TRIGGERS
    // =========================================================================
    case 'plan.create':
      return buildRequest.plan.create(
        { ...metadata, userMessage: payload.userMessage! },
        payload.planData,
      );

    case 'plan.read':
      return buildRequest.plan.read(metadata, payload.versionId);

    case 'plan.list':
      return buildRequest.plan.list(metadata);

    case 'plan.edit':
      return buildRequest.plan.edit(
        { ...metadata, userMessage: payload.userMessage || 'Edit plan' },
        { content: payload.editedContent as string },
      );

    case 'plan.rerun':
      if (!payload.versionId) {
        throw new Error('versionId is required for plan.rerun');
      }
      if (!payload.rerunLlmOverride) {
        throw new Error('rerunLlmOverride is required for plan.rerun');
      }
      return buildRequest.plan.rerun(
        { ...metadata, userMessage: payload.userMessage || 'Regenerate plan' },
        { versionId: payload.versionId, config: payload.rerunLlmOverride as unknown as Record<string, unknown> },
      );

    case 'plan.set_current':
      if (!payload.versionId) {
        throw new Error('versionId is required for plan.set_current');
      }
      return buildRequest.plan.setCurrent(metadata, payload.versionId);

    case 'plan.delete_version':
      if (!payload.versionId) {
        throw new Error('versionId is required for plan.delete_version');
      }
      return buildRequest.plan.deleteVersion(metadata, payload.versionId);

    case 'plan.merge_versions':
      if (!payload.versionIds || payload.versionIds.length < 2) {
        throw new Error('At least 2 versionIds are required for plan.merge_versions');
      }
      if (!payload.mergePrompt) {
        throw new Error('mergePrompt is required for plan.merge_versions');
      }
      return buildRequest.plan.mergeVersions(
        { ...metadata, userMessage: payload.userMessage || 'Merge plan versions' },
        { versionIds: payload.versionIds, mergePrompt: payload.mergePrompt },
      );

    case 'plan.copy_version':
      if (!payload.versionId) {
        throw new Error('versionId is required for plan.copy_version');
      }
      return buildRequest.plan.copyVersion(metadata, payload.versionId);

    case 'plan.delete':
      // planId comes from context
      return buildRequest.plan.delete(metadata, ctx.planId);

    // =========================================================================
    // BUILD TRIGGERS
    // =========================================================================
    case 'build.create':
      return buildRequest.build.execute(
        { ...metadata, userMessage: payload.userMessage! },
        { planId: ctx.planId },
      );

    case 'build.read':
      return buildRequest.build.read(metadata, payload.versionId);

    case 'build.list':
      return buildRequest.build.list(metadata);

    case 'build.edit':
      return buildRequest.build.edit(
        { ...metadata, userMessage: payload.userMessage || 'Edit deliverable' },
        { content: payload.editedContent as string },
      );

    case 'build.rerun':
      if (!payload.versionId) {
        throw new Error('versionId is required for build.rerun');
      }
      if (!payload.rerunLlmOverride) {
        throw new Error('rerunLlmOverride is required for build.rerun');
      }
      return buildRequest.build.rerun(
        { ...metadata, userMessage: payload.userMessage || 'Regenerate deliverable' },
        { versionId: payload.versionId, config: payload.rerunLlmOverride as unknown as Record<string, unknown> },
      );

    case 'build.set_current':
      if (!payload.versionId) {
        throw new Error('versionId is required for build.set_current');
      }
      return buildRequest.build.setCurrent(metadata, payload.versionId);

    case 'build.delete_version':
      if (!payload.versionId) {
        throw new Error('versionId is required for build.delete_version');
      }
      return buildRequest.build.deleteVersion(metadata, payload.versionId);

    case 'build.merge_versions':
      if (!payload.versionIds || payload.versionIds.length < 2) {
        throw new Error('At least 2 versionIds are required for build.merge_versions');
      }
      if (!payload.mergePrompt) {
        throw new Error('mergePrompt is required for build.merge_versions');
      }
      return buildRequest.build.mergeVersions(
        { ...metadata, userMessage: payload.userMessage || 'Merge deliverable versions' },
        { versionIds: payload.versionIds, mergePrompt: payload.mergePrompt },
      );

    case 'build.copy_version':
      if (!payload.versionId) {
        throw new Error('versionId is required for build.copy_version');
      }
      return buildRequest.build.copyVersion(metadata, payload.versionId);

    case 'build.delete':
      // deliverableId comes from context
      return buildRequest.build.delete(metadata, ctx.deliverableId);

    // =========================================================================
    // CONVERSE TRIGGERS
    // =========================================================================
    case 'converse.send':
      return buildRequest.converse.send(
        { ...metadata, userMessage: payload.userMessage! },
      );

    // =========================================================================
    // HITL TRIGGERS
    // =========================================================================
    case 'hitl.approve':
      return buildRequest.hitl.resume(
        { ...metadata, taskId: ctx.taskId },
        { decision: 'approve' },
      );

    case 'hitl.reject':
      return buildRequest.hitl.resume(
        { ...metadata, taskId: ctx.taskId },
        { decision: 'reject' },
      );

    case 'hitl.regenerate':
      if (!payload.feedback) {
        throw new Error('feedback is required for hitl.regenerate');
      }
      return buildRequest.hitl.resume(
        { ...metadata, taskId: ctx.taskId },
        { decision: 'regenerate', feedback: payload.feedback },
      );

    case 'hitl.replace':
      if (!payload.content) {
        throw new Error('content is required for hitl.replace');
      }
      return buildRequest.hitl.resume(
        { ...metadata, taskId: ctx.taskId },
        { decision: 'replace', content: payload.content as HitlGeneratedContent },
      );

    case 'hitl.skip':
      return buildRequest.hitl.resume(
        { ...metadata, taskId: ctx.taskId },
        { decision: 'skip' },
      );

    case 'hitl.status':
      return buildRequest.hitl.status({ ...metadata, taskId: ctx.taskId });

    case 'hitl.history':
      return buildRequest.hitl.history({ ...metadata, taskId: ctx.taskId });

    case 'hitl.pending':
      return buildRequest.hitl.pending(metadata, { agentSlug: payload.agentSlug });

    // =========================================================================
    // UNKNOWN TRIGGER
    // =========================================================================
    default:
      throw new Error(`Unknown trigger: ${trigger}`);
  }
}
