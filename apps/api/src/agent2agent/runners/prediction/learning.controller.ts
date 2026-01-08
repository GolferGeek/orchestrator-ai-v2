/**
 * Learning Controller
 *
 * REST API endpoints for the learning loop functionality of prediction agents.
 * Manages postmortems, missed opportunities, user insights, learning conversations,
 * and context updates.
 *
 * ENDPOINTS:
 * - GET /learning/:agentId/summary - Learning summary with stats
 * - GET /learning/:agentId/postmortems - Get postmortems with filters
 * - GET /learning/:agentId/missed-opportunities - Get missed opportunities
 * - GET /learning/:agentId/user-insights - Get user insights
 * - GET /learning/:agentId/specialist-stats - Get specialist accuracy stats
 * - POST /learning/:agentId/apply-all - Apply all unapplied learnings
 * - POST /learning/:agentId/chat/start - Start learning conversation
 * - POST /learning/:agentId/chat/:conversationId/message - Send message
 * - POST /learning/:agentId/chat/:conversationId/end - End conversation
 * - POST /learning/:agentId/apply-update - Apply context update
 *
 * @module learning.controller
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  BadRequestException,
  NotFoundException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { SupabaseAuthUserDto } from '../../../auth/dto/auth.dto';
import { SupabaseService } from '../../../supabase/supabase.service';
import {
  LearningContextBuilderService,
  PostmortemSummary,
  UserInsightSummary,
  SpecialistStatSummary,
} from './base/services/learning-context.service';
import { LearningConversationService } from './base/services/learning-conversation.service';
import { AgentContextUpdateService } from './base/services/agent-context-update.service';
import { PostmortemService } from './base/services/postmortem.service';
import {
  MissedOpportunityService,
  MissedOpportunity,
} from './base/services/missed-opportunity.service';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';

/**
 * Response DTOs
 */
interface LearningSummaryResponse {
  agentId: string;
  accuracy: number | null;
  totalRecommendations: number;
  correctRecommendations: number;
  postmortemCount: number;
  unappliedCount: number;
  recentInsights: number;
}

interface PostmortemsResponse {
  agentId: string;
  total: number;
  postmortems: PostmortemSummary[];
}

interface MissedOpportunitiesResponse {
  agentId: string;
  total: number;
  missedOpportunities: MissedOpportunity[];
}

interface UserInsightsResponse {
  agentId: string;
  total: number;
  insights: UserInsightSummary[];
}

interface SpecialistStatsResponse {
  agentId: string;
  specialists: SpecialistStatSummary[];
}

interface ApplyLearningsResponse {
  success: boolean;
  applied: {
    postmortems: number;
    missedOpportunities: number;
    userInsights: number;
  };
}

interface ChatStartResponse {
  conversationId: string;
  initialMessage: string;
}

interface ChatMessageResponse {
  conversationId: string;
  assistantMessage: string;
  contextUpdates: Array<{
    section: string;
    updateType: string;
    applied: boolean;
  }>;
}

interface ChatEndResponse {
  conversationId: string;
  summary: string;
  insightsRecorded: number;
  contextUpdatesApplied: number;
}

interface ApplyUpdateResponse {
  success: boolean;
  section: string;
  previousValue: unknown;
  newValue: unknown;
}

/**
 * Request DTOs
 */
interface StartChatRequest {
  focus?:
    | 'postmortem'
    | 'missed_opportunity'
    | 'performance_review'
    | 'threshold_tuning'
    | 'general';
  focusId?: string;
  initialQuestion?: string;
}

interface SendMessageRequest {
  message: string;
}

interface ApplyUpdateRequest {
  section: string;
  updateType: 'append' | 'replace' | 'remove';
  content: string;
  reason: string;
  sourceType:
    | 'postmortem'
    | 'missed_opportunity'
    | 'user_insight'
    | 'conversation';
  sourceId?: string;
}

/**
 * Learning Controller
 *
 * Manages learning loop functionality for prediction agents.
 */
