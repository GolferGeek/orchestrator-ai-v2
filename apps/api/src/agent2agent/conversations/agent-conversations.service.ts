import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  AgentConversation,
  AgentConversationWithStats,
  CreateAgentConversationDto,
  AgentConversationQueryParams,
  AgentType,
} from '@/agent2agent/types/agent-conversations.types';
import { getTableName } from '@/supabase/supabase.config';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface AgentConversationDbRecord {
  id: string;
  user_id: string;
  agent_name: string;
  agent_type: string;
  organization_slug?: string | null;
  started_at?: string;
  ended_at?: string;
  last_active_at?: string;
  metadata?: Record<string, unknown>;
  primary_work_product_type?: string;
  primary_work_product_id?: string;
  created_at: string;
  updated_at: string;
}

interface AgentConversationWithStatsDbRecord extends AgentConversationDbRecord {
  task_count: string | number;
  completed_tasks: string | number;
  failed_tasks: string | number;
  active_tasks: string | number;
}

@Injectable()
export class AgentConversationsService {
  private readonly logger = new Logger(AgentConversationsService.name);
  private readonly langgraphBaseUrl: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.langgraphBaseUrl =
      this.configService.get<string>('LANGGRAPH_BASE_URL') ||
      'http://localhost:6200';
  }

  /**
   * Validate agent type matches database constraints
   */
  private validateAgentType(agentType: string): AgentType {
    // Ensure the type is one of the allowed values
    // Note: langgraph and risk agents don't use conversations (they use workflows/dashboards)
    const validTypes: AgentType[] = [
      'context',
      'api',
      'external',
      'orchestrator',
      'media',
      'rag-runner',
      'prediction',
    ];
    // Allow file-based types
    if (validTypes.includes(agentType)) {
      return agentType;
    }

    // Allow organization slugs (contain hyphens, underscores, or end with -org)
    if (
      agentType.includes('-') ||
      agentType.includes('_') ||
      agentType.endsWith('org')
    ) {
      return agentType;
    }

    // NO FALLBACKS - fail fast with clear error instead of defaulting
    throw new Error(
      `Invalid agentType '${agentType}'. ` +
        `Must be a valid file-based type (${validTypes.join(', ')}) ` +
        `or an organization slug (e.g., 'my-org', 'company-name'). ` +
        `No default agentType is provided - explicit configuration required.`,
    );
  }

  /**
   * Create a new agent conversation
   */
  async createConversation(
    userId: string,
    dto: CreateAgentConversationDto,
  ): Promise<AgentConversation> {
    const validatedAgentType = this.validateAgentType(dto.agentType);

    const now = new Date().toISOString();
    const result = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .insert({
        user_id: userId,
        agent_name: dto.agentName,
        agent_type: validatedAgentType,
        organization_slug: dto.organization || null, // Store organization slug for database agents
        started_at: now,
        last_active_at: now,
        metadata: dto.metadata || {},
        ...(dto.workProduct && {
          primary_work_product_type: dto.workProduct.type,
          primary_work_product_id: dto.workProduct.id,
        }),
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create conversation: ${result.error.message}`);
    }

    return this.mapToAgentConversation(
      result.data as AgentConversationDbRecord,
    );
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(
    conversationId: string,
    userId: string,
  ): Promise<AgentConversation | null> {
    const result = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .select()
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (result.error && result.error.code !== 'PGRST116') {
      // PGRST116 is "no rows found"
      throw new Error(`Failed to fetch conversation: ${result.error.message}`);
    }

    return result.data
      ? this.mapToAgentConversation(result.data as AgentConversationDbRecord)
      : null;
  }

  /**
   * Get or create a conversation for an agent
   */
  async getOrCreateConversation(
    userId: string,
    agentName: string,
    agentType: AgentType,
    existingConversationId?: string | null,
  ): Promise<AgentConversation> {
    // If a conversation ID was provided, validate it exists and belongs to the user
    if (existingConversationId) {
      const { data: existing }: { data: AgentConversationDbRecord | null } =
        await this.supabaseService
          .getAnonClient()
          .from(getTableName('conversations'))
          .select()
          .eq('id', existingConversationId)
          .eq('user_id', userId)
          .eq('agent_name', agentName)
          .eq('agent_type', agentType)
          .single();

      if (existing) {
        return this.mapToAgentConversation(existing);
      }

      // If provided conversation ID doesn't exist or doesn't match, log warning and create new
    }

    // First try to find an active conversation
    const { data: result } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .select()
      .eq('user_id', userId)
      .eq('agent_name', agentName)
      .eq('agent_type', agentType)
      .is('ended_at', null)
      .order('last_active_at', { ascending: false })
      .limit(1);

    const existing = result as AgentConversationDbRecord[] | null;

    if (existing && existing.length > 0 && existing[0]) {
      return this.mapToAgentConversation(existing[0]);
    }

    // Create new conversation if none exists
    return this.createConversation(userId, {
      agentName,
      agentType,
    });
  }

  /**
   * List conversations with optional filters
   */
  async listConversations(
    params: AgentConversationQueryParams,
  ): Promise<{ conversations: AgentConversationWithStats[]; total: number }> {
    let query = this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations_with_stats'))
      .select('*', { count: 'exact' });

    // Apply filters
    if (params.userId) {
      query = query.eq('user_id', params.userId);
    }
    if (params.agentName) {
      query = query.eq('agent_name', params.agentName);
    }
    if (params.agentType) {
      query = query.eq('agent_type', params.agentType);
    }
    if (params.activeOnly) {
      query = query.is('ended_at', null);
    }

    // Apply pagination
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query
      .order('last_active_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: result, error, count } = await query;

    const data = result as AgentConversationWithStatsDbRecord[] | null;

    if (error) {
      throw new Error(`Failed to list conversations: ${error.message}`);
    }

    return {
      conversations: (data || []).map((item) =>
        this.mapToAgentConversationWithStats(item),
      ),
      total: count || 0,
    };
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string, userId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .update({
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to end conversation: ${error.message}`);
    }
  }

  /**
   * Delete a conversation and all related tasks
   */
  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    // First verify the conversation exists and belongs to the user
    const conversation = await this.getConversationById(conversationId, userId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Check if this is a marketing-swarm conversation and clean up marketing data
    if (conversation.agentName === 'marketing-swarm') {
      await this.cleanupMarketingSwarmData(conversationId);
    }

    // Clean up media assets (images/videos) and their storage files BEFORE deleting conversation
    // This ensures storage files don't become orphaned
    await this.cleanupConversationAssets(conversationId);

    // Delete related LLM usage records first to avoid foreign key constraint violation
    const { error: llmUsageDeleteError } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('llm_usage'))
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (llmUsageDeleteError) {
      throw new Error(
        `Failed to delete LLM usage records: ${llmUsageDeleteError.message}`,
      );
    }

    // Delete deliverables (deliverable_versions will cascade delete)
    // UI enforces that deliverables are always deleted with their conversations
    const { error: deliverablesDeleteError } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('deliverables'))
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (deliverablesDeleteError) {
      this.logger.warn(
        `Failed to delete deliverables: ${deliverablesDeleteError.message}`,
      );
      // Don't throw - continue with conversation deletion
    }

    // Delete related tasks (if any)
    const { error: tasksError } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('tasks'))
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (tasksError) {
      throw new Error(
        `Failed to delete conversation tasks: ${tasksError.message}`,
      );
    }

    // Delete the conversation
    const { error } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  }

  /**
   * Clean up marketing swarm data when a marketing-swarm conversation is deleted.
   * Finds the task_id from the conversation and calls the LangGraph delete endpoint.
   */
  private async cleanupMarketingSwarmData(
    conversationId: string,
  ): Promise<void> {
    try {
      // Find the marketing swarm task associated with this conversation
      // The task_id is stored in the marketing.swarm_tasks table
      // We can find it by looking up tasks where task_id matches a task
      // that was created for this conversation (stored in public.tasks)

      // First, get the task from public.tasks that references this conversation
      const { data: tasks, error: tasksError } = await this.supabaseService
        .getServiceClient()
        .from('tasks')
        .select('id')
        .eq('conversation_id', conversationId);

      if (tasksError) {
        this.logger.warn(
          `Failed to lookup tasks for conversation ${conversationId}: ${tasksError.message}`,
        );
        return;
      }

      if (!tasks || tasks.length === 0) {
        this.logger.debug(
          `No tasks found for marketing swarm conversation ${conversationId}`,
        );
        return;
      }

      // For each task, call the LangGraph delete endpoint
      for (const task of tasks) {
        try {
          const deleteUrl = `${this.langgraphBaseUrl}/marketing-swarm/${task.id}`;
          this.logger.log(`Deleting marketing swarm data for task ${task.id}`);

          await firstValueFrom(
            this.httpService.delete(deleteUrl, { timeout: 10000 }),
          );

          this.logger.log(
            `Successfully deleted marketing swarm data for task ${task.id}`,
          );
        } catch (deleteError) {
          // Log but don't throw - we still want to delete the conversation
          this.logger.warn(
            `Failed to delete marketing swarm data for task ${task.id}: ${
              deleteError instanceof Error
                ? deleteError.message
                : 'Unknown error'
            }`,
          );
        }
      }
    } catch (error) {
      // Log but don't throw - we still want to delete the conversation
      this.logger.warn(
        `Failed to cleanup marketing swarm data for conversation ${conversationId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Clean up media assets (images/videos) and their storage files for a conversation.
   * This prevents orphaned storage files when a conversation is deleted.
   */
  private async cleanupConversationAssets(
    conversationId: string,
  ): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();

      // Find all assets linked to this conversation
      const { data: assets, error: fetchError } = await client
        .from(getTableName('assets'))
        .select('id, bucket, object_key')
        .eq('conversation_id', conversationId);

      if (fetchError) {
        this.logger.warn(
          `Failed to fetch assets for conversation ${conversationId}: ${fetchError.message}`,
        );
        return;
      }

      if (!assets || assets.length === 0) {
        this.logger.debug(
          `No assets to clean up for conversation ${conversationId}`,
        );
        return;
      }

      this.logger.log(
        `Cleaning up ${assets.length} asset(s) for conversation ${conversationId}`,
      );

      // Group assets by bucket for efficient deletion
      const assetsByBucket = assets.reduce(
        (acc, asset) => {
          const typedAsset = asset as {
            id: string;
            bucket: string;
            object_key: string;
          };
          const bucket = typedAsset.bucket || 'media';
          if (!acc[bucket]) {
            acc[bucket] = [];
          }
          acc[bucket].push(typedAsset.object_key);
          return acc;
        },
        {} as Record<string, string[]>,
      );

      // Delete storage files from each bucket
      for (const [bucket, objectKeys] of Object.entries(assetsByBucket)) {
        const { error: storageError } = await client.storage
          .from(bucket)
          .remove(objectKeys);

        if (storageError) {
          this.logger.warn(
            `Failed to delete storage files from bucket ${bucket}: ${storageError.message}`,
          );
          // Continue with other buckets even if one fails
        } else {
          this.logger.debug(
            `Deleted ${objectKeys.length} file(s) from bucket ${bucket}`,
          );
        }
      }

      // Delete asset records from database
      const assetIds = assets.map((a) => (a as { id: string }).id);
      const { error: deleteError } = await client
        .from(getTableName('assets'))
        .delete()
        .in('id', assetIds);

      if (deleteError) {
        this.logger.warn(
          `Failed to delete asset records: ${deleteError.message}`,
        );
      } else {
        this.logger.log(
          `Successfully cleaned up ${assets.length} asset(s) for conversation ${conversationId}`,
        );
      }
    } catch (error) {
      // Log but don't throw - we still want to delete the conversation
      this.logger.warn(
        `Failed to cleanup assets for conversation ${conversationId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Update conversation metadata
   */
  async updateConversationMetadata(
    conversationId: string,
    userId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .update({
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(
        `Failed to update conversation metadata: ${error.message}`,
      );
    }
  }

  /**
   * Get active conversations for a user
   */
  async getActiveConversations(userId: string): Promise<AgentConversation[]> {
    const { data: result, error } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .select()
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('last_active_at', { ascending: false });

    const data = result as AgentConversationDbRecord[] | null;

    if (error) {
      throw new Error(`Failed to fetch active conversations: ${error.message}`);
    }

    return (data || []).map((item) => this.mapToAgentConversation(item));
  }

  /**
   * Helper: Find conversation by work product binding
   */
  async findByWorkProduct(
    userId: string,
    workProduct: { type: 'deliverable' | 'project'; id: string },
  ): Promise<AgentConversation | null> {
    const {
      data,
      error,
    }: { data: AgentConversationDbRecord | null; error: unknown } =
      await this.supabaseService
        .getAnonClient()
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('primary_work_product_type', workProduct.type)
        .eq('primary_work_product_id', workProduct.id)
        .limit(1)
        .maybeSingle();

    if (error && (error as { code?: string }).code !== 'PGRST116') {
      throw new Error(
        `Failed to find conversation by work product: ${(error as Error).message}`,
      );
    }

    return data ? this.mapToAgentConversation(data) : null;
  }

  /**
   * Set the primary work product for a conversation exactly once.
   * If already set to a different value, throw (immutability enforcement).
   */
  async setPrimaryWorkProduct(
    conversationId: string,
    userId: string,
    workProduct: { type: 'deliverable' | 'project'; id: string },
  ): Promise<void> {
    const client = this.supabaseService.getAnonClient();

    // Fetch existing values
    const { data: result, error: fetchError } = await client
      .from('conversations')
      .select('id, user_id, primary_work_product_type, primary_work_product_id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    const existing = result as Pick<
      AgentConversationDbRecord,
      'id' | 'user_id' | 'primary_work_product_type' | 'primary_work_product_id'
    > | null;

    if (fetchError || !existing) {
      throw new Error('Conversation not found or access denied');
    }

    const existingType = existing.primary_work_product_type as
      | 'deliverable'
      | 'project'
      | null;
    const existingId = existing.primary_work_product_id as string | null;

    if (
      existingType &&
      existingId &&
      (existingType !== workProduct.type || existingId !== workProduct.id)
    ) {
      throw new Error('Primary work product is immutable once set');
    }

    if (
      existingType === workProduct.type &&
      existingId === workProduct.id &&
      existingType !== null &&
      existingId !== null
    ) {
      return; // no-op
    }

    const { error: updateError } = await client
      .from('conversations')
      .update({
        primary_work_product_type: workProduct.type,
        primary_work_product_id: workProduct.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(
        updateError.message || 'Could not set primary work product',
      );
    }
  }

  /**
   * Map database record to AgentConversation type
   */
  private mapToAgentConversation(
    data: AgentConversationDbRecord,
  ): AgentConversation {
    return {
      id: data.id,
      userId: data.user_id,
      agentName: data.agent_name,
      agentType: data.agent_type,
      organizationSlug: data.organization_slug || null, // Add organization slug
      startedAt: data.started_at
        ? new Date(data.started_at)
        : new Date(data.created_at),
      endedAt: data.ended_at ? new Date(data.ended_at) : undefined,
      lastActiveAt: data.last_active_at
        ? new Date(data.last_active_at)
        : new Date(data.created_at),
      metadata: data.metadata,
      workProduct:
        data.primary_work_product_type === 'deliverable' &&
        data.primary_work_product_id
          ? {
              type: 'deliverable' as const,
              id: data.primary_work_product_id,
            }
          : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Map database record to AgentConversationWithStats type
   */
  private mapToAgentConversationWithStats(
    data: AgentConversationWithStatsDbRecord,
  ): AgentConversationWithStats {
    return {
      ...this.mapToAgentConversation(data),
      taskCount: parseInt(String(data.task_count)) || 0,
      completedTasks: parseInt(String(data.completed_tasks)) || 0,
      failedTasks: parseInt(String(data.failed_tasks)) || 0,
      activeTasks: parseInt(String(data.active_tasks)) || 0,
    };
  }
}
