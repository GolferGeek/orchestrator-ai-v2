/**
 * Prediction Controller
 *
 * REST API endpoints for managing and monitoring ambient prediction agents.
 * Provides real-time status, configuration management, and control operations.
 *
 * ENDPOINTS:
 * - GET /predictions/current - Latest recommendations
 * - GET /predictions/history - Historical predictions
 * - GET /predictions/instruments - List tracked instruments
 * - PUT /predictions/instruments - Update tracked instruments
 * - GET /predictions/tools - Tool status and recent claims
 * - GET /predictions/config - Agent configuration
 * - PUT /predictions/config - Update agent configuration
 * - GET /predictions/status - Agent runtime status
 * - POST /predictions/start - Start ambient agent
 * - POST /predictions/stop - Stop ambient agent
 * - POST /predictions/pause - Pause agent
 * - POST /predictions/resume - Resume agent
 * - POST /predictions/poll-now - Trigger immediate poll
 *
 * @module prediction.controller
 */

import {
  Controller,
  Get,
  Post,
  Put,
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
import { AmbientAgentOrchestratorService } from './ambient-agent-orchestrator.service';
import { PredictionDbService } from './base/services/prediction-db.service';
import { SupabaseService } from '../../../supabase/supabase.service';
import {
  AgentStatus,
  PredictionRunnerConfig,
  Recommendation,
  Datapoint,
  Source,
} from './base/base-prediction.types';

/**
 * Response DTOs
 */
interface CurrentPredictionsResponse {
  agentId: string;
  agentSlug: string;
  timestamp: string;
  datapoint?: Datapoint;
  recommendations: Recommendation[];
}

interface HistoryResponse {
  agentId: string;
  total: number;
  page: number;
  pageSize: number;
  recommendations: Recommendation[];
}

interface InstrumentsResponse {
  agentId: string;
  instruments: string[];
}

interface ToolStatusResponse {
  agentId: string;
  tools: Array<{
    name: string;
    lastRun?: string;
    status: 'success' | 'failed' | 'never_run';
    recentClaims: number;
    errorMessage?: string;
  }>;
  recentSources: Source[];
}

interface ConfigResponse {
  agentId: string;
  config: PredictionRunnerConfig;
}

interface StatusResponse {
  status: AgentStatus;
  isRunning: boolean;
}

/**
 * Request DTOs
 */
interface UpdateInstrumentsRequest {
  instruments: string[];
}

interface UpdateConfigRequest {
  config: Partial<PredictionRunnerConfig>;
}

/**
 * Prediction Controller
 *
 * Manages ambient prediction agents through REST API.
 */
@Controller('predictions')
@UseGuards(JwtAuthGuard)
export class PredictionController {
  private readonly logger = new Logger(PredictionController.name);

  constructor(
    private readonly orchestrator: AmbientAgentOrchestratorService,
    private readonly predictionDb: PredictionDbService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * GET /predictions/:agentId/current
   *
   * Get the latest datapoint and recommendations for an agent.
   */
  @Get(':agentId/current')
  async getCurrentPredictions(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<CurrentPredictionsResponse> {
    this.logger.debug(`Fetching current predictions for agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Get latest datapoint
    const client = this.supabaseService.getServiceClient();
    const { data: datapoints, error: dpError } = await client
      .from('prediction_datapoints')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (dpError) {
      throw new BadRequestException(
        `Failed to fetch datapoint: ${dpError.message}`,
      );
    }

    // Get latest recommendations
    const { data: recommendations, error: recError } = await client
      .from('prediction_recommendations')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recError) {
      throw new BadRequestException(
        `Failed to fetch recommendations: ${recError.message}`,
      );
    }

    const agent = await this.loadAgent(agentId);

    return {
      agentId,
      agentSlug: agent.slug,
      timestamp: new Date().toISOString(),
      datapoint: datapoints?.[0] as Datapoint | undefined,
      recommendations: (recommendations || []) as Recommendation[],
    };
  }

  /**
   * GET /predictions/:agentId/history
   *
   * Get historical predictions with pagination.
   */
  @Get(':agentId/history')
  async getHistory(
    @Param('agentId') agentId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: SupabaseAuthUserDto,
  ): Promise<HistoryResponse> {
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    this.logger.debug(`Fetching history for agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    const pageNum = parseInt(page || '1', 10);
    const pageSizeNum = parseInt(pageSize || '20', 10);
    const offset = (pageNum - 1) * pageSizeNum;

    // Get recommendations with pagination
    const client = this.supabaseService.getServiceClient();
    const {
      data: recommendations,
      error: recError,
      count,
    } = await client
      .from('prediction_recommendations')
      .select('*', { count: 'exact' })
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSizeNum - 1);

    if (recError) {
      throw new BadRequestException(
        `Failed to fetch history: ${recError.message}`,
      );
    }

    return {
      agentId,
      total: count || 0,
      page: pageNum,
      pageSize: pageSizeNum,
      recommendations: (recommendations || []) as Recommendation[],
    };
  }

  /**
   * GET /predictions/:agentId/instruments
   *
   * Get list of tracked instruments for an agent.
   */
  @Get(':agentId/instruments')
  async getInstruments(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<InstrumentsResponse> {
    this.logger.debug(`Fetching instruments for agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Load agent and extract instruments from config
    const agent = await this.loadAgent(agentId);
    const config = agent.metadata?.runnerConfig;

    if (!config) {
      throw new BadRequestException('Agent does not have runnerConfig');
    }

    return {
      agentId,
      instruments: config.instruments || [],
    };
  }

  /**
   * PUT /predictions/:agentId/instruments
   *
   * Update tracked instruments for an agent.
   */
  @Put(':agentId/instruments')
  async updateInstruments(
    @Param('agentId') agentId: string,
    @Body() body: UpdateInstrumentsRequest,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<InstrumentsResponse> {
    this.logger.log(`Updating instruments for agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Validate instruments
    if (!Array.isArray(body.instruments) || body.instruments.length === 0) {
      throw new BadRequestException('Instruments must be a non-empty array');
    }

    // Load agent
    const agent = await this.loadAgent(agentId);
    const config = agent.metadata?.runnerConfig;

    if (!config) {
      throw new BadRequestException('Agent does not have runnerConfig');
    }

    // Update instruments in config
    config.instruments = body.instruments;

    // Save updated config
    const client = this.supabaseService.getServiceClient();
    const { error } = await client
      .from('agents')
      .update({
        metadata: {
          ...agent.metadata,
          runnerConfig: config,
        },
      })
      .eq('id', agentId);

    if (error) {
      throw new BadRequestException(
        `Failed to update instruments: ${error.message}`,
      );
    }

    return {
      agentId,
      instruments: config.instruments,
    };
  }

  /**
   * GET /predictions/:agentId/tools
   *
   * Get tool status and recent claims.
   */
  @Get(':agentId/tools')
  async getToolStatus(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<ToolStatusResponse> {
    this.logger.debug(`Fetching tool status for agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Get recent datapoints to analyze tool performance
    const client = this.supabaseService.getServiceClient();
    const { data: datapoints, error: dpError } = await client
      .from('prediction_datapoints')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(5);

    if (dpError) {
      throw new BadRequestException(
        `Failed to fetch datapoints: ${dpError.message}`,
      );
    }

    // Aggregate tool statistics
    const toolStats = new Map<
      string,
      {
        name: string;
        lastRun?: string;
        status: 'success' | 'failed' | 'never_run';
        recentClaims: number;
        errorMessage?: string;
      }
    >();

    const recentSources: Source[] = [];

    if (datapoints && datapoints.length > 0) {
      for (const dp of datapoints) {
        const datapoint = dp as unknown as Datapoint;
        for (const source of datapoint.sources || []) {
          recentSources.push(source);

          const existing = toolStats.get(source.tool);
          const isError = source.metadata?.error === true;

          if (!existing) {
            toolStats.set(source.tool, {
              name: source.tool,
              lastRun: source.fetchedAt,
              status: isError ? 'failed' : 'success',
              recentClaims: source.claims.length,
              errorMessage: isError
                ? typeof source.metadata?.errorMessage === 'string'
                  ? source.metadata.errorMessage
                  : 'Unknown error'
                : undefined,
            });
          } else {
            existing.recentClaims += source.claims.length;
            if (new Date(source.fetchedAt) > new Date(existing.lastRun || '')) {
              existing.lastRun = source.fetchedAt;
              if (isError) {
                existing.status = 'failed';
                existing.errorMessage =
                  typeof source.metadata?.errorMessage === 'string'
                    ? source.metadata.errorMessage
                    : 'Unknown error';
              }
            }
          }
        }
      }
    }

    return {
      agentId,
      tools: Array.from(toolStats.values()),
      recentSources: recentSources.slice(0, 20),
    };
  }

  /**
   * GET /predictions/:agentId/config
   *
   * Get agent configuration.
   */
  @Get(':agentId/config')
  async getConfig(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<ConfigResponse> {
    this.logger.debug(`Fetching config for agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Load agent
    const agent = await this.loadAgent(agentId);
    const config = agent.metadata?.runnerConfig;

    if (!config) {
      throw new BadRequestException('Agent does not have runnerConfig');
    }

    return {
      agentId,
      config,
    };
  }

  /**
   * PUT /predictions/:agentId/config
   *
   * Update agent configuration.
   */
  @Put(':agentId/config')
  async updateConfig(
    @Param('agentId') agentId: string,
    @Body() body: UpdateConfigRequest,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<ConfigResponse> {
    this.logger.log(`Updating config for agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Load agent
    const agent = await this.loadAgent(agentId);
    const existingConfig = agent.metadata?.runnerConfig;

    if (!existingConfig) {
      throw new BadRequestException('Agent does not have runnerConfig');
    }

    // Merge config updates
    const newConfig: PredictionRunnerConfig = {
      ...existingConfig,
      ...body.config,
    };

    // Validate required fields
    if (!newConfig.runner || !newConfig.instruments || !newConfig.riskProfile) {
      throw new BadRequestException(
        'Config must include runner, instruments, and riskProfile',
      );
    }

    // Save updated config
    const client = this.supabaseService.getServiceClient();
    const { error } = await client
      .from('agents')
      .update({
        metadata: {
          ...agent.metadata,
          runnerConfig: newConfig,
        },
      })
      .eq('id', agentId);

    if (error) {
      throw new BadRequestException(
        `Failed to update config: ${error.message}`,
      );
    }

    return {
      agentId,
      config: newConfig,
    };
  }

  /**
   * GET /predictions/:agentId/status
   *
   * Get agent runtime status.
   */
  @Get(':agentId/status')
  async getStatus(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<StatusResponse> {
    this.logger.debug(`Fetching status for agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Get status from orchestrator
    const status = this.orchestrator.getAgentStatus(agentId);

    return {
      status,
      isRunning: status.state === 'running',
    };
  }

  /**
   * POST /predictions/:agentId/start
   *
   * Start ambient agent.
   */
  @Post(':agentId/start')
  async startAgent(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<StatusResponse> {
    this.logger.log(`Starting agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Start agent
    await this.orchestrator.startAgent(agentId);

    // Return updated status
    const status = this.orchestrator.getAgentStatus(agentId);

    return {
      status,
      isRunning: status.state === 'running',
    };
  }

  /**
   * POST /predictions/:agentId/stop
   *
   * Stop ambient agent.
   */
  @Post(':agentId/stop')
  async stopAgent(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<StatusResponse> {
    this.logger.log(`Stopping agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Stop agent
    this.orchestrator.stopAgent(agentId);

    // Return updated status
    const status = this.orchestrator.getAgentStatus(agentId);

    return {
      status,
      isRunning: status.state === 'running',
    };
  }

  /**
   * POST /predictions/:agentId/pause
   *
   * Pause ambient agent.
   */
  @Post(':agentId/pause')
  async pauseAgent(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<StatusResponse> {
    this.logger.log(`Pausing agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Pause agent
    this.orchestrator.pauseAgent(agentId);

    // Return updated status
    const status = this.orchestrator.getAgentStatus(agentId);

    return {
      status,
      isRunning: status.state === 'running',
    };
  }

  /**
   * POST /predictions/:agentId/resume
   *
   * Resume paused agent.
   */
  @Post(':agentId/resume')
  async resumeAgent(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<StatusResponse> {
    this.logger.log(`Resuming agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Resume agent
    this.orchestrator.resumeAgent(agentId);

    // Return updated status
    const status = this.orchestrator.getAgentStatus(agentId);

    return {
      status,
      isRunning: status.state === 'running',
    };
  }

  /**
   * POST /predictions/:agentId/poll-now
   *
   * Trigger immediate poll.
   */
  @Post(':agentId/poll-now')
  async triggerPoll(
    @Param('agentId') agentId: string,
    @CurrentUser() user: SupabaseAuthUserDto,
  ): Promise<{ message: string }> {
    this.logger.log(`Triggering immediate poll for agent ${agentId}`);

    // Verify agent ownership
    await this.verifyAgentOwnership(agentId, user.id);

    // Trigger poll
    await this.orchestrator.triggerPollNow(agentId);

    return {
      message: 'Poll triggered successfully',
    };
  }

  /**
   * Helper: Verify agent ownership.
   */
  private async verifyAgentOwnership(
    agentId: string,
    userId: string,
  ): Promise<void> {
    const agent = await this.loadAgent(agentId);

    // Get user's org
    const client = this.supabaseService.getServiceClient();
    const { data: memberships, error: memberError } = await client
      .from('organization_members')
      .select('org_id')
      .eq('user_id', userId);

    if (memberError) {
      throw new BadRequestException(
        `Failed to verify ownership: ${memberError.message}`,
      );
    }

    const userOrgIds = (memberships || []).map(
      (m) => (m as { org_id: string }).org_id,
    );

    // Check if agent belongs to any of user's orgs
    const { data: org, error: orgError } = await client
      .from('organizations')
      .select('id')
      .eq('slug', agent.org_slug)
      .single();

    if (orgError) {
      throw new BadRequestException(
        `Failed to verify ownership: ${orgError.message}`,
      );
    }

    if (!userOrgIds.includes((org as { id: string }).id)) {
      throw new NotFoundException('Agent not found or access denied');
    }
  }

  /**
   * Helper: Load agent from database.
   */
  private async loadAgent(agentId: string): Promise<{
    id: string;
    slug: string;
    org_slug: string;
    metadata?: { runnerConfig?: PredictionRunnerConfig };
  }> {
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('agents')
      .select('id, slug, org_slug, metadata')
      .eq('id', agentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Agent not found');
      }
      throw new BadRequestException(`Failed to load agent: ${error.message}`);
    }

    return data as {
      id: string;
      slug: string;
      org_slug: string;
      metadata?: { runnerConfig?: PredictionRunnerConfig };
    };
  }
}