@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  private readonly logger = new Logger(LearningController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly learningContext: LearningContextBuilderService,
    private readonly learningConversation: LearningConversationService,
    private readonly contextUpdate: AgentContextUpdateService,
    private readonly postmortemService: PostmortemService,
    private readonly missedOpportunityService: MissedOpportunityService,
  ) {}

  /**
   * GET /learning/:agentId/summary
   *
   * Get learning summary with stats.
   */
  @Get(':agentId/summary')
  async getSummary(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<LearningSummaryResponse> {
    this.logger.debug(`Fetching learning summary for agent ${agentId}`);

    await this.verifyAgentOwnership(agentId, user.id);

    const client = this.supabaseService.getServiceClient();

    // Get agent learning summary from database function
    const { data, error } = await client.rpc('get_agent_learning_summary', {
      p_prediction_agent_id: agentId,
    });

    if (error) {
      throw new BadRequestException(
        `Failed to get learning summary: ${error.message}`,
      );
    }

    // Type the summary data from RPC result
    interface LearningSummaryData {
      accuracy_rate?: number | null;
      total_recommendations?: number;
      correct_recommendations?: number;
      postmortem_count?: number;
      unapplied_count?: number;
      recent_insights?: number;
    }

    const summaryArray = data as LearningSummaryData[] | null;
    const summary: LearningSummaryData = summaryArray?.[0] ?? {};

    return {
      agentId,
      accuracy: summary.accuracy_rate ?? null,
      totalRecommendations: summary.total_recommendations ?? 0,
      correctRecommendations: summary.correct_recommendations ?? 0,
      postmortemCount: summary.postmortem_count ?? 0,
      unappliedCount: summary.unapplied_count ?? 0,
      recentInsights: summary.recent_insights ?? 0,
    };
  }

  /**
   * GET /learning/:agentId/postmortems
   *
   * Get postmortems with filters.
   */
  @Get(':agentId/postmortems')
  async getPostmortems(
    @Param('agentId') agentId: string,
    @Query('instrument') instrument?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: SupabaseAuthUserDto,
  ): Promise<PostmortemsResponse> {
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    this.logger.debug(`Fetching postmortems for agent ${agentId}`);

    await this.verifyAgentOwnership(agentId, user.id);

    const postmortems = await this.learningContext.getPostmortems(
      agentId,
      instrument || null,
      parseInt(limit || '20', 10),
    );

    return {
      agentId,
      total: postmortems.length,
      postmortems,
    };
  }

  /**
   * GET /learning/:agentId/missed-opportunities
   *
   * Get missed opportunities.
   */
  @Get(':agentId/missed-opportunities')
  async getMissedOpportunities(
    @Param('agentId') agentId: string,
    @Query('instrument') instrument?: string,
    @Query('minMove') minMove?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: SupabaseAuthUserDto,
  ): Promise<MissedOpportunitiesResponse> {
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    this.logger.debug(`Fetching missed opportunities for agent ${agentId}`);

    await this.verifyAgentOwnership(agentId, user.id);

    const missedOpportunities =
      await this.missedOpportunityService.getMissedOpportunities(
        agentId,
        instrument || null,
        parseFloat(minMove || '5.0'),
        parseInt(limit || '20', 10),
      );

    return {
      agentId,
      total: missedOpportunities.length,
      missedOpportunities,
    };
  }

  /**
   * GET /learning/:agentId/user-insights
   *
   * Get user insights.
   */
  @Get(':agentId/user-insights')
  async getUserInsights(
    @Param('agentId') agentId: string,
    @Query('validated') validated?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: SupabaseAuthUserDto,
  ): Promise<UserInsightsResponse> {
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    this.logger.debug(`Fetching user insights for agent ${agentId}`);

    await this.verifyAgentOwnership(agentId, user.id);

    const insights = await this.learningContext.getUserInsights(
      agentId,
      null, // instrument
      validated === 'true', // validatedOnly
      parseInt(limit || '20', 10),
    );

    return {
      agentId,
      total: insights.length,
      insights,
    };
  }

  /**
   * GET /learning/:agentId/specialist-stats
   *
   * Get specialist accuracy stats.
   */
  @Get(':agentId/specialist-stats')
  async getSpecialistStats(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<SpecialistStatsResponse> {
    this.logger.debug(`Fetching specialist stats for agent ${agentId}`);

    await this.verifyAgentOwnership(agentId, user.id);

    const stats = await this.learningContext.getSpecialistStats(agentId);

    return {
      agentId,
      specialists: stats,
    };
  }

  /**
   * POST /learning/:agentId/apply-all
   *
   * Apply all unapplied learnings.
   */
  @Post(':agentId/apply-all')
  async applyAllLearnings(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<ApplyLearningsResponse> {
    this.logger.log(`Applying all learnings for agent ${agentId}`);

    await this.verifyAgentOwnership(agentId, user.id);

    const results =
      await this.contextUpdate.applyAllUnappliedLearnings(agentId);

    return {
      success: true,
      applied: {
        postmortems: results.postmortemResults.filter((r) => r.success).length,
        missedOpportunities: results.missedOpportunityResults.filter(
          (r) => r.success,
        ).length,
        userInsights: results.userInsightResults.filter((r) => r.success)
          .length,
      },
    };
  }

  /**
   * POST /learning/:agentId/chat/start
   *
   * Start a learning conversation.
   */
  @Post(':agentId/chat/start')
  async startChat(
    @Param('agentId') agentId: string,
    @Body() body: StartChatRequest,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<ChatStartResponse> {
    this.logger.log(`Starting learning chat for agent ${agentId}`);

    await this.verifyAgentOwnership(agentId, user.id);

    const conversation = await this.learningConversation.startConversation(
      agentId,
      user.id,
      body.focus || 'general',
      body.focusId || null,
      null, // focusInstrument
    );

    return {
      conversationId: conversation.id,
      initialMessage:
        conversation.messages[0]?.content ||
        'How can I help you learn from your predictions?',
    };
  }

  /**
   * POST /learning/:agentId/chat/:conversationId/message
   *
   * Send a message in a learning conversation.
   */
  @Post(':agentId/chat/:conversationId/message')
  async sendMessage(
    @Param('agentId') agentId: string,
    @Param('conversationId') conversationId: string,
    @Body() body: SendMessageRequest,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<ChatMessageResponse> {
    this.logger.debug(`Processing message for conversation ${conversationId}`);

    await this.verifyAgentOwnership(agentId, user.id);

    // Create execution context
    const executionContext = await this.createExecutionContext(agentId, user);

    const result = await this.learningConversation.processMessage(
      conversationId,
      body.message,
      executionContext,
    );

    // Map ProcessedMessageResult to ChatMessageResponse
    const contextUpdates: Array<{
      section: string;
      updateType: string;
      applied: boolean;
    }> = [];
    if (result.suggestedContextUpdate) {
      contextUpdates.push({
        section: result.suggestedContextUpdate.section,
        updateType: result.suggestedContextUpdate.updateType,
        applied: result.shouldApplyUpdate,
      });
    }

    return {
      conversationId,
      assistantMessage: result.response,
      contextUpdates,
    };
  }

  /**
   * POST /learning/:agentId/chat/:conversationId/end
   *
   * End a learning conversation.
   */
  @Post(':agentId/chat/:conversationId/end')
  async endChat(
    @Param('agentId') agentId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<ChatEndResponse> {
    this.logger.log(`Ending learning chat ${conversationId}`);

    await this.verifyAgentOwnership(agentId, user.id);

    // Get conversation summary
    const client = this.supabaseService.getServiceClient();

    // Define conversation data type
    interface ConversationData {
      summary?: string;
      insights_extracted?: number;
      context_updates_applied?: number;
    }

    const { data: conversation, error } = await client
      .from('predictions.learning_conversations')
      .select('summary, insights_extracted, context_updates_applied')
      .eq('id', conversationId)
      .single<ConversationData>();

    if (error) {
      throw new BadRequestException(
        `Failed to get conversation: ${error.message}`,
      );
    }

    // Mark as ended
    await client
      .from('predictions.learning_conversations')
      .update({
        ended_at: new Date().toISOString(),
        status: 'completed',
      })
      .eq('id', conversationId);

    return {
      conversationId,
      summary: conversation?.summary ?? 'Conversation completed',
      insightsRecorded: conversation?.insights_extracted ?? 0,
      contextUpdatesApplied: conversation?.context_updates_applied ?? 0,
    };
  }

  /**
   * POST /learning/:agentId/apply-update
   *
   * Apply a context update.
   */
  @Post(':agentId/apply-update')
  async applyUpdate(
    @Param('agentId') agentId: string,
    @Body() body: ApplyUpdateRequest,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<ApplyUpdateResponse> {
    this.logger.log(`Applying context update to agent ${agentId}`);

    await this.verifyAgentOwnership(agentId, user.id);

    const result = await this.contextUpdate.appendToContext(agentId, {
      section: body.section as
        | 'learned_patterns'
        | 'risk_guidelines'
        | 'specialist_calibration'
        | 'threshold_adjustments'
        | 'user_preferences'
        | 'domain_knowledge'
        | 'custom',
      updateType: body.updateType,
      content: body.content,
      reason: body.reason,
      sourceType: body.sourceType,
      sourceId: body.sourceId || null,
    });

    return {
      success: result.success,
      section: body.section,
      previousValue: result.previousValue,
      newValue: result.newValue,
    };
  }

  /**
   * Helper: Verify agent ownership.
   */
  private async verifyAgentOwnership(
    agentId: string,
    userId: string,
  ): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    // Define types for database queries
    interface PredictionAgentData {
      agent_slug: string;
    }

    interface AgentData {
      org_slug: string;
    }

    interface MembershipData {
      organizations: { slug: string } | { slug: string }[];
    }

    // Get prediction agent
    const { data: predAgent, error: paError } = await client
      .from('predictions.prediction_agents')
      .select('agent_slug')
      .eq('id', agentId)
      .single<PredictionAgentData>();

    if (paError) {
      if (paError.code === 'PGRST116') {
        throw new NotFoundException('Prediction agent not found');
      }
      throw new BadRequestException(`Failed to load agent: ${paError.message}`);
    }

    // Get agent's org
    const { data: agent, error: agError } = await client
      .from('agents')
      .select('org_slug')
      .eq('slug', predAgent.agent_slug)
      .single<AgentData>();

    if (agError) {
      throw new BadRequestException(`Failed to load agent: ${agError.message}`);
    }

    // Get user's orgs
    const { data: memberships, error: memberError } = await client
      .from('organization_members')
      .select('organizations!inner(slug)')
      .eq('user_id', userId);

    if (memberError) {
      throw new BadRequestException(
        `Failed to verify ownership: ${memberError.message}`,
      );
    }

    const typedMemberships = (memberships ?? []) as MembershipData[];
    const userOrgSlugs = typedMemberships
      .map((m) => {
        const orgs = m.organizations;
        return Array.isArray(orgs) ? orgs[0]?.slug : orgs?.slug;
      })
      .filter((slug): slug is string => !!slug);

    if (!userOrgSlugs.includes(agent.org_slug)) {
      throw new NotFoundException('Agent not found or access denied');
    }
  }

  /**
   * Helper: Create execution context for learning operations.
   */
  private async createExecutionContext(
    agentId: string,
    user: SupabaseAuthUserDto,
  ): Promise<ExecutionContext> {
    const client = this.supabaseService.getServiceClient();

    // Define types for database queries
    interface PredictionAgentData {
      agent_slug: string;
    }

    interface AgentMetadata {
      llmConfig?: { provider?: string; model?: string };
    }

    interface AgentContextData {
      org_slug: string;
      agent_type: string;
      metadata: AgentMetadata | null;
    }

    // Get prediction agent
    const { data: predAgent, error: paError } = await client
      .from('predictions.prediction_agents')
      .select('agent_slug')
      .eq('id', agentId)
      .single<PredictionAgentData>();

    if (paError) {
      throw new BadRequestException(`Failed to load agent: ${paError.message}`);
    }

    // Get agent
    const { data: agent, error: agError } = await client
      .from('agents')
      .select('org_slug, agent_type, metadata')
      .eq('slug', predAgent.agent_slug)
      .single<AgentContextData>();

    if (agError) {
      throw new BadRequestException(`Failed to load agent: ${agError.message}`);
    }

    // Get LLM config from agent metadata
    const llmConfig = agent.metadata?.llmConfig;

    return {
      orgSlug: agent.org_slug,
      userId: user.id,
      conversationId: NIL_UUID,
      taskId: NIL_UUID,
      planId: NIL_UUID,
      deliverableId: NIL_UUID,
      agentSlug: predAgent.agent_slug,
      agentType: agent.agent_type,
      provider: llmConfig?.provider ?? 'anthropic',
      model: llmConfig?.model ?? 'claude-sonnet-4-20250514',
    };
  }
}
