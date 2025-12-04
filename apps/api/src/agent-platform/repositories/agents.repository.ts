import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  AgentRecord,
  AgentUpsertInput,
  AgentUpsertRow,
} from '../interfaces/agent.interface';

type SupabaseError = { message: string; code?: string } | null;

type SupabaseSelectResponse<T> = {
  data: T | null;
  error: SupabaseError;
};

type SupabaseSelectListResponse<T> = {
  data: T[] | null;
  error: SupabaseError;
};

const AGENTS_TABLE = 'agents';

@Injectable()
export class AgentsRepository {
  private readonly logger = new Logger(AgentsRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  async upsert(payload: AgentUpsertInput): Promise<AgentRecord> {
    const client = this.getClient();
    const row: AgentUpsertRow = {
      slug: payload.slug,
      organization_slug: payload.organization_slug ?? ['demo-org'],
      name: payload.name,
      description: payload.description,
      version: payload.version ?? '1.0.0',
      agent_type: payload.agent_type,
      department: payload.department,
      tags: payload.tags ?? [],
      io_schema: payload.io_schema,
      capabilities: payload.capabilities,
      context: payload.context,
      endpoint: payload.endpoint ?? null,
      llm_config: payload.llm_config ?? null,
      metadata: payload.metadata ?? {},
      updated_at: new Date().toISOString(),
    };

    const rows = [row];

    const { data, error } = (await client
      .from(AGENTS_TABLE)
      .upsert(rows, { onConflict: 'slug' })
      .select()
      .maybeSingle()) as SupabaseSelectResponse<AgentRecord>;

    if (error) {
      this.logger.error(
        `Failed to upsert agent ${payload.slug}: ${error.message}`,
      );
      throw new Error(`Failed to upsert agent: ${error.message}`);
    }

    if (!data) {
      throw new Error('Upsert succeeded but no agent returned');
    }

    return data;
  }

  async findBySlug(
    organizationSlug: string | null,
    agentSlug: string,
  ): Promise<AgentRecord | null> {
    const client = this.getClient();
    let query = client
      .from(AGENTS_TABLE)
      .select('*')
      .eq('slug', agentSlug)
      .limit(1);

    // Filter by organization using array contains operator
    if (organizationSlug) {
      query = query.contains('organization_slug', [organizationSlug]);
    }

    const { data, error } =
      (await query.maybeSingle()) as SupabaseSelectResponse<AgentRecord>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to load agent ${agentSlug}: ${error.message}`);
      throw new Error(`Failed to load agent: ${error.message}`);
    }

    return data;
  }

  async listByOrganization(
    organizationSlug: string | null,
  ): Promise<AgentRecord[]> {
    const client = this.getClient();
    let query = client.from(AGENTS_TABLE).select('*');

    // Filter by organization using array contains operator
    if (organizationSlug) {
      // Query for agents that belong to this specific organization
      query = query.contains('organization_slug', [organizationSlug]);
    } else {
      // Query for truly global agents (organization_slug is empty array or contains only null)
      // Use 'or' to match either empty array or array with single null value
      query = query.or('organization_slug.eq.{},organization_slug.eq.{null}');
    }

    const { data, error } = (await query.order('slug', {
      ascending: true,
    })) as SupabaseSelectListResponse<AgentRecord>;

    if (error) {
      this.logger.error(
        `Failed to list agents for ${organizationSlug ?? 'all'}: ${error.message}`,
      );
      throw new Error(`Failed to list agents: ${error.message}`);
    }

    return data ?? [];
  }

  async listAll(): Promise<AgentRecord[]> {
    const client = this.getClient();
    const { data, error } = (await client
      .from(AGENTS_TABLE)
      .select('*')
      .order('slug', {
        ascending: true,
      })) as SupabaseSelectListResponse<AgentRecord>;

    if (error) {
      this.logger.error(`Failed to list all agents: ${error.message}`);
      throw new Error(`Failed to list agents: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Returns the most recent updated_at timestamp across all agents.
   * Useful for cache invalidation polling.
   */
  async getLatestUpdatedAt(): Promise<string | null> {
    const client = this.getClient();
    const { data, error } = (await client
      .from(AGENTS_TABLE)
      .select('updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()) as SupabaseSelectResponse<{ updated_at: string }>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Failed to query latest agent updated_at: ${error.message}`,
      );
      throw new Error(
        `Failed to query latest agent updated_at: ${error.message}`,
      );
    }

    return data?.updated_at ?? null;
  }

  async deleteBySlug(slug: string): Promise<void> {
    const client = this.getClient();
    const { error } = await client.from(AGENTS_TABLE).delete().eq('slug', slug);
    if (error) {
      this.logger.error(`Failed to delete agent ${slug}: ${error.message}`);
      throw new Error(`Failed to delete agent: ${error.message}`);
    }
  }

  async updateMetadata(
    slug: string,
    metadata: Record<string, unknown>,
  ): Promise<AgentRecord> {
    const client = this.getClient();
    const { data, error } = (await client
      .from(AGENTS_TABLE)
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('slug', slug)
      .select()
      .single()) as SupabaseSelectResponse<AgentRecord>;

    if (error) {
      this.logger.error(
        `Failed to update agent ${slug} metadata: ${error.message}`,
      );
      throw new Error(`Failed to update agent metadata: ${error.message}`);
    }

    if (!data) {
      throw new Error('Update succeeded but no agent returned');
    }

    return data;
  }
}
