/**
 * Agent Ideas Service
 *
 * Handles API calls for the Agent Ideas landing page feature:
 * - Fetching AI-generated agent recommendations based on industry
 * - Submitting lead contact information
 *
 * These are public endpoints - no authentication required.
 */

import { apiService } from './apiService';

/**
 * Agent recommendation from the LangGraph workflow
 */
export interface AgentRecommendation {
  name: string;
  tagline: string;
  description: string;
  use_case_example: string;
  time_saved: string;
  wow_factor: string;
  category: string;
}

/**
 * Response from the recommendations endpoint
 */
export interface RecommendationsResponse {
  status: 'success' | 'partial' | 'error';
  message: string;
  data?: {
    industry: string;
    industryDescription: string;
    recommendationCount: number;
    isFallback: boolean;
    recommendations: AgentRecommendation[];
    processingTimeMs: number;
  };
  error?: string;
}

/**
 * Request to submit interest
 */
export interface SubmitInterestRequest {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  industryInput: string;
  normalizedIndustry?: string;
  industryDescription?: string;
  selectedAgents: AgentRecommendation[];
  allRecommendations?: AgentRecommendation[];
  isFallback?: boolean;
  processingTimeMs?: number;
}

/**
 * Response from the submit endpoint
 */
export interface SubmissionResponse {
  success: boolean;
  submissionId: string;
  message: string;
}

class AgentIdeasService {
  /**
   * Get agent recommendations for an industry
   *
   * Calls the LangGraph Business Automation Advisor workflow.
   * Falls back to static recommendations if LangGraph is unavailable.
   *
   * @param industry - The user's business/industry input
   * @returns AI-generated agent recommendations
   */
  async getRecommendations(industry: string): Promise<RecommendationsResponse> {
    try {
      const response = await apiService.post<RecommendationsResponse>(
        '/agent-ideas/recommendations',
        { industry }
      );
      return response;
    } catch (error) {
      console.error('[AgentIdeasService] Failed to get recommendations:', error);
      throw error;
    }
  }

  /**
   * Submit interest in selected agents
   *
   * Stores the lead submission in the database.
   * The team will build demo agents and notify the user when ready.
   *
   * @param request - Contact info and selected agents
   * @returns Submission confirmation
   */
  async submitInterest(request: SubmitInterestRequest): Promise<SubmissionResponse> {
    try {
      const response = await apiService.post<SubmissionResponse>(
        '/agent-ideas/submit',
        request
      );
      return response;
    } catch (error) {
      console.error('[AgentIdeasService] Failed to submit interest:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const agentIdeasService = new AgentIdeasService();
