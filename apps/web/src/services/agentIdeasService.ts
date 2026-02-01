/**
 * Agent Ideas Service
 *
 * Handles direct A2A calls to the LangGraph Business Automation Advisor agent:
 * - Fetching AI-generated agent recommendations based on industry
 * - Submitting lead contact information
 *
 * These are public endpoints - no authentication required.
 * Calls LangGraph (6200) directly without going through the API (6100).
 */

import { v4 as uuidv4 } from 'uuid';

// LangGraph API base URL - constructed from port env var
const LANGGRAPH_PORT = import.meta.env.VITE_LANGGRAPH_PORT;
const LANGGRAPH_BASE_URL = LANGGRAPH_PORT ? `http://localhost:${LANGGRAPH_PORT}` : '';
if (!LANGGRAPH_PORT) {
  console.error('VITE_LANGGRAPH_PORT must be set in environment');
}

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
   * Create a minimal ExecutionContext for public landing page calls
   */
  private createPublicContext() {
    return {
      orgSlug: 'public',
      userId: 'landing-page-visitor',
      conversationId: uuidv4(),
      taskId: uuidv4(),
      planId: '',
      deliverableId: '',
      agentSlug: 'business-automation-advisor',
      agentType: 'langgraph',
      provider: 'openai',
      model: 'gpt-4o',
    };
  }

  /**
   * Get agent recommendations for an industry
   *
   * Calls the LangGraph Business Automation Advisor workflow directly.
   * Falls back to static recommendations if LangGraph is unavailable.
   *
   * @param industry - The user's business/industry input
   * @returns AI-generated agent recommendations
   */
  async getRecommendations(industry: string): Promise<RecommendationsResponse> {
    try {
      const response = await fetch(`${LANGGRAPH_BASE_URL}/business-automation-advisor/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: this.createPublicContext(),
          industry,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[AgentIdeasService] Failed to get recommendations:', error);
      throw error;
    }
  }

  /**
   * Submit interest in selected agents
   *
   * Stores the lead submission in the database via LangGraph.
   * The team will build demo agents and notify the user when ready.
   *
   * @param request - Contact info and selected agents
   * @returns Submission confirmation
   */
  async submitInterest(request: SubmitInterestRequest): Promise<SubmissionResponse> {
    try {
      const response = await fetch(`${LANGGRAPH_BASE_URL}/business-automation-advisor/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[AgentIdeasService] Failed to submit interest:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const agentIdeasService = new AgentIdeasService();
