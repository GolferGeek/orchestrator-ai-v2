/**
 * Marketing Swarm Service
 *
 * Handles all async operations for the Marketing Swarm feature:
 * - Fetching configuration data (content types, agents, LLM configs)
 * - Starting swarm executions through the A2A framework
 * - Polling for status updates
 * - Fetching results
 *
 * IMPORTANT: All executions go through the A2A tasks endpoint to ensure
 * proper conversation/task creation and LLM usage tracking.
 */

import { apiService } from './apiService';
import { useMarketingSwarmStore } from '@/stores/marketingSwarmStore';
import { a2aOrchestrator } from './agent2agent/orchestrator/a2a-orchestrator';
import agent2AgentConversationsService from './agent2AgentConversationsService';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import type {
  MarketingContentType,
  MarketingAgent,
  AgentLLMConfig,
  MarketingAgentWithConfigs,
  SwarmConfigurationResponse,
  SwarmTaskResponse,
  SwarmStatusResponse,
  SwarmStateResponse,
  PromptData,
  SwarmConfig,
} from '@/types/marketing-swarm';

// API Base URL for LangGraph status/state endpoints (different port from main API)
const LANGGRAPH_BASE_URL = import.meta.env.VITE_LANGGRAPH_BASE_URL || 'http://localhost:6200';

