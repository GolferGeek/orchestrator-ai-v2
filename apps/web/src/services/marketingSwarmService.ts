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
import { useConversationsStore } from '@/stores/conversationsStore';
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
  ObservabilityEvent,
  PhaseChangedMetadata,
  QueueBuiltMetadata,
  OutputUpdatedMetadata,
  EvaluationUpdatedMetadata,
  FinalistsSelectedMetadata,
  RankingUpdatedMetadata,
  SSEMetadataPhase2,
  OutputVersionsResponse,
} from '@/types/marketing-swarm';
import { SSEClient } from './agent2agent/sse/sseClient';

// API Base URL for LangGraph status/state endpoints (different port from main API)
const LANGGRAPH_BASE_URL = import.meta.env.VITE_LANGGRAPH_BASE_URL || 'http://localhost:6200';

// API Base URL for main API (observability stream)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:6100';

class MarketingSwarmService {
  private sseClient: SSEClient | null = null;
  private sseCleanup: (() => void)[] = [];
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
      // Note: Marketing Swarm agent supports 'build' mode, not 'converse' mode
      // (see seed file: execution_capabilities.can_build=true, can_converse=false)
      
      // Ensure execution config is present (required by backend)
      const configWithExecution = {
        ...config,
        execution: config.execution || {
          maxLocalConcurrent: 1,
          maxCloudConcurrent: 5,
          maxEditCycles: config.maxEditCycles || 2,
          topNForFinalRanking: 1,
        },
      };
      
      const result = await a2aOrchestrator.execute('build.create', {
        userMessage: JSON.stringify({
          type: 'marketing-swarm-request',
          contentTypeSlug,
          contentTypeContext,
          promptData,
          config: configWithExecution,
        }),
      });

      console.log('[MarketingSwarm] A2A execution result:', result);

      // Handle A2A result
      if (result.type === 'error') {
        throw new Error(result.error || 'Swarm execution failed');
      }

      // Extract swarm response from A2A result
      // For BUILD mode, the response is a deliverable with content as JSON string
      const taskResponse: SwarmTaskResponse = {
        taskId,
        status: 'running',
        outputs: [],
        evaluations: [],
        rankedResults: [],
      };

      // Handle deliverable response (BUILD mode returns deliverable)
      if (result.type === 'deliverable' && result.version?.content) {
        try {
          // The content is a JSON string containing the LangGraph response
          const contentStr = typeof result.version.content === 'string'
            ? result.version.content
            : JSON.stringify(result.version.content);
          
          const parsed = JSON.parse(contentStr);
          
          // The LangGraph response structure: { statusCode: 200, data: { success: true/false, data: {...} } }
          const langGraphData = parsed.data?.data || parsed.data || parsed;
          
          // Check for errors
          if (langGraphData.success === false) {
            const errorMsg = langGraphData.error || langGraphData.message || 'Marketing Swarm execution failed';
            throw new Error(errorMsg);
          }
          
          // Extract Marketing Swarm results
          if (langGraphData.outputs) taskResponse.outputs = langGraphData.outputs;
          if (langGraphData.evaluations) taskResponse.evaluations = langGraphData.evaluations;
          if (langGraphData.rankedResults) taskResponse.rankedResults = langGraphData.rankedResults;
          
          // Update status based on LangGraph response
          if (langGraphData.status === 'completed') {
            taskResponse.status = 'completed';
          } else if (langGraphData.status === 'failed') {
            throw new Error(langGraphData.error || 'Marketing Swarm execution failed');
          }
        } catch (parseError) {
          console.error('[MarketingSwarm] Failed to parse deliverable content:', parseError);
          // If it's already an Error, re-throw it
          if (parseError instanceof Error) {
            throw parseError;
          }
          // Otherwise, try to extract error from content
          throw new Error('Failed to parse Marketing Swarm response');
        }
      }

