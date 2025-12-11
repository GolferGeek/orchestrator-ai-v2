/**
 * Marketing Swarm Service
 *
 * Handles all async operations for the Marketing Swarm feature:
 * - Fetching configuration data (content types, agents, LLM configs)
 * - Starting swarm executions
 * - Polling for status updates
 * - Fetching results
 */

import { apiService } from './apiService';
import { useMarketingSwarmStore } from '@/stores/marketingSwarmStore';
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

// API Base URL for LangGraph (different port from main API)
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
   * Start a new swarm execution
   */
  async startSwarmExecution(
    orgSlug: string,
    userId: string,
    conversationId: string,
    taskId: string,
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
      // Call the LangGraph endpoint
      const response = await fetch(`${LANGGRAPH_BASE_URL}/marketing-swarm/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          context: {
            orgSlug,
            userId,
            conversationId,
            taskId,
            agentSlug: 'marketing-swarm',
            agentType: 'api',
            provider: config.writers[0]?.llmProvider || 'anthropic',
            model: config.writers[0]?.llmModel || 'claude-sonnet-4-20250514',
          },
          contentTypeSlug,
          contentTypeContext,
          promptData,
          config,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start swarm execution');
      }

      const result = await response.json();
      const taskResponse: SwarmTaskResponse = result.data;

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
