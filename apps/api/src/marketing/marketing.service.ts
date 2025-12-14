import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MarketingDatabaseService } from './marketing-database.service';
import {
  ContentTypeDto,
  MarketingAgentDto,
  AgentLLMConfigDto,
  MarketingAgentWithConfigsDto,
} from './dto';

// Database row interfaces (snake_case)
interface DbContentType {
  slug: string;
  organization_slug: string;
  name: string;
  description: string | null;
  system_context: string | null;
  created_at: string;
  updated_at: string;
}

interface DbMarketingAgent {
  slug: string;
  organization_slug: string;
  role: 'writer' | 'editor' | 'evaluator';
  name: string;
  personality: {
    system_context?: string;
    style_guidelines?: string;
    strengths?: string[];
  } | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbAgentLLMConfig {
  id: string;
  agent_slug: string;
  llm_provider: string;
  llm_model: string;
  display_name: string | null;
  is_default: boolean;
  created_at: string;
}

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(private marketingDb: MarketingDatabaseService) {}

  /**
   * Convert database content type row to DTO
   */
  private toContentTypeDto(row: DbContentType): ContentTypeDto {
    return {
      id: row.slug, // Use slug as ID since it's the primary key
      slug: row.slug,
      name: row.name,
      description: row.description || undefined,
      systemPromptTemplate: row.system_context || undefined,
      requiredFields: undefined, // No required_fields in new schema
      isActive: true, // All fetched rows are active (filtered in query)
    };
  }

  /**
   * Convert database agent row to DTO
   */
  private toAgentDto(row: DbMarketingAgent): MarketingAgentDto {
    return {
      id: row.slug, // Use slug as ID since it's the primary key
      slug: row.slug,
      name: row.name,
      role: row.role,
      description: row.personality?.style_guidelines || undefined,
      systemPrompt: row.personality?.system_context || undefined,
      isActive: row.is_active,
    };
  }

  /**
   * Convert database LLM config row to DTO
   */
  private toLLMConfigDto(row: DbAgentLLMConfig): AgentLLMConfigDto {
    return {
      id: row.id,
      agentId: row.agent_slug,
      llmProvider: row.llm_provider,
      llmModel: row.llm_model,
      displayName: row.display_name || undefined,
      temperature: undefined, // Not in new schema
      maxTokens: undefined, // Not in new schema
      isDefault: row.is_default,
      isActive: true, // All fetched rows are active
    };
  }

  /**
   * Get all active content types
   */
  async getContentTypes(): Promise<ContentTypeDto[]> {
    try {
      const rows = await this.marketingDb.queryAll<DbContentType>(
        'SELECT * FROM content_types ORDER BY name',
      );
      return rows.map((row) => this.toContentTypeDto(row));
    } catch (error) {
      this.logger.error('Failed to fetch content types', error);
      throw new Error(
        `Failed to fetch content types: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get a single content type by slug
   */
  async getContentTypeBySlug(slug: string): Promise<ContentTypeDto> {
    try {
      const row = await this.marketingDb.queryOne<DbContentType>(
        'SELECT * FROM content_types WHERE slug = $1',
        [slug],
      );

      if (!row) {
        throw new NotFoundException(`Content type '${slug}' not found`);
      }

      return this.toContentTypeDto(row);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch content type ${slug}`, error);
      throw error;
    }
  }

