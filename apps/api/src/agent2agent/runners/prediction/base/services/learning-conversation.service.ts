/**
 * Learning Conversation Service
 *
 * Manages learning loop conversations where users can provide insights,
 * review predictions, and help the agent learn from mistakes.
 *
 * @module learning-conversation.service
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../../../supabase/supabase.service';
import { LLMGenerationService } from '../../../../../llms/services/llm-generation.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import {
  LearningContextBuilderService,
  LearningContext,
} from './learning-context.service';

/**
 * Learning conversation focus types
 */
export type LearningFocusType =
  | 'postmortem'
  | 'missed_opportunity'
  | 'performance_review'
  | 'threshold_tuning'
  | 'general';

/**
 * Conversation message
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/**
 * Learning conversation state
 */
export interface LearningConversation {
  id: string;
  predictionAgentId: string;
  userId: string;
  status: 'active' | 'completed' | 'abandoned';
  focusType: LearningFocusType;
  focusReferenceId: string | null;
  focusInstrument: string | null;
  messages: ConversationMessage[];
  extractedInsights: string[];
  contextUpdatesApplied: Array<{
    section: string;
    update: string;
    appliedAt: string;
  }>;
  threadId: string | null;
  startedAt: string;
  lastMessageAt: string;
  completedAt: string | null;
}

/**
 * Context update from conversation
 */
export interface ContextUpdate {
  section: string;
  updateType: 'append' | 'replace' | 'remove';
  content: string;
  reason: string;
}

/**
 * Processed message result
 */
export interface ProcessedMessageResult {
  response: string;
  extractedInsight: string | null;
  suggestedContextUpdate: ContextUpdate | null;
  shouldApplyUpdate: boolean;
}

@Injectable()
export class LearningConversationService {
  private readonly logger = new Logger(LearningConversationService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly llmService: LLMGenerationService,
    private readonly learningContextService: LearningContextBuilderService,
  ) {}

