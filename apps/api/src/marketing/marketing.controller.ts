import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketingService } from './marketing.service';
import {
  ContentTypeDto,
  MarketingAgentDto,
  AgentLLMConfigDto,
  MarketingAgentWithConfigsDto,
} from './dto';

/**
 * Marketing Swarm Configuration Controller
 *
 * Provides endpoints for the Marketing Swarm UI to fetch:
 * - Content types (blog posts, social media, etc.)
 * - Marketing agents (writers, editors, evaluators)
 * - LLM configurations for each agent
 *
 * All endpoints are read-only and require authentication.
 */
@Controller('marketing')
@UseGuards(JwtAuthGuard)
export class MarketingController {
  constructor(private marketingService: MarketingService) {}

  /**
   * Get full swarm configuration in a single request
   * GET /marketing/config
   *
   * Returns all content types and agents grouped by role with their LLM configs.
   * This is the primary endpoint for the Marketing Swarm UI initialization.
   */
  @Get('config')
  async getSwarmConfiguration(): Promise<{
    contentTypes: ContentTypeDto[];
    writers: MarketingAgentWithConfigsDto[];
    editors: MarketingAgentWithConfigsDto[];
    evaluators: MarketingAgentWithConfigsDto[];
  }> {
    return this.marketingService.getSwarmConfiguration();
  }

  /**
   * Get all active content types
   * GET /marketing/content-types
   */
  @Get('content-types')
  async getContentTypes(): Promise<ContentTypeDto[]> {
    return this.marketingService.getContentTypes();
  }

  /**
   * Get a single content type by slug
   * GET /marketing/content-types/:slug
   */
  @Get('content-types/:slug')
  async getContentTypeBySlug(
    @Param('slug') slug: string,
  ): Promise<ContentTypeDto> {
    return this.marketingService.getContentTypeBySlug(slug);
  }

  /**
   * Get all active marketing agents
   * GET /marketing/agents
   * GET /marketing/agents?role=writer|editor|evaluator
   * GET /marketing/agents?includeConfigs=true
   */
  @Get('agents')
  async getAgents(
    @Query('role') role?: 'writer' | 'editor' | 'evaluator',
    @Query('includeConfigs') includeConfigs?: string,
  ): Promise<MarketingAgentDto[] | MarketingAgentWithConfigsDto[]> {
    const withConfigs = includeConfigs === 'true';

    if (role) {
      return withConfigs
        ? this.marketingService.getAgentsByRoleWithConfigs(role)
        : this.marketingService.getAgentsByRole(role);
    }

    return withConfigs
      ? this.marketingService.getAgentsWithConfigs()
      : this.marketingService.getAgents();
  }

  /**
   * Get a single agent by slug
   * GET /marketing/agents/:slug
   */
  @Get('agents/:slug')
  async getAgentBySlug(
    @Param('slug') slug: string,
  ): Promise<MarketingAgentDto> {
    return this.marketingService.getAgentBySlug(slug);
  }

  /**
   * Get all LLM configs for an agent
   * GET /marketing/agents/:agentId/llm-configs
   */
  @Get('agents/:agentId/llm-configs')
  async getLLMConfigsForAgent(
    @Param('agentId') agentId: string,
  ): Promise<AgentLLMConfigDto[]> {
    return this.marketingService.getLLMConfigsForAgent(agentId);
  }

  /**
   * Get all active LLM configs
   * GET /marketing/llm-configs
   */
  @Get('llm-configs')
  async getAllLLMConfigs(): Promise<AgentLLMConfigDto[]> {
    return this.marketingService.getAllLLMConfigs();
  }
}
