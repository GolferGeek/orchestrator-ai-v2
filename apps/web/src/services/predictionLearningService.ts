/**
 * Prediction Learning Service
 *
 * Handles API calls for the prediction agent learning loop.
 * Fetches postmortems, missed opportunities, user insights, and manages
 * learning conversations.
 */

import { apiService } from './apiService';

// =============================================================================
// Types
// =============================================================================

export interface LearningSummary {
  totalRecommendations: number;
  totalOutcomes: number;
  overallAccuracyPercent: number | null;
  totalPostmortems: number;
  unappliedPostmortems: number;
  totalMissedOpportunities: number;
  unappliedMissedOpportunities: number;
  totalUserInsights: number;
  validatedInsights: number;
  unappliedInsights: number;
}

export interface PostmortemSummary {
  id: string;
  instrument: string;
  action: string;
  outcome: string;
  returnPercent: number | null;
  rootCause: string | null;
  keyLearnings: string[];
  appliedToContext: boolean;
}

export interface MissedOpportunitySummary {
  id: string;
  instrument: string;
  movePercent: number;
  description: string;
  failureReason: string;
  whatWouldHaveHelped: string[];
  suggestedThresholds: Record<string, number>;
  appliedToContext: boolean;
}

export interface UserInsightSummary {
  id: string;
  type: string;
  instrument: string | null;
  insight: string;
  effectivenessScore: number | null;
  appliedToContext: boolean;
}

export interface SpecialistStat {
  specialist: string;
  instrument: string | null;
  accuracyPercent: number | null;
  avgConfidence: number;
  totalAnalyses: number;
  confidenceWhenCorrect: number | null;
  confidenceWhenIncorrect: number | null;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface LearningConversation {
  id: string;
  status: 'active' | 'completed' | 'abandoned';
  focusType: string;
  messages: ConversationMessage[];
}

export interface MessageResponse {
  response: string;
  extractedInsight: string | null;
  suggestedContextUpdate: {
    section: string;
    updateType: 'append' | 'replace' | 'remove';
    content: string;
    reason: string;
  } | null;
  shouldApplyUpdate: boolean;
}

export interface ApplyLearningsResult {
  postmortemResults: Array<{ success: boolean; error?: string }>;
  missedOpportunityResults: Array<{ success: boolean; error?: string }>;
  userInsightResults: Array<{ success: boolean; error?: string }>;
}

// =============================================================================
// Service
// =============================================================================

class PredictionLearningService {
  private baseUrl = '/predictions';

  /**
   * Get learning summary for an agent.
   */
  async getLearningSummary(agentId: string): Promise<LearningSummary> {
    const response = await apiService.get<LearningSummary>(
      `${this.baseUrl}/${agentId}/learning/stats`
    );
    return response;
  }

  /**
   * Get postmortems for an agent.
   */
  async getPostmortems(
    agentId: string,
    instrument?: string,
    limit: number = 20
  ): Promise<PostmortemSummary[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (instrument) params.set('instrument', instrument);

    const response = await apiService.get<PostmortemSummary[]>(
      `${this.baseUrl}/${agentId}/learning/postmortems?${params}`
    );
    return response;
  }

  /**
   * Get missed opportunities for an agent.
   */
  async getMissedOpportunities(
    agentId: string,
    instrument?: string,
    minMovePercent: number = 5,
    limit: number = 20
  ): Promise<MissedOpportunitySummary[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      minMovePercent: minMovePercent.toString(),
    });
    if (instrument) params.set('instrument', instrument);

    const response = await apiService.get<MissedOpportunitySummary[]>(
      `${this.baseUrl}/${agentId}/learning/missed-opportunities?${params}`
    );
    return response;
  }

  /**
   * Get user insights for an agent.
   */
  async getUserInsights(
    agentId: string,
    instrument?: string,
    validatedOnly: boolean = true,
    limit: number = 20
  ): Promise<UserInsightSummary[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      validatedOnly: validatedOnly.toString(),
    });
    if (instrument) params.set('instrument', instrument);

    const response = await apiService.get<UserInsightSummary[]>(
      `${this.baseUrl}/${agentId}/learning/insights?${params}`
    );
    return response;
  }

  /**
   * Get specialist stats for an agent.
   */
  async getSpecialistStats(
    agentId: string,
    lookbackDays: number = 30
  ): Promise<SpecialistStat[]> {
    const params = new URLSearchParams({
      lookbackDays: lookbackDays.toString(),
    });

    const response = await apiService.get<SpecialistStat[]>(
      `${this.baseUrl}/${agentId}/learning/specialist-stats?${params}`
    );
    return response;
  }

  /**
   * Apply all unapplied learnings for an agent.
   */
  async applyAllLearnings(agentId: string): Promise<ApplyLearningsResult> {
    const response = await apiService.post<ApplyLearningsResult>(
      `${this.baseUrl}/${agentId}/learning/apply-all`
    );
    return response;
  }

  /**
   * Apply a specific postmortem's learnings.
   */
  async applyPostmortem(agentId: string, postmortemId: string): Promise<void> {
    await apiService.post(`${this.baseUrl}/${agentId}/learning/apply-postmortem`, {
      postmortemId,
    });
  }

  /**
   * Apply a specific missed opportunity's threshold changes.
   */
  async applyMissedOpportunity(
    agentId: string,
    opportunityId: string
  ): Promise<void> {
    await apiService.post(`${this.baseUrl}/${agentId}/learning/apply-missed-opportunity`, {
      opportunityId,
    });
  }

  /**
   * Apply a specific user insight.
   */
  async applyUserInsight(agentId: string, insightId: string): Promise<void> {
    await apiService.post(`${this.baseUrl}/${agentId}/learning/apply-insight`, {
      insightId,
    });
  }

  /**
   * Start a learning conversation.
   */
  async startConversation(
    agentId: string,
    focusType: string,
    focusReferenceId?: string,
    focusInstrument?: string
  ): Promise<LearningConversation> {
    const response = await apiService.post<LearningConversation>(
      `${this.baseUrl}/${agentId}/learning/chat/start`,
      {
        focusType,
        focusReferenceId,
        focusInstrument,
      }
    );
    return response;
  }

  /**
   * Send a message in a learning conversation.
   */
  async sendMessage(
    conversationId: string,
    message: string
  ): Promise<MessageResponse> {
    const response = await apiService.post<MessageResponse>(
      `${this.baseUrl}/learning/chat/${conversationId}/message`,
      { message }
    );
    return response;
  }

  /**
   * End a learning conversation.
   */
  async endConversation(conversationId: string): Promise<void> {
    await apiService.post(`${this.baseUrl}/learning/chat/${conversationId}/end`);
  }

  /**
   * Get active conversations for an agent.
   */
  async getActiveConversations(
    agentId: string
  ): Promise<LearningConversation[]> {
    const response = await apiService.get<LearningConversation[]>(
      `${this.baseUrl}/${agentId}/learning/chat/active`
    );
    return response;
  }

  /**
   * Apply a context update from a conversation.
   */
  async applyContextUpdate(
    conversationId: string,
    update: {
      section: string;
      updateType: 'append' | 'replace' | 'remove';
      content: string;
      reason: string;
    }
  ): Promise<void> {
    await apiService.post(
      `${this.baseUrl}/learning/chat/${conversationId}/apply-update`,
      update
    );
  }
}

export const predictionLearningService = new PredictionLearningService();