  /**
   * Get all active marketing agents
   */
  async getAgents(): Promise<MarketingAgentDto[]> {
    try {
      const rows = await this.marketingDb.queryAll<DbMarketingAgent>(
        'SELECT * FROM agents WHERE is_active = true ORDER BY role, name',
      );
      return rows.map((row) => this.toAgentDto(row));
    } catch (error) {
      this.logger.error('Failed to fetch marketing agents', error);
      throw new Error(
        `Failed to fetch marketing agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get agents by role
   */
  async getAgentsByRole(
    role: 'writer' | 'editor' | 'evaluator',
  ): Promise<MarketingAgentDto[]> {
    try {
      const rows = await this.marketingDb.queryAll<DbMarketingAgent>(
        'SELECT * FROM agents WHERE role = $1 AND is_active = true ORDER BY name',
        [role],
      );
      return rows.map((row) => this.toAgentDto(row));
    } catch (error) {
      this.logger.error(`Failed to fetch ${role} agents`, error);
      throw new Error(
        `Failed to fetch ${role} agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get a single agent by slug
   */
  async getAgentBySlug(slug: string): Promise<MarketingAgentDto> {
    try {
      const row = await this.marketingDb.queryOne<DbMarketingAgent>(
        'SELECT * FROM agents WHERE slug = $1',
        [slug],
      );

      if (!row) {
        throw new NotFoundException(`Marketing agent '${slug}' not found`);
      }

      return this.toAgentDto(row);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch agent ${slug}`, error);
      throw error;
    }
  }

  /**
   * Get all LLM configs for an agent
   */
  async getLLMConfigsForAgent(agentSlug: string): Promise<AgentLLMConfigDto[]> {
    try {
      const rows = await this.marketingDb.queryAll<DbAgentLLMConfig>(
        `SELECT * FROM agent_llm_configs
         WHERE agent_slug = $1
         ORDER BY is_default DESC, display_name`,
        [agentSlug],
      );
      return rows.map((row) => this.toLLMConfigDto(row));
    } catch (error) {
      this.logger.error(
        `Failed to fetch LLM configs for agent ${agentSlug}`,
        error,
      );
      throw new Error(
        `Failed to fetch LLM configs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all active LLM configs
   */
  async getAllLLMConfigs(): Promise<AgentLLMConfigDto[]> {
    try {
      const rows = await this.marketingDb.queryAll<DbAgentLLMConfig>(
        `SELECT * FROM agent_llm_configs
         ORDER BY agent_slug, is_default DESC`,
      );
      return rows.map((row) => this.toLLMConfigDto(row));
    } catch (error) {
      this.logger.error('Failed to fetch LLM configs', error);
      throw new Error(
        `Failed to fetch LLM configs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get agents with their LLM configs embedded
   */
  async getAgentsWithConfigs(): Promise<MarketingAgentWithConfigsDto[]> {
    const agents = await this.getAgents();
    const allConfigs = await this.getAllLLMConfigs();

    return agents.map((agent) => ({
      ...agent,
      llmConfigs: allConfigs.filter((config) => config.agentId === agent.slug),
    }));
  }

  /**
   * Get agents by role with their LLM configs embedded
   */
  async getAgentsByRoleWithConfigs(
    role: 'writer' | 'editor' | 'evaluator',
  ): Promise<MarketingAgentWithConfigsDto[]> {
    const agents = await this.getAgentsByRole(role);
    const agentSlugs = agents.map((a) => a.slug);

    if (agentSlugs.length === 0) {
      return [];
    }

    try {
      // Use parameterized query with ANY for array matching
      const rows = await this.marketingDb.queryAll<DbAgentLLMConfig>(
        `SELECT * FROM agent_llm_configs
         WHERE agent_slug = ANY($1)
         ORDER BY is_default DESC`,
        [agentSlugs],
      );

      const configs = rows.map((row) => this.toLLMConfigDto(row));

      return agents.map((agent) => ({
        ...agent,
        llmConfigs: configs.filter((config) => config.agentId === agent.slug),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to fetch LLM configs for ${role} agents`,
        error,
      );
      throw new Error(
        `Failed to fetch LLM configs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get full configuration for the swarm UI
   * Returns content types, agents grouped by role, each with their LLM configs
   */
  async getSwarmConfiguration(): Promise<{
    contentTypes: ContentTypeDto[];
    writers: MarketingAgentWithConfigsDto[];
    editors: MarketingAgentWithConfigsDto[];
    evaluators: MarketingAgentWithConfigsDto[];
  }> {
    const [contentTypes, writers, editors, evaluators] = await Promise.all([
      this.getContentTypes(),
      this.getAgentsByRoleWithConfigs('writer'),
      this.getAgentsByRoleWithConfigs('editor'),
      this.getAgentsByRoleWithConfigs('evaluator'),
    ]);

    return {
      contentTypes,
      writers,
      editors,
      evaluators,
    };
  }
}
