import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';

// Types based on finance schema
export interface Universe {
  id: string;
  org_slug: string;
  slug: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface UniverseVersion {
  id: string;
  universe_id: string;
  version: number;
  is_active: boolean;
  config_json: Record<string, unknown>;
  created_at: string;
}

export interface Recommendation {
  id: string;
  run_id: string;
  instrument: string;
  action: string;
  timing_window: string;
  entry_style?: string;
  intended_price?: number;
  sizing_json?: Record<string, unknown>;
  rationale?: string;
  model_metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RecommendationOutcome {
  id: string;
  recommendation_id: string;
  realized_return_metrics_json?: Record<string, unknown>;
  win_loss?: string;
  evaluation_notes?: string;
  evaluated_at?: string;
  created_at: string;
}

export interface CreateUniverseParams {
  org_slug: string;
  slug: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
}

export interface UpdateUniverseParams {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateUniverseVersionParams {
  universe_id: string;
  version?: number;
  is_active?: boolean;
  config_json: Record<string, unknown>;
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private readonly FINANCE_ORG = 'finance';

  constructor(private readonly supabaseService: SupabaseService) {}

  // =============================================================================
  // UNIVERSES
  // =============================================================================

  /**
   * Create a new universe
   */
  async createUniverse(params: CreateUniverseParams): Promise<Universe> {
    const client = this.supabaseService.getServiceClient();

    // Enforce org_slug = 'finance'
    if (params.org_slug !== this.FINANCE_ORG) {
      throw new HttpException(
        `Finance module is restricted to org '${this.FINANCE_ORG}'`,
        HttpStatus.FORBIDDEN,
      );
    }

    // Verify organization exists
    const { data: orgData, error: orgError } = await client
      .from('organizations')
      .select('slug')
      .eq('slug', this.FINANCE_ORG)
      .single();

    if (orgError || !orgData) {
      this.logger.error(
        `Organization not found: ${this.FINANCE_ORG}`,
        orgError?.message,
      );
      throw new HttpException(
        `Organization '${this.FINANCE_ORG}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const insertData: Record<string, unknown> = {
      org_slug: this.FINANCE_ORG,
      slug: params.slug,
      name: params.name,
      description: params.description || null,
    };

    if (params.created_by) {
      insertData.created_by = params.created_by;
    }

    const result = await client
      .schema('finance')
      .from('universes')
      .insert(insertData)
      .select()
      .single();

    const data = result.data as Universe | null;
    const error = result.error as { message?: string } | null;

    if (error || !data) {
      this.logger.error(
        `Failed to create universe: ${error?.message || 'No data returned'}`,
      );
      throw new HttpException(
        `Failed to create universe: ${error?.message || 'No data returned'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`Created finance universe: ${data.id}`);
    return data;
  }

  /**
   * List all universes for org 'finance'
   */
  async listUniverses(): Promise<Universe[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .schema('finance')
      .from('universes')
      .select('*')
      .eq('org_slug', this.FINANCE_ORG)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list universes: ${error.message}`);
      throw new HttpException(
        `Failed to list universes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return (data || []) as Universe[];
  }

  /**
   * Get a single universe by ID
   */
  async getUniverse(id: string): Promise<Universe | null> {
    const client = this.supabaseService.getServiceClient();

    const result = await client
      .schema('finance')
      .from('universes')
      .select('*')
      .eq('id', id)
      .eq('org_slug', this.FINANCE_ORG)
      .single();

    const data = result.data as Universe | null;
    const error = result.error as { code?: string; message?: string } | null;

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      this.logger.error(`Failed to get universe: ${error.message}`);
      throw new HttpException(
        `Failed to get universe: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data;
  }

  /**
   * Update a universe
   */
  async updateUniverse(
    id: string,
    updates: UpdateUniverseParams,
  ): Promise<Universe> {
    const client = this.supabaseService.getServiceClient();

    // Check if universe exists and belongs to finance org
    const existing = await this.getUniverse(id);
    if (!existing) {
      throw new HttpException(
        `Universe '${id}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;

    const result = await client
      .schema('finance')
      .from('universes')
      .update(updateData)
      .eq('id', id)
      .eq('org_slug', this.FINANCE_ORG)
      .select()
      .single();

    const data = result.data as Universe | null;
    const error = result.error as { message?: string } | null;

    if (error || !data) {
      this.logger.error(
        `Failed to update universe: ${error?.message || 'No data returned'}`,
      );
      throw new HttpException(
        `Failed to update universe: ${error?.message || 'No data returned'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`Updated finance universe: ${id}`);
    return data;
  }

  /**
   * Delete a universe
   */
  async deleteUniverse(id: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    // Check if universe exists and belongs to finance org
    const existing = await this.getUniverse(id);
    if (!existing) {
      throw new HttpException(
        `Universe '${id}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const { error } = await client
      .schema('finance')
      .from('universes')
      .delete()
      .eq('id', id)
      .eq('org_slug', this.FINANCE_ORG);

    if (error) {
      this.logger.error(`Failed to delete universe: ${error.message}`);
      throw new HttpException(
        `Failed to delete universe: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`Deleted finance universe: ${id}`);
  }

  // =============================================================================
  // UNIVERSE VERSIONS
  // =============================================================================

  /**
   * Create a new universe version
   */
  async createUniverseVersion(
    params: CreateUniverseVersionParams,
  ): Promise<UniverseVersion> {
    const client = this.supabaseService.getServiceClient();

    // Verify universe exists
    const universe = await this.getUniverse(params.universe_id);
    if (!universe) {
      throw new HttpException(
        `Universe '${params.universe_id}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // If version not specified, auto-increment
    let version = params.version;
    if (!version) {
      const { data: versions } = await client
        .schema('finance')
        .from('universe_versions')
        .select('version')
        .eq('universe_id', params.universe_id)
        .order('version', { ascending: false })
        .limit(1);

      version =
        versions && versions.length > 0
          ? (versions[0] as { version: number }).version + 1
          : 1;
    }

    // If is_active is true, deactivate other versions
    if (params.is_active) {
      await client
        .schema('finance')
        .from('universe_versions')
        .update({ is_active: false })
        .eq('universe_id', params.universe_id);
    }

    const insertData = {
      universe_id: params.universe_id,
      version,
      is_active: params.is_active ?? false,
      config_json: params.config_json,
    };

    const result = await client
      .schema('finance')
      .from('universe_versions')
      .insert(insertData)
      .select()
      .single();

    const data = result.data as UniverseVersion | null;
    const error = result.error as { message?: string } | null;

    if (error || !data) {
      this.logger.error(
        `Failed to create universe version: ${error?.message || 'No data returned'}`,
      );
      throw new HttpException(
        `Failed to create universe version: ${error?.message || 'No data returned'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(
      `Created universe version: ${data.id} (v${version} for universe ${params.universe_id})`,
    );
    return data;
  }

  /**
   * Set active version for a universe
   */
  async setActiveVersion(
    universeId: string,
    versionId: string,
  ): Promise<UniverseVersion> {
    const client = this.supabaseService.getServiceClient();

    // Verify universe exists
    const universe = await this.getUniverse(universeId);
    if (!universe) {
      throw new HttpException(
        `Universe '${universeId}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Verify version exists and belongs to universe
    const versionResult = await client
      .schema('finance')
      .from('universe_versions')
      .select('*')
      .eq('id', versionId)
      .eq('universe_id', universeId)
      .single();

    if (versionResult.error || !versionResult.data) {
      throw new HttpException(
        `Universe version '${versionId}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Deactivate all versions for this universe
    await client
      .schema('finance')
      .from('universe_versions')
      .update({ is_active: false })
      .eq('universe_id', universeId);

    // Activate the specified version
    const result = await client
      .schema('finance')
      .from('universe_versions')
      .update({ is_active: true })
      .eq('id', versionId)
      .select()
      .single();

    const data = result.data as UniverseVersion | null;
    const error = result.error as { message?: string } | null;

    if (error || !data) {
      this.logger.error(
        `Failed to set active version: ${error?.message || 'No data returned'}`,
      );
      throw new HttpException(
        `Failed to set active version: ${error?.message || 'No data returned'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(
      `Set active version: ${versionId} for universe ${universeId}`,
    );
    return data;
  }

  // =============================================================================
  // RECOMMENDATIONS
  // =============================================================================

  /**
   * List recommendations for a universe
   */
  async listRecommendations(universeId: string): Promise<Recommendation[]> {
    const client = this.supabaseService.getServiceClient();

    // Verify universe exists
    const universe = await this.getUniverse(universeId);
    if (!universe) {
      throw new HttpException(
        `Universe '${universeId}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Get recommendations via joins
    const { data, error } = await client
      .schema('finance')
      .from('recommendations')
      .select(
        `
        *,
        recommendation_runs!inner (
          universe_versions!inner (
            universe_id
          )
        )
      `,
      )
      .eq('recommendation_runs.universe_versions.universe_id', universeId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list recommendations: ${error.message}`);
      throw new HttpException(
        `Failed to list recommendations: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return (data || []) as Recommendation[];
  }

  /**
   * Get recommendation outcome
   */
  async getRecommendationOutcome(
    universeId: string,
    recommendationId: string,
  ): Promise<RecommendationOutcome | null> {
    const client = this.supabaseService.getServiceClient();

    // Verify universe exists
    const universe = await this.getUniverse(universeId);
    if (!universe) {
      throw new HttpException(
        `Universe '${universeId}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const result = await client
      .schema('finance')
      .from('recommendation_outcomes')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .single();

    const data = result.data as RecommendationOutcome | null;
    const error = result.error as { code?: string; message?: string } | null;

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      this.logger.error(
        `Failed to get recommendation outcome: ${error.message}`,
      );
      throw new HttpException(
        `Failed to get recommendation outcome: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data;
  }
}
