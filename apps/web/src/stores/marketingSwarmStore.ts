/**
 * Marketing Swarm Store - State + Synchronous Mutations Only
 *
 * Architecture: Stores contain ONLY state and synchronous mutations
 * For async operations, use marketingSwarmService
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  MarketingContentType,
  MarketingAgent,
  AgentLLMConfig,
  SwarmTask,
  SwarmOutput,
  SwarmEvaluation,
  QueueItem,
  RankedResult,
  SwarmPhase,
  MarketingSwarmUIState,
  AgentCardState,
} from '@/types/marketing-swarm';

interface MarketingSwarmState {
  // Configuration data (from database)
  contentTypes: MarketingContentType[];
  agents: MarketingAgent[];
  agentLLMConfigs: AgentLLMConfig[];

  // Current task state
  currentTaskId: string | null;
  currentTask: SwarmTask | null;
  executionQueue: QueueItem[];
  outputs: SwarmOutput[];
  evaluations: SwarmEvaluation[];
  rankedResults: RankedResult[];

  // UI state
  uiState: MarketingSwarmUIState;
  agentCardStates: Map<string, AgentCardState>;

  // Loading/error state
  isLoading: boolean;
  isExecuting: boolean;
  error: string | null;
}

export const useMarketingSwarmStore = defineStore('marketingSwarm', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  const state = ref<MarketingSwarmState>({
    contentTypes: [],
    agents: [],
    agentLLMConfigs: [],
    currentTaskId: null,
    currentTask: null,
    executionQueue: [],
    outputs: [],
    evaluations: [],
    rankedResults: [],
    uiState: {
      currentView: 'config',
      showDetailedEvaluations: false,
    },
    agentCardStates: new Map(),
    isLoading: false,
    isExecuting: false,
    error: null,
  });

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  const contentTypes = computed(() => state.value.contentTypes);
  const agents = computed(() => state.value.agents);
  const agentLLMConfigs = computed(() => state.value.agentLLMConfigs);
  const currentTaskId = computed(() => state.value.currentTaskId);
  const currentTask = computed(() => state.value.currentTask);
  const executionQueue = computed(() => state.value.executionQueue);
  const outputs = computed(() => state.value.outputs);
  const evaluations = computed(() => state.value.evaluations);
  const rankedResults = computed(() => state.value.rankedResults);
  const uiState = computed(() => state.value.uiState);
  const isLoading = computed(() => state.value.isLoading);
  const isExecuting = computed(() => state.value.isExecuting);
  const error = computed(() => state.value.error);

  // Filtered agents by role
  const writerAgents = computed(() =>
    state.value.agents.filter((a) => a.role === 'writer' && a.isActive)
  );

  const editorAgents = computed(() =>
    state.value.agents.filter((a) => a.role === 'editor' && a.isActive)
  );

  const evaluatorAgents = computed(() =>
    state.value.agents.filter((a) => a.role === 'evaluator' && a.isActive)
  );

  // LLM configs grouped by agent ID
  const llmConfigsByAgentId = computed(() => {
    const grouped: Record<string, AgentLLMConfig[]> = {};
    for (const config of state.value.agentLLMConfigs) {
      if (!grouped[config.agentId]) {
        grouped[config.agentId] = [];
      }
      grouped[config.agentId].push(config);
    }
    return grouped;
  });

  // LLM configs grouped by agent slug (for backward compatibility)
  const llmConfigsByAgent = computed(() => {
    const grouped: Record<string, AgentLLMConfig[]> = {};
    for (const agent of state.value.agents) {
      grouped[agent.slug] = state.value.agentLLMConfigs.filter(
        (c) => c.agentId === agent.id
      );
    }
    return grouped;
  });

  // Progress calculation
  const progress = computed(() => {
    const total = state.value.executionQueue.length;
    const completed = state.value.executionQueue.filter(
      (q) => q.status === 'completed' || q.status === 'skipped'
    ).length;
    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  // Current phase based on queue state
  const currentPhase = computed<SwarmPhase>(() => {
    if (!state.value.currentTask) return 'initializing';
    if (state.value.currentTask.status === 'failed') return 'failed';
    if (state.value.currentTask.status === 'completed') return 'completed';

    const queue = state.value.executionQueue;
    const processingStep = queue.find((q) => q.status === 'processing');

    if (processingStep) {
      switch (processingStep.stepType) {
        case 'write':
          return 'writing';
        case 'edit':
          return 'editing';
        case 'evaluate':
          return 'evaluating';
      }
    }

    const allCompleted = queue.every(
      (q) => q.status === 'completed' || q.status === 'skipped' || q.status === 'failed'
    );
    if (allCompleted && state.value.rankedResults.length > 0) {
      return 'completed';
    }

    return 'initializing';
  });

  // Best output (highest ranked)
  const bestOutput = computed(() => {
    if (state.value.rankedResults.length === 0) return null;
    const bestResult = state.value.rankedResults[0];
    return state.value.outputs.find((o) => o.id === bestResult.outputId) || null;
  });

  // ============================================================================
  // GETTERS (Functions)
  // ============================================================================

  function getAgentBySlug(slug: string): MarketingAgent | undefined {
    return state.value.agents.find((a) => a.slug === slug);
  }

  function getLLMConfigsForAgent(agentSlug: string): AgentLLMConfig[] {
    // First find the agent by slug to get its ID
    const agent = state.value.agents.find((a) => a.slug === agentSlug);
    if (!agent) return [];
    return state.value.agentLLMConfigs.filter((c) => c.agentId === agent.id);
  }

  function getOutputById(id: string): SwarmOutput | undefined {
    return state.value.outputs.find((o) => o.id === id);
  }

  function getEvaluationsForOutput(outputId: string): SwarmEvaluation[] {
    return state.value.evaluations.filter((e) => e.outputId === outputId);
  }

  function getAverageScoreForOutput(outputId: string): number {
    const evals = getEvaluationsForOutput(outputId);
    if (evals.length === 0) return 0;
    return evals.reduce((sum, e) => sum + e.score, 0) / evals.length;
  }

  function getAgentCardState(agentSlug: string, llmConfigId: string): AgentCardState | undefined {
    return state.value.agentCardStates.get(`${agentSlug}:${llmConfigId}`);
  }

  // ============================================================================
  // MUTATIONS (Synchronous Only)
  // ============================================================================

  function setLoading(loading: boolean) {
    state.value.isLoading = loading;
  }

  function setExecuting(executing: boolean) {
    state.value.isExecuting = executing;
  }

  function setError(error: string | null) {
    state.value.error = error;
  }

  function clearError() {
    state.value.error = null;
  }

  // Configuration data setters
  function setContentTypes(types: MarketingContentType[]) {
    state.value.contentTypes = types;
  }

  function setAgents(agents: MarketingAgent[]) {
    state.value.agents = agents;
  }

  function setAgentLLMConfigs(configs: AgentLLMConfig[]) {
    state.value.agentLLMConfigs = configs;
  }

  // Task state setters
  function setCurrentTask(task: SwarmTask | null) {
    state.value.currentTask = task;
    state.value.currentTaskId = task?.taskId || null;
  }

  function setExecutionQueue(queue: QueueItem[]) {
    state.value.executionQueue = queue;
  }

  function updateQueueItem(itemId: string, updates: Partial<QueueItem>) {
    const index = state.value.executionQueue.findIndex((q) => q.id === itemId);
    if (index >= 0) {
      state.value.executionQueue[index] = {
        ...state.value.executionQueue[index],
        ...updates,
      };
    }
  }

  function setOutputs(outputs: SwarmOutput[]) {
    state.value.outputs = outputs;
  }

  function addOutput(output: SwarmOutput) {
    const existing = state.value.outputs.findIndex((o) => o.id === output.id);
    if (existing >= 0) {
      state.value.outputs[existing] = output;
    } else {
      state.value.outputs.push(output);
    }
  }

  function updateOutput(outputId: string, updates: Partial<SwarmOutput>) {
    const index = state.value.outputs.findIndex((o) => o.id === outputId);
    if (index >= 0) {
      state.value.outputs[index] = {
        ...state.value.outputs[index],
        ...updates,
      };
    }
  }

  function setEvaluations(evaluations: SwarmEvaluation[]) {
    state.value.evaluations = evaluations;
  }

  function addEvaluation(evaluation: SwarmEvaluation) {
    state.value.evaluations.push(evaluation);
  }

  function setRankedResults(results: RankedResult[]) {
    state.value.rankedResults = results;
  }

  // UI state setters
  function setUIView(view: 'config' | 'progress' | 'results') {
    state.value.uiState.currentView = view;
  }

  function setSelectedOutput(outputId: string | undefined) {
    state.value.uiState.selectedOutputId = outputId;
  }

  function setCompareOutputs(outputIds: string[]) {
    state.value.uiState.compareOutputIds = outputIds;
  }

  function setShowDetailedEvaluations(show: boolean) {
    state.value.uiState.showDetailedEvaluations = show;
  }

  function setAgentCardState(agentSlug: string, llmConfigId: string, cardState: AgentCardState) {
    state.value.agentCardStates.set(`${agentSlug}:${llmConfigId}`, cardState);
  }

  function updateAgentCardStatus(
    agentSlug: string,
    llmConfigId: string,
    status: AgentCardState['status']
  ) {
    const key = `${agentSlug}:${llmConfigId}`;
    const existing = state.value.agentCardStates.get(key);
    if (existing) {
      state.value.agentCardStates.set(key, { ...existing, status });
    }
  }

  // Reset state
  function resetTaskState() {
    state.value.currentTaskId = null;
    state.value.currentTask = null;
    state.value.executionQueue = [];
    state.value.outputs = [];
    state.value.evaluations = [];
    state.value.rankedResults = [];
    state.value.agentCardStates.clear();
    state.value.uiState = {
      currentView: 'config',
      showDetailedEvaluations: false,
    };
    state.value.error = null;
  }

  function clearAll() {
    state.value.contentTypes = [];
    state.value.agents = [];
    state.value.agentLLMConfigs = [];
    resetTaskState();
  }

  // ============================================================================
  // RETURN (Public API)
  // ============================================================================

  return {
    // State (computed)
    contentTypes,
    agents,
    agentLLMConfigs,
    currentTaskId,
    currentTask,
    executionQueue,
    outputs,
    evaluations,
    rankedResults,
    uiState,
    isLoading,
    isExecuting,
    error,

    // Derived state
    writerAgents,
    editorAgents,
    evaluatorAgents,
    llmConfigsByAgent,
    llmConfigsByAgentId,
    progress,
    currentPhase,
    bestOutput,

    // Getters (functions)
    getAgentBySlug,
    getLLMConfigsForAgent,
    getOutputById,
    getEvaluationsForOutput,
    getAverageScoreForOutput,
    getAgentCardState,

    // Mutations
    setLoading,
    setExecuting,
    setError,
    clearError,
    setContentTypes,
    setAgents,
    setAgentLLMConfigs,
    setCurrentTask,
    setExecutionQueue,
    updateQueueItem,
    setOutputs,
    addOutput,
    updateOutput,
    setEvaluations,
    addEvaluation,
    setRankedResults,
    setUIView,
    setSelectedOutput,
    setCompareOutputs,
    setShowDetailedEvaluations,
    setAgentCardState,
    updateAgentCardStatus,
    resetTaskState,
    clearAll,
  };
});