  /**
   * Start a new learning conversation.
   *
   * @param predictionAgentId - Agent to learn with
   * @param userId - User starting the conversation
   * @param focusType - Type of learning focus
   * @param focusReferenceId - Optional ID of postmortem/missed opportunity
   * @param focusInstrument - Optional instrument focus
   * @returns New conversation
   */
  async startConversation(
    predictionAgentId: string,
    userId: string,
    focusType: LearningFocusType = 'general',
    focusReferenceId: string | null = null,
    focusInstrument: string | null = null,
  ): Promise<LearningConversation> {
    this.logger.debug(
      `Starting learning conversation for agent ${predictionAgentId} (focus: ${focusType})`,
    );

    const client = this.supabaseService.getServiceClient();
    const now = new Date().toISOString();

    const { data, error } = await client
      .from('predictions.learning_conversations')
      .insert({
        prediction_agent_id: predictionAgentId,
        user_id: userId,
        status: 'active',
        focus_type: focusType,
        focus_reference_id: focusReferenceId,
        focus_instrument: focusInstrument,
        messages: [],
        extracted_insights: [],
        context_updates_applied: [],
        started_at: now,
        last_message_at: now,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to start conversation: ${error.message}`);
      throw new Error(`Failed to start conversation: ${error.message}`);
    }

    return this.mapConversation(data);
  }

  /**
   * Process a user message in the conversation.
   *
   * @param conversationId - Conversation ID
   * @param userMessage - User's message
   * @param executionContext - For LLM calls
   * @returns Processed result with response and potential updates
   */
  async processMessage(
    conversationId: string,
    userMessage: string,
    executionContext: ExecutionContext,
  ): Promise<ProcessedMessageResult> {
    this.logger.debug(`Processing message in conversation ${conversationId}`);

    // Get current conversation
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (conversation.status !== 'active') {
      throw new Error(`Conversation ${conversationId} is not active`);
    }

    // Build learning context
    const learningContext = await this.learningContextService.buildContext(
      conversation.predictionAgentId,
      conversation.focusInstrument,
    );

    // Build the prompt with context
    const prompt = await this.buildLearningPrompt(
      conversation,
      learningContext,
      userMessage,
    );

    // Generate response
    const llmResult = await this.llmService.generateResponse(
      executionContext,
      prompt.systemPrompt,
      prompt.userPrompt,
      { executionContext },
    );

    // Extract content string from response
    const responseText =
      typeof llmResult === 'string' ? llmResult : llmResult.content;

    // Parse response for insights and updates
    const parsed = this.parseResponse(responseText);

    // Add messages to conversation
    const now = new Date().toISOString();
    const userMsg: ConversationMessage = {
      role: 'user',
      content: userMessage,
      timestamp: now,
    };
    const assistantMsg: ConversationMessage = {
      role: 'assistant',
      content: parsed.response,
      timestamp: now,
    };

    conversation.messages.push(userMsg, assistantMsg);
    conversation.lastMessageAt = now;

    // Update conversation in database
    await this.updateConversation(conversation);

    return parsed;
  }

  /**
   * Apply a context update from the conversation.
   *
   * @param conversationId - Conversation ID
   * @param update - Update to apply
   * @returns Success status
   */
  async applyContextUpdate(
    conversationId: string,
    update: ContextUpdate,
  ): Promise<boolean> {
    this.logger.debug(
      `Applying context update from conversation ${conversationId}`,
    );

    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Record the update
    const now = new Date().toISOString();
    conversation.contextUpdatesApplied.push({
      section: update.section,
      update: update.content,
      appliedAt: now,
    });

    await this.updateConversation(conversation);

    this.logger.debug(`Applied context update to section "${update.section}"`);

    return true;
  }

  /**
   * Build the learning prompt for the conversation.
   */
  private async buildLearningPrompt(
    conversation: LearningConversation,
    learningContext: LearningContext,
    userMessage: string,
  ): Promise<{ systemPrompt: string; userPrompt: string }> {
    const contextSection =
      this.learningContextService.formatContextForPrompt(learningContext);

    let focusSection = '';
    if (
      conversation.focusType === 'postmortem' &&
      conversation.focusReferenceId
    ) {
      focusSection = `\nFOCUS: Reviewing postmortem ${conversation.focusReferenceId}`;
    } else if (
      conversation.focusType === 'missed_opportunity' &&
      conversation.focusReferenceId
    ) {
      focusSection = `\nFOCUS: Analyzing missed opportunity ${conversation.focusReferenceId}`;
    } else if (conversation.focusType === 'performance_review') {
      focusSection = '\nFOCUS: Overall performance review';
    } else if (conversation.focusType === 'threshold_tuning') {
      focusSection = `\nFOCUS: Tuning thresholds${conversation.focusInstrument ? ` for ${conversation.focusInstrument}` : ''}`;
    }

    const systemPrompt = `You are a learning assistant for a prediction agent. Your role is to:
1. Help the user understand past predictions and their outcomes
2. Extract insights and learnings from user feedback
3. Suggest improvements to the agent's behavior
4. Apply learnings to the agent's context when appropriate

${focusSection}

LEARNING CONTEXT:
${contextSection}

CONVERSATION HISTORY:
${conversation.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

When responding:
- Be conversational but focused on learning
- Extract actionable insights from user feedback
- If the user provides a correction or insight, acknowledge it and suggest how to apply it
- If you identify a potential context update, format it as:
  [CONTEXT_UPDATE]
  Section: <section name>
  Type: <append|replace|remove>
  Content: <the update>
  Reason: <why this helps>
  [/CONTEXT_UPDATE]

Respond naturally, then include any context update if appropriate.`;

    const userPrompt = userMessage;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse the LLM response for insights and updates.
   */
  private parseResponse(response: string): ProcessedMessageResult {
    let mainResponse = response;
    let extractedInsight: string | null = null;
    let suggestedContextUpdate: ContextUpdate | null = null;
    let shouldApplyUpdate = false;

    // Check for context update block
    const updateMatch = response.match(
      /\[CONTEXT_UPDATE\]([\s\S]*?)\[\/CONTEXT_UPDATE\]/,
    );

    if (updateMatch && updateMatch[1]) {
      // Remove the update block from main response
      mainResponse = response.replace(updateMatch[0], '').trim();

      // Parse the update
      const updateText = updateMatch[1];
      const sectionMatch = updateText.match(/Section:\s*(.+)/);
      const typeMatch = updateText.match(/Type:\s*(append|replace|remove)/);
      const contentMatch = updateText.match(
        /Content:\s*([\s\S]*?)(?=\nReason:|$)/,
      );
      const reasonMatch = updateText.match(/Reason:\s*(.+)/);

      if (sectionMatch?.[1] && typeMatch?.[1] && contentMatch?.[1]) {
        suggestedContextUpdate = {
          section: sectionMatch[1].trim(),
          updateType: typeMatch[1].trim() as 'append' | 'replace' | 'remove',
          content: contentMatch[1].trim(),
          reason: reasonMatch?.[1]?.trim() ?? '',
        };
        shouldApplyUpdate = true;
      }
    }

    // Check for extracted insight
    const insightMatch = response.match(/\[INSIGHT\]([\s\S]*?)\[\/INSIGHT\]/);
    if (insightMatch?.[1]) {
      extractedInsight = insightMatch[1].trim();
      mainResponse = mainResponse.replace(insightMatch[0], '').trim();
    }

    return {
      response: mainResponse,
      extractedInsight,
      suggestedContextUpdate,
      shouldApplyUpdate,
    };
  }

  /**
   * Get a conversation by ID.
   */
  async getConversation(
    conversationId: string,
  ): Promise<LearningConversation | null> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from('predictions.learning_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to get conversation: ${error.message}`);
      throw new Error(`Failed to get conversation: ${error.message}`);
    }

    return this.mapConversation(data);
  }

  /**
   * Get active conversations for an agent.
   */
  async getActiveConversations(
    predictionAgentId: string,
  ): Promise<LearningConversation[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from('predictions.learning_conversations')
      .select('*')
      .eq('prediction_agent_id', predictionAgentId)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to get conversations: ${error.message}`);
      throw new Error(`Failed to get conversations: ${error.message}`);
    }

    return (data || []).map(this.mapConversation);
  }

  /**
   * Complete a conversation.
   */
  async completeConversation(conversationId: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    const { error } = await client
      .from('predictions.learning_conversations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (error) {
      this.logger.error(`Failed to complete conversation: ${error.message}`);
      throw new Error(`Failed to complete conversation: ${error.message}`);
    }

    this.logger.debug(`Completed conversation ${conversationId}`);
  }

  /**
   * Update conversation in database.
   */
  private async updateConversation(
    conversation: LearningConversation,
  ): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    const { error } = await client
      .from('predictions.learning_conversations')
      .update({
        messages: conversation.messages,
        extracted_insights: conversation.extractedInsights,
        context_updates_applied: conversation.contextUpdatesApplied,
        last_message_at: conversation.lastMessageAt,
      })
      .eq('id', conversation.id);

    if (error) {
      this.logger.error(`Failed to update conversation: ${error.message}`);
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  }

  /**
   * Map database row to conversation object.
   */
  private mapConversation(row: Record<string, unknown>): LearningConversation {
    return {
      id: row.id as string,
      predictionAgentId: row.prediction_agent_id as string,
      userId: row.user_id as string,
      status: row.status as 'active' | 'completed' | 'abandoned',
      focusType: row.focus_type as LearningFocusType,
      focusReferenceId: row.focus_reference_id as string | null,
      focusInstrument: row.focus_instrument as string | null,
      messages: (row.messages || []) as ConversationMessage[],
      extractedInsights: (row.extracted_insights || []) as string[],
      contextUpdatesApplied: (row.context_updates_applied || []) as Array<{
        section: string;
        update: string;
        appliedAt: string;
      }>,
      threadId: row.thread_id as string | null,
      startedAt: row.started_at as string,
      lastMessageAt: row.last_message_at as string,
      completedAt: row.completed_at as string | null,
    };
  }
}
