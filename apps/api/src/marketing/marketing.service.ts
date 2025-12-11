import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ContentTypeDto,
  MarketingAgentDto,
  AgentLLMConfigDto,
  MarketingAgentWithConfigsDto,
} from './dto';

// Database row interfaces (snake_case)
interface DbContentType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  system_prompt_template: string | null;
  required_fields: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbMarketingAgent {
  id: string;
  slug: string;
  name: string;
  role: 'writer' | 'editor' | 'evaluator';
  description: string | null;
  system_prompt: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbAgentLLMConfig {
  id: string;
  agent_id: string;
  llm_provider: string;
  llm_model: string;
  display_name: string | null;
  temperature: number | null;
  max_tokens: number | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Convert database content type row to DTO
   */
  private toContentTypeDto(row: DbContentType): ContentTypeDto {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description || undefined,
      systemPromptTemplate: row.system_prompt_template || undefined,
      requiredFields: row.required_fields || undefined,
      isActive: row.is_active,
    };
  }

  /**
   * Convert database agent row to DTO
   */
  private toAgentDto(row: DbMarketingAgent): MarketingAgentDto {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      role: row.role,
      description: row.description || undefined,
      systemPrompt: row.system_prompt || undefined,
      isActive: row.is_active,
    };
  }

  /**
   * Convert database LLM config row to DTO
   */
  private toLLMConfigDto(row: DbAgentLLMConfig): AgentLLMConfigDto {
    return {
      id: row.id,
      agentId: row.agent_id,
      llmProvider: row.llm_provider,
      llmModel: row.llm_model,
      displayName: row.display_name || undefined,
      temperature: row.temperature || undefined,
      maxTokens: row.max_tokens || undefined,
      isDefault: row.is_default,
      isActive: row.is_active,
    };
  }

  /**
   * Get all active content types
   */
  async getContentTypes(): Promise<ContentTypeDto[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .schema('marketing')
      .from('content_types')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      this.logger.error('Failed to fetch content types', error);
      throw new Error(`Failed to fetch content types: ${error.message}`);
    }

    return (data as DbContentType[]).map((row) => this.toContentTypeDto(row));
  }

  /**
   * Get a single content type by slug
   */
  async getContentTypeBySlug(slug: string): Promise<ContentTypeDto> {
    const client = this.supabaseService.getServiceClient();

    const result = await client
      .schema('marketing')
      .from('content_types')
      .select('*')
      .eq('slug', slug)
      .single();

    if (result.error || !result.data) {
      throw new NotFoundException(`Content type '${slug}' not found`);
    }

    return this.toContentTypeDto(result.data as DbContentType);
  }

  /**
   * Get all active marketing agents
   */
  async getAgents(): Promise<MarketingAgentDto[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .schema('marketing')
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .order('role')
      .order('name');

    if (error) {
      this.logger.error('Failed to fetch marketing agents', error);
      throw new Error(`Failed to fetch marketing agents: ${error.message}`);
    }

    return (data as DbMarketingAgent[]).map((row) => this.toAgentDto(row));
  }

  /**
   * Get agents by role
   */
  async getAgentsByRole(
    role: 'writer' | 'editor' | 'evaluator',
  ): Promise<MarketingAgentDto[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .schema('marketing')
      .from('agents')
      .select('*')
      .eq('role', role)
      .eq('is_active', true)
      .order('name');

    if (error) {
      this.logger.error(`Failed to fetch ${role} agents`, error);
      throw new Error(`Failed to fetch ${role} agents: ${error.message}`);
    }

    return (data as DbMarketingAgent[]).map((row) => this.toAgentDto(row));
  }

  /**
   * Get a single agent by slug
   */
  async getAgentBySlug(slug: string): Promise<MarketingAgentDto> {
    const client = this.supabaseService.getServiceClient();

    const result = await client
      .schema('marketing')
      .from('agents')
      .select('*')
      .eq('slug', slug)
      .single();

    if (result.error || !result.data) {
      throw new NotFoundException(`Marketing agent '${slug}' not found`);
    }

    return this.toAgentDto(result.data as DbMarketingAgent);
  }

  /**
   * Get all LLM configs for an agent
   */
  async getLLMConfigsForAgent(agentId: string): Promise<AgentLLMConfigDto[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .schema('marketing')
      .from('agent_llm_configs')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('display_name');

    if (error) {
      this.logger.error(
        `Failed to fetch LLM configs for agent ${agentId}`,
        error,
      );
      throw new Error(`Failed to fetch LLM configs: ${error.message}`);
    }

    return (data as DbAgentLLMConfig[]).map((row) => this.toLLMConfigDto(row));
  }

  /**
   * Get all active LLM configs
   */
  async getAllLLMConfigs(): Promise<AgentLLMConfigDto[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .schema('marketing')
      .from('agent_llm_configs')
      .select('*')
      .eq('is_active', true)
      .order('agent_id')
      .order('is_default', { ascending: false });

    if (error) {
      this.logger.error('Failed to fetch LLM configs', error);
      throw new Error(`Failed to fetch LLM configs: ${error.message}`);
    }

    return (data as DbAgentLLMConfig[]).map((row) => this.toLLMConfigDto(row));
  }

  /**
   * Get agents with their LLM configs embedded
   */
  async getAgentsWithConfigs(): Promise<MarketingAgentWithConfigsDto[]> {
    const agents = await this.getAgents();
    const allConfigs = await this.getAllLLMConfigs();

    return agents.map((agent) => ({
      ...agent,
      llmConfigs: allConfigs.filter((config) => config.agentId === agent.id),
    }));
  }

  /**
   * Get agents by role with their LLM configs embedded
   */
  async getAgentsByRoleWithConfigs(
    role: 'writer' | 'editor' | 'evaluator',
  ): Promise<MarketingAgentWithConfigsDto[]> {
    const agents = await this.getAgentsByRole(role);
    const agentIds = agents.map((a) => a.id);

    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .schema('marketing')
      .from('agent_llm_configs')
      .select('*')
      .in('agent_id', agentIds)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch LLM configs for ${role} agents`,
        error,
      );
      throw new Error(`Failed to fetch LLM configs: ${error.message}`);
    }

    const configs = (data as DbAgentLLMConfig[]).map((row) =>
      this.toLLMConfigDto(row),
    );

    return agents.map((agent) => ({
      ...agent,
      llmConfigs: configs.filter((config) => config.agentId === agent.id),
    }));
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