class MarketingSwarmService {
  /**
   * Fetch all configuration data in a single request
   * Uses the /api/marketing/config endpoint which returns all data efficiently
   */
  async fetchAllConfiguration(_orgSlug: string): Promise<void> {
    const store = useMarketingSwarmStore();
    store.setLoading(true);
    store.clearError();

    try {
      // Single API call that returns all configuration
      const response = await apiService.get<SwarmConfigurationResponse>(
        '/marketing/config'
      );

      // Set content types
      store.setContentTypes(response.contentTypes);

      // Flatten agents from the grouped response
      const allAgents: MarketingAgent[] = [
        ...response.writers,
        ...response.editors,
        ...response.evaluators,
      ];
      store.setAgents(allAgents);

      // Flatten LLM configs from all agents
      const allConfigs: AgentLLMConfig[] = [
        ...response.writers.flatMap((a: MarketingAgentWithConfigs) => a.llmConfigs),
        ...response.editors.flatMap((a: MarketingAgentWithConfigs) => a.llmConfigs),
        ...response.evaluators.flatMap((a: MarketingAgentWithConfigs) => a.llmConfigs),
      ];
      store.setAgentLLMConfigs(allConfigs);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch configuration';
      store.setError(message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  }

  /**
   * Fetch all content types
   */
  async fetchContentTypes(): Promise<MarketingContentType[]> {
    const store = useMarketingSwarmStore();

    try {
      const response = await apiService.get<MarketingContentType[]>(
        '/marketing/content-types'
      );
      store.setContentTypes(response);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch content types';
      store.setError(message);
      throw error;
    }
  }

  /**
   * Fetch all marketing agents
   */
  async fetchAgents(): Promise<MarketingAgent[]> {
    const store = useMarketingSwarmStore();

    try {
      const response = await apiService.get<MarketingAgent[]>(
        '/marketing/agents'
      );
      store.setAgents(response);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch agents';
      store.setError(message);
      throw error;
    }
  }

  /**
   * Fetch all LLM configs
   */
  async fetchAgentLLMConfigs(): Promise<AgentLLMConfig[]> {
    const store = useMarketingSwarmStore();

    try {
      const response = await apiService.get<AgentLLMConfig[]>(
        '/marketing/llm-configs'
      );
      store.setAgentLLMConfigs(response);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch LLM configs';
      store.setError(message);
      throw error;
    }
  }

  /**
   * Create a new conversation for the Marketing Swarm
   *
   * This follows the same pattern as normal conversations:
   * 1. Creates conversation in database via agent2AgentConversationsService
   * 2. Initializes executionContextStore with the context
   *
   * @returns The conversation ID
   */
  async createSwarmConversation(
    orgSlug: string,
    userId: string,
    config: SwarmConfig
  ): Promise<string> {
    // Generate conversation ID upfront
    const conversationId = crypto.randomUUID();

    // Create conversation in database (same as normal conversations)
    await agent2AgentConversationsService.createConversation({
      agentName: 'marketing-swarm',
      agentType: 'api',
      organizationSlug: orgSlug,
      conversationId,
      metadata: {
        source: 'marketing-swarm-ui',
        contentType: 'marketing-content',
      },
    });

    // Initialize ExecutionContext (same as normal conversations)
    const executionContextStore = useExecutionContextStore();
    executionContextStore.initialize({
      orgSlug,
      userId,
      conversationId,
      agentSlug: 'marketing-swarm',
      agentType: 'api',
      provider: config.writers[0]?.llmProvider || 'anthropic',
      model: config.writers[0]?.llmModel || 'claude-sonnet-4-20250514',
    });

    return conversationId;
  }

  /**
   * Initialize ExecutionContext with an existing conversation
   *
   * Used when the conversation was already created by AgentsPage (via conversationHelpers)
   * and passed to the Marketing Swarm page via route query.
   */
  initializeWithExistingConversation(
    conversationId: string,
    orgSlug: string,
    userId: string,
    config: SwarmConfig
  ): void {
    const executionContextStore = useExecutionContextStore();
    executionContextStore.initialize({
      orgSlug,
      userId,
      conversationId,
      agentSlug: 'marketing-swarm',
      agentType: 'api',
      provider: config.writers[0]?.llmProvider || 'anthropic',
      model: config.writers[0]?.llmModel || 'claude-sonnet-4-20250514',
    });
  }

  /**
   * Start a new swarm execution through the A2A framework
   *
   * This uses the same flow as normal conversations:
   * 1. ExecutionContext must be initialized (via createSwarmConversation or initializeWithExistingConversation)
   * 2. Uses a2aOrchestrator.execute() which POSTs to /agent-to-agent/:org/:agent/tasks
   * 3. Backend creates task record, then hands to API runner which calls LangGraph
   *
   * This ensures proper conversation/task creation and LLM usage tracking.
   */
  async startSwarmExecution(
    contentTypeSlug: string,
    contentTypeContext: string,
    promptData: PromptData,
    config: SwarmConfig
  ): Promise<SwarmTaskResponse> {
    const store = useMarketingSwarmStore();
    store.setExecuting(true);
    store.clearError();
    store.setUIView('progress');

    try {
      // Verify ExecutionContext is initialized
      const executionContextStore = useExecutionContextStore();
      if (!executionContextStore.isInitialized) {
        throw new Error('ExecutionContext not initialized. Call createSwarmConversation first.');
      }

      // Generate a new taskId for this execution
      const taskId = executionContextStore.newTaskId();
      const ctx = executionContextStore.current;

      console.log('[MarketingSwarm] Starting execution via A2A framework', {
        conversationId: ctx.conversationId,
        taskId,
        agentSlug: ctx.agentSlug,
      });

      // Execute through A2A orchestrator (same as normal conversations)
      // The A2A orchestrator will:
      // 1. POST to /agent-to-agent/:org/marketing-swarm/tasks
      // 2. Backend creates task record with conversationId/taskId
      // 3. Backend routes to API runner which calls LangGraph
      // 4. LLM usage is properly tracked with valid conversationId
      const result = await a2aOrchestrator.execute('converse.send', {
        userMessage: JSON.stringify({
          type: 'marketing-swarm-request',
          contentTypeSlug,
          contentTypeContext,
          promptData,
          config,
        }),
      });

      console.log('[MarketingSwarm] A2A execution result:', result);

      // Handle A2A result
      if (result.type === 'error') {
        throw new Error(result.error || 'Swarm execution failed');
      }

      // Extract swarm response from A2A result
      // The response payload contains the Marketing Swarm results
      const taskResponse: SwarmTaskResponse = {
        taskId,
        status: result.type === 'message' ? 'completed' : 'running',
        outputs: [],
        evaluations: [],
        rankedResults: [],
      };

      // Parse the response message if it's JSON
      if (result.type === 'message' && result.message) {
        try {
          const parsed = typeof result.message === 'string'
            ? JSON.parse(result.message)
            : result.message;

          if (parsed.outputs) taskResponse.outputs = parsed.outputs;
          if (parsed.evaluations) taskResponse.evaluations = parsed.evaluations;
          if (parsed.rankedResults) taskResponse.rankedResults = parsed.rankedResults;
        } catch {
          // Message is not JSON, use as-is
          console.log('[MarketingSwarm] Response message is not JSON:', result.message);
        }
      }

      // Update store with results
      if (taskResponse.outputs) {
        store.setOutputs(taskResponse.outputs);
      }
      if (taskResponse.evaluations) {
        store.setEvaluations(taskResponse.evaluations);
      }
      if (taskResponse.rankedResults) {
        store.setRankedResults(taskResponse.rankedResults);
      }

      // Switch to results view if completed
      if (taskResponse.status === 'completed') {
        store.setUIView('results');
      }

      return taskResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Swarm execution failed';
      store.setError(message);
      throw error;
    } finally {
      store.setExecuting(false);
    }
  }

  /**
   * Get status of a running swarm execution
   */
  async getSwarmStatus(taskId: string): Promise<SwarmStatusResponse> {
    try {
      const response = await fetch(`${LANGGRAPH_BASE_URL}/marketing-swarm/status/${taskId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get swarm status');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to get swarm status:', error);
      throw error;
    }
  }

  /**
   * Get full state of a swarm execution (for reconnection)
   */
  async getSwarmState(taskId: string): Promise<SwarmStateResponse> {
    const store = useMarketingSwarmStore();

    try {
      const response = await fetch(`${LANGGRAPH_BASE_URL}/marketing-swarm/state/${taskId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get swarm state');
      }

      const result = await response.json();
      const state: SwarmStateResponse = result.data;

      // Populate store with state
      store.setExecutionQueue(state.executionQueue);
      store.setOutputs(state.outputs);
      store.setEvaluations(state.evaluations);

      // Determine current view based on phase
      if (state.phase === 'completed') {
        store.setUIView('results');
      } else if (state.phase !== 'initializing') {
        store.setUIView('progress');
      }

      return state;
    } catch (error) {
      console.error('Failed to get swarm state:', error);
      throw error;
    }
  }

  /**
   * Poll for status updates while execution is running
   */
  async pollStatus(
    taskId: string,
    onUpdate: (status: SwarmStatusResponse) => void,
    intervalMs: number = 2000
  ): Promise<void> {
    const store = useMarketingSwarmStore();

    const poll = async () => {
      try {
        const status = await this.getSwarmStatus(taskId);
        onUpdate(status);

        // Continue polling if not completed or failed
        if (status.phase !== 'completed' && status.phase !== 'failed') {
          setTimeout(poll, intervalMs);
        } else {
          store.setExecuting(false);
          if (status.phase === 'completed') {
            // Fetch full state to get outputs and evaluations
            await this.getSwarmState(taskId);
            store.setUIView('results');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        store.setExecuting(false);
      }
    };

    poll();
  }

  /**
   * Get past swarm tasks for a user
   */
  async getUserSwarmTasks(
    orgSlug: string,
    userId: string,
    limit: number = 20
  ): Promise<{ taskId: string; status: string; contentTypeSlug: string; createdAt: string }[]> {
    try {
      const response = await apiService.get<
        { taskId: string; status: string; contentTypeSlug: string; createdAt: string }[]
      >(`/marketing/swarm-tasks?organizationSlug=${orgSlug}&userId=${userId}&limit=${limit}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch user swarm tasks:', error);
      return [];
    }
  }
}

// Export singleton instance
export const marketingSwarmService = new MarketingSwarmService();