      // Handle message response (fallback for other response types)
      if (result.type === 'message' && result.message) {
        try {
          const parsed = typeof result.message === 'string'
            ? JSON.parse(result.message)
            : result.message;

          if (parsed.outputs) taskResponse.outputs = parsed.outputs;
          if (parsed.evaluations) taskResponse.evaluations = parsed.evaluations;
          if (parsed.rankedResults) taskResponse.rankedResults = parsed.rankedResults;
          if (parsed.status === 'completed') taskResponse.status = 'completed';
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

      // Switch to results view if completed (only if already completed synchronously)
      // Otherwise, SSE events will handle status updates
      if (taskResponse.status === 'completed') {
        store.setUIView('results');
        store.setExecuting(false);
        
        // Add completion message to conversation so it shows up when user clicks on conversation later
        if (result.type === 'deliverable' && result.deliverable?.id) {
          const conversationsStore = useConversationsStore();
          const deliverableId = result.deliverable.id;
          const outputCount = taskResponse.outputs?.length || 0;
          const evalCount = taskResponse.evaluations?.length || 0;
          
          conversationsStore.addMessage(ctx.conversationId, {
            conversationId: ctx.conversationId,
            role: 'assistant',
            content: `Marketing Swarm execution completed! Generated ${outputCount} output${outputCount !== 1 ? 's' : ''} with ${evalCount} evaluation${evalCount !== 1 ? 's' : ''}.`,
            timestamp: new Date().toISOString(),
            metadata: {
              marketingSwarmCompleted: true,
              deliverableId,
              taskId,
              outputCount,
              evaluationCount: evalCount,
            },
          });
          
          console.log('[MarketingSwarm] Added completion message to conversation:', ctx.conversationId);
        }
      } else {
        // Execution is running asynchronously - keep executing state true
        // SSE events will update status and set executing to false when done
        console.log('[MarketingSwarm] Execution started, waiting for SSE updates...');
      }

      return taskResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Swarm execution failed';
      store.setError(message);
      store.setExecuting(false);
      throw error;
    }
    // Note: Don't set executing(false) in finally block - let SSE events control execution state
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

  // ============================================================================
  // Phase 2: SSE Streaming for Real-Time Updates
  // ============================================================================

  /**
   * Connect to the observability SSE stream and filter for marketing swarm events.
   * Uses conversationId to filter events for the current task.
   */
  connectToSSEStream(conversationId: string): void {
    const store = useMarketingSwarmStore();

    // Disconnect existing connection if any
    this.disconnectSSEStream();

    // Get auth token for SSE connection
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('[MarketingSwarm] No auth token available for SSE connection');
      store.setError('Authentication required for real-time updates');
      return;
    }

    // Create new SSE client
    this.sseClient = new SSEClient({
      maxReconnectAttempts: 10,
      reconnectDelay: 2000,
      debug: true,
    });

    // Build SSE URL with conversationId filter and token
    // EventSource doesn't support custom headers, so auth must be via query param
    const sseUrl = `${API_BASE_URL}/observability/stream?conversationId=${conversationId}&token=${encodeURIComponent(token)}`;

    // Use console.log for connection status so it's always visible (not filtered)
    console.log('[MarketingSwarm] 🔌 Connecting to SSE stream:', sseUrl.replace(token, '***'));
    console.log('[MarketingSwarm] 🔌 Filtering by conversationId:', conversationId);

    // Listen for state changes
    const stateCleanup = this.sseClient.onStateChange((sseState) => {
      console.log('[MarketingSwarm] 🔌 SSE state changed:', sseState);
      store.setSSEConnected(sseState === 'connected');

      // Log errors prominently
      if (sseState === 'error') {
        console.error('[MarketingSwarm] ❌ SSE connection error - check authentication and network');
      }
    });
    this.sseCleanup.push(stateCleanup);

    // Listen for errors
    const errorCleanup = this.sseClient.onError((error) => {
      console.error('[MarketingSwarm] SSE error:', error);
      store.setError('Failed to connect to real-time updates stream');
    });
    this.sseCleanup.push(errorCleanup);

    // Listen for data events (observability events come as 'message' events)
    const messageCleanup = this.sseClient.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data) as ObservabilityEvent;

