/**
 * Finance Service
 *
 * Handles all Finance-related API calls for universes, recommendations, and outcomes.
 * Components/stores should use this service for finance data operations.
 */

import { apiService } from './apiService';

// Types
export interface Instrument {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'crypto' | 'forex' | 'commodity';
  exchange?: string;
}

export interface Universe {
  id: string;
  orgSlug: string;
  slug: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UniverseVersion {
  id: string;
  universeId: string;
  version: number;
  isActive: boolean;
  config: {
    instruments: Instrument[];
    marketHours?: string;
    timezone?: string;
    timingWindows?: string[];
    dataSourceProfile?: Record<string, unknown>;
  };
  createdAt: string;
}

export interface Recommendation {
  id: string;
  runId: string;
  instrument: string;
  action: 'buy' | 'sell' | 'hold';
  timingWindow: 'pre_close' | 'post_close' | 'pre_open' | 'intraday';
  entryStyle: string;
  intendedPrice?: number;
  sizing?: Record<string, unknown>;
  rationale: string;
  modelMetadata?: Record<string, unknown>;
  createdAt: string;
}

export interface RecommendationOutcome {
  id: string;
  recommendationId: string;
  realizedReturnMetrics: Record<string, number>;
  winLoss: 'win' | 'loss' | 'neutral';
  evaluationNotes: string;
  evaluatedAt: string;
}

export interface Postmortem {
  id: string;
  recommendationId: string;
  whatHappened: string;
  whyItHappened: string;
  linkedAgendaEvents: string[];
  lessons: string[];
  createdAt: string;
}

export interface RecommendationRun {
  id: string;
  universeVersionId: string;
  runTs: string;
  producedByAgent: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
}

export interface RecommendationWithOutcome extends Recommendation {
  outcome?: RecommendationOutcome;
  postmortem?: Postmortem;
}

export interface CreateUniverseDto {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateUniverseDto {
  name?: string;
  description?: string;
}

export interface CreateUniverseVersionDto {
  config: {
    instruments: Instrument[];
    marketHours?: string;
    timezone?: string;
    timingWindows?: string[];
  };
  setActive?: boolean;
}

export interface TriggerRunDto {
  universeVersionId: string;
  timingWindows?: string[];
  lookbackDays?: number;
  includeAgendaAnalysis?: boolean;
}

export interface RunResult {
  taskId: string;
  runId: string;
  recommendationCount: number;
  recommendations: Recommendation[];
  duration: number;
}

export interface EvaluationResult {
  summary: {
    evaluated: number;
    wins: number;
    losses: number;
    neutral: number;
    withPostmortems: number;
  };
  results: Array<{
    recommendationId: string;
    outcome: RecommendationOutcome;
    postmortem?: Postmortem;
  }>;
}

class FinanceService {
  private getOrgHeader(organizationSlug: string): Record<string, string> {
    return { 'x-organization-slug': organizationSlug };
  }

  // ==================== Universes ====================

  /**
   * Get all universes for the finance org
   */
  async getUniverses(): Promise<Universe[]> {
    const response = await apiService.get<Universe[]>(
      '/api/finance/universes',
      { headers: this.getOrgHeader('finance') },
    );
    return response;
  }

  /**
   * Get a single universe by ID
   */
  async getUniverse(universeId: string): Promise<Universe> {
    const response = await apiService.get<Universe>(
      `/api/finance/universes/${universeId}`,
      { headers: this.getOrgHeader('finance') },
    );
    return response;
  }

  /**
   * Create a new universe
   */
  async createUniverse(data: CreateUniverseDto): Promise<Universe> {
    const response = await apiService.post<Universe>(
      '/api/finance/universes',
      data,
      { headers: this.getOrgHeader('finance') },
    );
    return response;
  }

  /**
   * Update a universe
   */
  async updateUniverse(
    universeId: string,
    data: UpdateUniverseDto,
  ): Promise<Universe> {
    const response = await apiService.patch<Universe>(
      `/api/finance/universes/${universeId}`,
      data,
      { headers: this.getOrgHeader('finance') },
    );
    return response;
  }

  /**
   * Delete a universe
   */
  async deleteUniverse(universeId: string): Promise<void> {
    await apiService.delete(`/api/finance/universes/${universeId}`, {
      headers: this.getOrgHeader('finance'),
    });
  }

