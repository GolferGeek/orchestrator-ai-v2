/**
 * ExecutionContext Builder Utility
 *
 * Builds ExecutionContext for every API request from the frontend.
 * Uses authStore for userId and organizationStore (rbacStore) for orgSlug.
 */
import { useRbacStore } from '@/stores/rbacStore';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';

export function buildExecutionContext(
  conversationId: string,
  options?: {
    taskId?: string;
    deliverableId?: string;
    agentSlug?: string;
    agentType?: string;
  }
): ExecutionContext {
  const rbacStore = useRbacStore();

  if (!rbacStore.user?.id) {
    throw new Error('User not authenticated');
  }

  if (!rbacStore.currentOrganization) {
    throw new Error('No organization selected');
  }

  return {
    orgSlug: rbacStore.currentOrganization,
    userId: rbacStore.user.id,
    conversationId,
    taskId: options?.taskId,
    deliverableId: options?.deliverableId,
    agentSlug: options?.agentSlug,
    agentType: options?.agentType,
  };
}
