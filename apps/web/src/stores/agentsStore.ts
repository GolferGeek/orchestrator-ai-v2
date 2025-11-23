/**
 * Agents Store - State + Synchronous Mutations Only
 *
 * Phase 4.2 Refactoring: Removed all async methods
 * Use agentsService for API calls
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AgentInfo } from '../types/chat';
import type { HierarchyNode, AgentNodeMetadata, AgentHierarchyResponse } from '@/types/agent';
import type { JsonObject } from '@orchestrator-ai/transport-types';

interface NormalizedHierarchyResponse {
  data: HierarchyNode[];
  metadata?: AgentNodeMetadata | null;
  rest: JsonObject;
}

// Re-export for backward compatibility
export type { HierarchyNode, AgentNodeMetadata };

export function normalizeHierarchyResponse(input: HierarchyNode[] | AgentHierarchyResponse | null | undefined): NormalizedHierarchyResponse {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const { data, metadata, ...rest } = input as AgentHierarchyResponse;

    // Handle department-grouped format (v2)
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Convert department object to flat array
      const flatAgents: HierarchyNode[] = [];
      for (const department in data) {
        const departmentAgents = data[department];
        if (Array.isArray(departmentAgents)) {
          flatAgents.push(...departmentAgents.map((agent: Record<string, unknown>) => ({
            id: agent.id || agent.slug,
            name: agent.slug || agent.name,
            displayName: agent.displayName || agent.name,
            type: 'agent' as const, // HierarchyNode type (not agentType)
            agentType: agent.type, // The actual database agent type (context, api, etc.)
            organizationSlug: agent.organizationSlug,
            metadata: {
              ...agent.metadata,
              description: agent.description,
              department,
            },
            children: [],
          })));
        }
      }
      return {
        data: flatAgents,
        metadata: metadata ?? null,
        rest: rest as JsonObject,
      };
    }

    return {
      data: Array.isArray(data) ? data : [],
      metadata: metadata ?? null,
      rest: rest as JsonObject,
    };
  }

  return {
    data: Array.isArray(input) ? input : [],
    metadata: null,
    rest: {},
  };
}

export function filterHierarchyByOrganization(
  hierarchy: HierarchyNode[] | AgentHierarchyResponse | null | undefined,
  organization: string,
) {
  const { data, metadata, rest } = normalizeHierarchyResponse(hierarchy);

  const prune = (tree: HierarchyNode[]): HierarchyNode[] => {
    const result: HierarchyNode[] = [];

    for (const node of tree) {
      const children = Array.isArray(node.children) ? prune(node.children) : [];
      const nodeOrganization = node.organizationSlug || node.metadata?.organizationSlug;

      const matchesOrganization =
        !nodeOrganization || nodeOrganization === organization || nodeOrganization === 'global' || children.length > 0;

      if (matchesOrganization) {
        result.push({ ...node, children });
      }
    }

    return result;
  };

  const filtered = prune(data);

  return {
    data: filtered,
    metadata,
    ...rest,
  };
}

// Alias for backward compatibility
export const filterHierarchyByNamespace = filterHierarchyByOrganization;

export const useAgentsStore = defineStore('agents', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  const availableAgents = ref<AgentInfo[]>([]);
  const agentHierarchy = ref<HierarchyNode | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastLoadedOrganization = ref<string | null>(null);

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  const hasAgents = computed(() => availableAgents.value.length > 0);

  // ============================================================================
  // MUTATIONS (Synchronous Only)
  // ============================================================================

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage;
  }

  function setAvailableAgents(agents: AgentInfo[]) {
    availableAgents.value = agents;
  }

  function setAgentHierarchy(hierarchy: HierarchyNode | null) {
    agentHierarchy.value = hierarchy;
  }

  function setLastLoadedOrganization(organization: string | null) {
    lastLoadedOrganization.value = organization;
  }

  // @deprecated Use setLastLoadedOrganization instead
  function setLastLoadedNamespace(organizationSlug: string | null) {
    lastLoadedOrganization.value = organizationSlug;
  }

  function resetAgents() {
    availableAgents.value = [];
    agentHierarchy.value = null;
  }

  function clearError() {
    error.value = null;
  }

  // ============================================================================
  // RETURN (Public API)
  // ============================================================================

  return {
    // State (computed)
    availableAgents,
    agentHierarchy,
    isLoading,
    error,
    hasAgents,
    lastLoadedOrganization,
    lastLoadedNamespace: lastLoadedOrganization, // Alias for backward compatibility

    // Mutations
    setLoading,
    setError,
    clearError,
    setAvailableAgents,
    setAgentHierarchy,
    setLastLoadedOrganization,
    setLastLoadedNamespace, // Alias for backward compatibility
    resetAgents,
  };
});
