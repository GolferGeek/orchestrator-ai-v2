/**
 * Prediction Agent Service
 *
 * Handles API calls for the prediction agent dashboard.
 * Fetches current state, instruments, history, tools, config, and status.
 * Also handles lifecycle control operations.
 */

import { apiService } from './apiService';
import type {
  AgentStatus,
  Datapoint,
  Recommendation,
  PredictionRunnerConfig,
} from '@/types/prediction-agent';

// =============================================================================
// Response Types
// =============================================================================

export interface CurrentPredictionsResponse {
  agentId: string;
  agentSlug: string;
  timestamp: string;
  datapoint?: Datapoint;
  recommendations: Recommendation[];
}

export interface HistoryResponse {
  agentId: string;
  total: number;
  page: number;
  pageSize: number;
  recommendations: Recommendation[];
}

export interface InstrumentsResponse {
  agentId: string;
  instruments: string[];
}

export interface ToolStatusResponse {
  agentId: string;
  tools: Array<{
    name: string;
    lastRun?: string;
    status: 'success' | 'failed' | 'never_run';
    recentClaims: number;
    errorMessage?: string;
  }>;
  recentSources: Array<{
    tool: string;
    fetchedAt: string;
    claims: Array<{
      text: string;
      confidence: number;
    }>;
  }>;
}

export interface ConfigResponse {
  agentId: string;
  config: PredictionRunnerConfig;
}

export interface StatusResponse {
  status: AgentStatus;
  isRunning: boolean;
}

// =============================================================================
// Service
// =============================================================================

class PredictionAgentService {
  private baseUrl = '/predictions';

  /**
   * Get current predictions and state for an agent.
   */
  async getCurrentPredictions(agentId: string): Promise<CurrentPredictionsResponse> {
    const response = await apiService.get<CurrentPredictionsResponse>(
      `${this.baseUrl}/${agentId}/current`
    );
    return response;
  }

  /**
   * Get history of predictions with pagination.
   */
  async getHistory(
    agentId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<HistoryResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    const response = await apiService.get<HistoryResponse>(
      `${this.baseUrl}/${agentId}/history?${params}`
    );
    return response;
  }

  /**
   * Get tracked instruments for an agent.
   */
  async getInstruments(agentId: string): Promise<InstrumentsResponse> {
    const response = await apiService.get<InstrumentsResponse>(
      `${this.baseUrl}/${agentId}/instruments`
    );
    return response;
  }

  /**
   * Update tracked instruments for an agent.
   */
  async updateInstruments(
    agentId: string,
    instruments: string[]
  ): Promise<InstrumentsResponse> {
    const response = await apiService.put<InstrumentsResponse>(
      `${this.baseUrl}/${agentId}/instruments`,
      { instruments }
    );
    return response;
  }

  /**
   * Get tool status for an agent.
   */
  async getToolStatus(agentId: string): Promise<ToolStatusResponse> {
    const response = await apiService.get<ToolStatusResponse>(
      `${this.baseUrl}/${agentId}/tools`
    );
    return response;
  }

  /**
   * Get configuration for an agent.
   */
  async getConfig(agentId: string): Promise<ConfigResponse> {
    const response = await apiService.get<ConfigResponse>(
      `${this.baseUrl}/${agentId}/config`
    );
    return response;
  }

  /**
   * Update configuration for an agent.
   */
  async updateConfig(
    agentId: string,
    config: Partial<PredictionRunnerConfig>
  ): Promise<ConfigResponse> {
    const response = await apiService.put<ConfigResponse>(
      `${this.baseUrl}/${agentId}/config`,
      { config }
    );
    return response;
  }

  /**
   * Get runtime status for an agent.
   */
  async getStatus(agentId: string): Promise<StatusResponse> {
    const response = await apiService.get<StatusResponse>(
      `${this.baseUrl}/${agentId}/status`
    );
    return response;
  }

  // ===========================================================================
  // Lifecycle Control
  // ===========================================================================

  /**
   * Start the ambient agent.
   */
  async startAgent(agentId: string): Promise<StatusResponse> {
    const response = await apiService.post<StatusResponse>(
      `${this.baseUrl}/${agentId}/start`
    );
    return response;
  }

  /**
   * Stop the ambient agent.
   */
  async stopAgent(agentId: string): Promise<StatusResponse> {
    const response = await apiService.post<StatusResponse>(
      `${this.baseUrl}/${agentId}/stop`
    );
    return response;
  }

  /**
   * Pause the ambient agent.
   */
  async pauseAgent(agentId: string): Promise<StatusResponse> {
    const response = await apiService.post<StatusResponse>(
      `${this.baseUrl}/${agentId}/pause`
    );
    return response;
  }

  /**
   * Resume the ambient agent.
   */
  async resumeAgent(agentId: string): Promise<StatusResponse> {
    const response = await apiService.post<StatusResponse>(
      `${this.baseUrl}/${agentId}/resume`
    );
    return response;
  }

  /**
   * Trigger an immediate poll.
   */
  async pollNow(agentId: string): Promise<{ message: string }> {
    const response = await apiService.post<{ message: string }>(
      `${this.baseUrl}/${agentId}/poll-now`
    );
    return response;
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Load all data needed for the dashboard.
   * Returns current state, instruments, config, status, and tools in one call.
   */
  async loadDashboardData(agentId: string): Promise<{
    currentPredictions: CurrentPredictionsResponse | null;
    instruments: InstrumentsResponse | null;
    config: ConfigResponse | null;
    status: StatusResponse | null;
    tools: ToolStatusResponse | null;
  }> {
    // Fetch all data in parallel
    const [currentPredictions, instruments, config, status, tools] = await Promise.allSettled([
      this.getCurrentPredictions(agentId),
      this.getInstruments(agentId),
      this.getConfig(agentId),
      this.getStatus(agentId),
      this.getToolStatus(agentId),
    ]);

    return {
      currentPredictions:
        currentPredictions.status === 'fulfilled' ? currentPredictions.value : null,
      instruments:
        instruments.status === 'fulfilled' ? instruments.value : null,
      config: config.status === 'fulfilled' ? config.value : null,
      status: status.status === 'fulfilled' ? status.value : null,
      tools: tools.status === 'fulfilled' ? tools.value : null,
    };
  }
}

export const predictionAgentService = new PredictionAgentService();
