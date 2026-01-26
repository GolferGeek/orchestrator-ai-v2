/**
 * Agent Ideas Store
 *
 * State management for the Agent Ideas modal feature:
 * - Multi-step wizard flow (industry input -> recommendations -> contact form -> success)
 * - Selected agents tracking
 * - Loading and error states
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AgentRecommendation, RecommendationsResponse } from '@/services/agentIdeasService';
import { agentIdeasService } from '@/services/agentIdeasService';

export type AgentIdeasStep = 'industry' | 'recommendations' | 'contact' | 'success';

export const useAgentIdeasStore = defineStore('agentIdeas', () => {
  // State
  const isOpen = ref(false);
  const currentStep = ref<AgentIdeasStep>('industry');
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Industry data
  const industryInput = ref('');
  const normalizedIndustry = ref('');
  const industryDescription = ref('');
  const isFallback = ref(false);
  const processingTimeMs = ref<number | null>(null);

  // Recommendations
  const recommendations = ref<AgentRecommendation[]>([]);
  const selectedAgentNames = ref<Set<string>>(new Set());

  // Submission
  const submissionId = ref<string | null>(null);

  // Computed
  const selectedAgents = computed(() =>
    recommendations.value.filter((r) => selectedAgentNames.value.has(r.name))
  );

  const selectedCount = computed(() => selectedAgentNames.value.size);

  const hasSelections = computed(() => selectedAgentNames.value.size > 0);

  // Actions
  function openModal() {
    isOpen.value = true;
    // Reset to initial state when opening
    currentStep.value = 'industry';
    error.value = null;
  }

  function closeModal() {
    isOpen.value = false;
    // Don't reset state immediately - allow animation to complete
    setTimeout(() => {
      if (!isOpen.value) {
        resetState();
      }
    }, 300);
  }

  function resetState() {
    currentStep.value = 'industry';
    industryInput.value = '';
    normalizedIndustry.value = '';
    industryDescription.value = '';
    isFallback.value = false;
    processingTimeMs.value = null;
    recommendations.value = [];
    selectedAgentNames.value = new Set();
    error.value = null;
    submissionId.value = null;
  }

  function goToStep(step: AgentIdeasStep) {
    currentStep.value = step;
    error.value = null;
  }

  function toggleAgentSelection(agentName: string) {
    const newSet = new Set(selectedAgentNames.value);
    if (newSet.has(agentName)) {
      newSet.delete(agentName);
    } else {
      newSet.add(agentName);
    }
    selectedAgentNames.value = newSet;
  }

  function selectAllAgents() {
    selectedAgentNames.value = new Set(recommendations.value.map((r) => r.name));
  }

  function deselectAllAgents() {
    selectedAgentNames.value = new Set();
  }

  async function fetchRecommendations(industry: string) {
    isLoading.value = true;
    error.value = null;
    industryInput.value = industry;

    try {
      const response: RecommendationsResponse =
        await agentIdeasService.getRecommendations(industry);

      if (response.status === 'error') {
        throw new Error(response.error || 'Failed to get recommendations');
      }

      if (response.data) {
        normalizedIndustry.value = response.data.industry;
        industryDescription.value = response.data.industryDescription;
        isFallback.value = response.data.isFallback;
        processingTimeMs.value = response.data.processingTimeMs;
        recommendations.value = response.data.recommendations;
      }

      // Move to recommendations step
      currentStep.value = 'recommendations';
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get recommendations';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function submitInterest(contactInfo: {
    email: string;
    name?: string;
    company?: string;
    phone?: string;
  }) {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await agentIdeasService.submitInterest({
        email: contactInfo.email,
        name: contactInfo.name,
        company: contactInfo.company,
        phone: contactInfo.phone,
        industryInput: industryInput.value,
        normalizedIndustry: normalizedIndustry.value,
        industryDescription: industryDescription.value,
        selectedAgents: selectedAgents.value,
        allRecommendations: recommendations.value,
        isFallback: isFallback.value,
        processingTimeMs: processingTimeMs.value || undefined,
      });

      if (!response.success) {
        throw new Error(response.message || 'Submission failed');
      }

      submissionId.value = response.submissionId;

      // Move to success step
      currentStep.value = 'success';
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to submit';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    // State
    isOpen,
    currentStep,
    isLoading,
    error,
    industryInput,
    normalizedIndustry,
    industryDescription,
    isFallback,
    processingTimeMs,
    recommendations,
    selectedAgentNames,
    submissionId,

    // Computed
    selectedAgents,
    selectedCount,
    hasSelections,

    // Actions
    openModal,
    closeModal,
    resetState,
    goToStep,
    toggleAgentSelection,
    selectAllAgents,
    deselectAllAgents,
    fetchRecommendations,
    submitInterest,
  };
});