  // ==================== Universe Versions ====================

  /**
   * Get all versions for a universe
   */
  async getUniverseVersions(universeId: string): Promise<UniverseVersion[]> {
    const response = await apiService.get<UniverseVersion[]>(
      `/api/finance/universes/${universeId}/versions`,
      { headers: this.getOrgHeader('finance') },
    );
    return response;
  }

  /**
   * Create a new universe version
   */
  async createUniverseVersion(
    universeId: string,
    data: CreateUniverseVersionDto,
  ): Promise<UniverseVersion> {
    const response = await apiService.post<UniverseVersion>(
      `/api/finance/universes/${universeId}/versions`,
      data,
      { headers: this.getOrgHeader('finance') },
    );
    return response;
  }

  /**
   * Set a version as active
   */
  async setActiveVersion(
    universeId: string,
    versionId: string,
  ): Promise<void> {
    await apiService.post(
      `/api/finance/universes/${universeId}/versions/${versionId}/activate`,
      {},
      { headers: this.getOrgHeader('finance') },
    );
  }

  // ==================== Recommendations ====================

  /**
   * Get recommendations for a run
   */
  async getRecommendations(runId: string): Promise<Recommendation[]> {
    const response = await apiService.get<{ data: { recommendations: Recommendation[] } }>(
      `/api/finance/recommendations/${runId}`,
      { headers: this.getOrgHeader('finance') },
    );
    return response.data.recommendations;
  }

  /**
   * Get recommendations with outcomes for a universe version
   */
  async getRecommendationsWithOutcomes(
    universeVersionId: string,
  ): Promise<RecommendationWithOutcome[]> {
    const response = await apiService.get<RecommendationWithOutcome[]>(
      `/api/finance/universes/versions/${universeVersionId}/recommendations`,
      { headers: this.getOrgHeader('finance') },
    );
    return response;
  }

  /**
   * Trigger a new research run
   */
  async triggerRun(data: TriggerRunDto): Promise<RunResult> {
    const response = await apiService.post<{ data: RunResult }>(
      '/api/finance/run',
      {
        context: {
          orgSlug: 'finance',
          agentSlug: 'finance-research',
          agentType: 'api',
        },
        ...data,
      },
      { headers: this.getOrgHeader('finance') },
    );
    return response.data;
  }

  // ==================== Evaluation ====================

  /**
   * Trigger evaluation for pending recommendations
   */
  async triggerEvaluation(lookbackHours?: number): Promise<EvaluationResult> {
    const url = lookbackHours
      ? `/api/finance/evaluate?lookbackHours=${lookbackHours}`
      : '/api/finance/evaluate';

    const response = await apiService.post<{ data: EvaluationResult }>(
      url,
      {
        context: {
          orgSlug: 'finance',
          agentSlug: 'finance-research',
          agentType: 'api',
        },
      },
      { headers: this.getOrgHeader('finance') },
    );
    return response.data;
  }

  /**
   * Get learning context for instruments
   */
  async getLearningContext(
    instruments: string[],
    limit?: number,
  ): Promise<string> {
    const params = new URLSearchParams();
    params.set('instruments', instruments.join(','));
    if (limit) {
      params.set('limit', limit.toString());
    }

    const response = await apiService.get<{ data: { context: string } }>(
      `/api/finance/learning-context?${params.toString()}`,
      { headers: this.getOrgHeader('finance') },
    );
    return response.data.context;
  }

  // ==================== Statistics ====================

  /**
   * Get performance statistics for a universe
   */
  async getUniverseStats(universeVersionId: string): Promise<{
    totalRecommendations: number;
    evaluatedCount: number;
    winRate: number;
    averageReturn: number;
    byTimingWindow: Record<string, { count: number; winRate: number }>;
    byAction: Record<string, { count: number; winRate: number }>;
  }> {
    const response = await apiService.get<{
      data: {
        totalRecommendations: number;
        evaluatedCount: number;
        winRate: number;
        averageReturn: number;
        byTimingWindow: Record<string, { count: number; winRate: number }>;
        byAction: Record<string, { count: number; winRate: number }>;
      };
    }>(
      `/api/finance/universes/versions/${universeVersionId}/stats`,
      { headers: this.getOrgHeader('finance') },
    );
    return response.data;
  }
}

export const financeService = new FinanceService();
export default financeService;