        // Skip connection confirmation events
        if (data.event_type === 'connected') {
          console.log('[MarketingSwarm] ✅ SSE connection confirmed by server');
          return;
        }

        // Log all received events with full payload structure
        console.log('[MarketingSwarm] 📨 SSE event received:', {
          hook_event_type: data.hook_event_type,
          event_type: data.event_type,
          context: data.context,
          payloadKeys: Object.keys((data as unknown as { payload?: Record<string, unknown> }).payload || {}),
          payloadDataKeys: Object.keys(((data as unknown as { payload?: Record<string, unknown> }).payload?.data as Record<string, unknown>) || {}),
          fullPayload: (data as unknown as { payload?: Record<string, unknown> }).payload,
        });

        this.handleObservabilityEvent(data);
      } catch (err) {
        console.error('[MarketingSwarm] Failed to parse SSE event:', err, event.data);
      }
    });
    this.sseCleanup.push(messageCleanup);

    // Connect to SSE stream
    this.sseClient.connect(sseUrl);
    // Don't set connected immediately - wait for onopen event
  }

  /**
   * Disconnect from the SSE stream
   */
  disconnectSSEStream(): void {
    const store = useMarketingSwarmStore();

    // Clean up event listeners
    this.sseCleanup.forEach((cleanup) => cleanup());
    this.sseCleanup = [];

    // Disconnect SSE client
    if (this.sseClient) {
      this.sseClient.disconnect();
      this.sseClient = null;
    }

    store.setSSEConnected(false);
    console.debug('[MarketingSwarm] 🔌 Disconnected from SSE stream');
  }

  /**
   * Handle incoming observability events and update store
   */
  private handleObservabilityEvent(event: ObservabilityEvent): void {
    // Marketing Swarm metadata structure follows transport-types pattern:
    // ObservabilityEventRecord has payload.data where LangGraph puts metadata directly
    // LangGraph emits: observability.emitProgress(ctx, taskId, msg, { metadata: { type, ... } })
    // ObservabilityService spreads metadata into payload.data: { type, phase, ... }
    // So we look for type directly in payload.data (not payload.data.metadata)
    const payload = (event as unknown as { payload?: Record<string, unknown> })?.payload;
    const data = payload?.data as Record<string, unknown> | undefined;

    // Marketing swarm metadata is directly in data (not nested in data.metadata)
    // Fallback to payload.metadata for backward compatibility
    const metadata = (data && 'type' in data ? data : payload?.metadata) as SSEMetadataPhase2 | undefined;

    if (!metadata || !metadata.type) {
      // Not a marketing swarm event or missing type
      // Debug for troubleshooting
      console.debug('[MarketingSwarm] ⏭️ Event skipped - no metadata.type:', {
        hook_event_type: event.hook_event_type,
        hasPayload: !!payload,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        payloadKeys: payload ? Object.keys(payload) : [],
      });
      return;
    }

    console.debug('[MarketingSwarm] ✅ Processing SSE event:', metadata.type, metadata);

    switch (metadata.type) {
      case 'phase_changed':
        this.handlePhaseChanged(metadata as PhaseChangedMetadata);
        break;

      case 'queue_built':
        this.handleQueueBuilt(metadata as QueueBuiltMetadata);
        break;

      case 'output_updated':
        this.handleOutputUpdated(metadata as OutputUpdatedMetadata);
        break;

      case 'evaluation_updated':
        this.handleEvaluationUpdated(metadata as EvaluationUpdatedMetadata);
        break;

      case 'finalists_selected':
        this.handleFinalistsSelected(metadata as FinalistsSelectedMetadata);
        break;

      case 'ranking_updated':
        this.handleRankingUpdated(metadata as RankingUpdatedMetadata);
        break;

      default:
        console.log('[MarketingSwarm] Unknown event type:', (metadata as Record<string, unknown>).type);
    }
  }

  private handlePhaseChanged(metadata: PhaseChangedMetadata): void {
    const store = useMarketingSwarmStore();
    console.log('[MarketingSwarm] Phase changed to:', metadata.phase);
    store.setPhase(metadata.phase);

    // Auto-switch to results view when completed
    if (metadata.phase === 'completed') {
      store.setExecuting(false);
      store.setUIView('results');
      
      // Add completion message to conversation so it shows up when user clicks on conversation later
      const executionContextStore = useExecutionContextStore();
      if (executionContextStore.isInitialized) {
        const ctx = executionContextStore.current;
        const conversationsStore = useConversationsStore();
        const outputCount = store.outputsPhase2?.length || store.outputs?.length || 0;
        const evalCount = store.evaluationsPhase2?.length || store.evaluations?.length || 0;
        
        conversationsStore.addMessage(ctx.conversationId, {
          conversationId: ctx.conversationId,
          role: 'assistant',
          content: `Marketing Swarm execution completed! Generated ${outputCount} output${outputCount !== 1 ? 's' : ''} with ${evalCount} evaluation${evalCount !== 1 ? 's' : ''}.`,
          timestamp: new Date().toISOString(),
          metadata: {
            marketingSwarmCompleted: true,
            taskId: ctx.taskId,
            outputCount,
            evaluationCount: evalCount,
          },
        });
        
        console.log('[MarketingSwarm] Added completion message to conversation via SSE:', ctx.conversationId);
      }
    } else if (metadata.phase === 'failed') {
      store.setExecuting(false);
    }
  }

  private handleQueueBuilt(metadata: QueueBuiltMetadata): void {
    const store = useMarketingSwarmStore();
    console.log('[MarketingSwarm] Queue built:', metadata.totalOutputs, 'outputs');
    store.setTotalOutputsCount(metadata.totalOutputs);

    // Initialize phase 2 outputs from queue
    metadata.outputs.forEach((output) => {
      store.upsertPhase2Output({
        id: output.id,
        status: output.status as 'pending_write',
        writerAgent: { slug: output.writerAgentSlug },
        editorAgent: output.editorAgentSlug ? { slug: output.editorAgentSlug } : null,
        editCycle: 0,
      });
    });
  }

  private handleOutputUpdated(metadata: OutputUpdatedMetadata): void {
    const store = useMarketingSwarmStore();
    console.log('[MarketingSwarm] Output updated:', metadata.output.id, metadata.output.status);
    store.upsertPhase2Output(metadata.output);
  }

  private handleEvaluationUpdated(metadata: EvaluationUpdatedMetadata): void {
    const store = useMarketingSwarmStore();
    console.log('[MarketingSwarm] Evaluation updated:', metadata.evaluation.id, metadata.evaluation.status);
    store.upsertPhase2Evaluation(metadata.evaluation);
  }

  private handleFinalistsSelected(metadata: FinalistsSelectedMetadata): void {
    const store = useMarketingSwarmStore();
    console.log('[MarketingSwarm] Finalists selected:', metadata.count);
    store.setFinalists(metadata.finalists);
  }

  private handleRankingUpdated(metadata: RankingUpdatedMetadata): void {
    const store = useMarketingSwarmStore();
    console.log('[MarketingSwarm] Rankings updated:', metadata.stage);

    if (metadata.stage === 'initial') {
      store.setInitialRankings(metadata.rankings);
    } else {
      store.setFinalRankings(metadata.rankings);
    }
  }

  // ============================================================================
  // Output Version History
  // ============================================================================

  /**
   * Get version history for a specific output
   *
   * Returns all versions of an output including:
   * - Initial write content
   * - Any rewrites after editor feedback
   * - Editor feedback that triggered each rewrite
   *
   * Used by modal to show write/edit history.
   */
  async getOutputVersions(outputId: string): Promise<OutputVersionsResponse> {
    try {
      const response = await fetch(`${LANGGRAPH_BASE_URL}/marketing-swarm/output/${outputId}/versions`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get output versions');
      }

      const result = await response.json();
      return result.data as OutputVersionsResponse;
    } catch (error) {
      console.error('Failed to get output versions:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const marketingSwarmService = new MarketingSwarmService();
