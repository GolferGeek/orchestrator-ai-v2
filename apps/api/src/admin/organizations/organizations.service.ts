import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { getTableName } from '@/supabase/supabase.config';

export interface Organization {
  slug: string;
  name: string;
  description?: string;
  url?: string;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationDto {
  slug: string;
  name: string;
  description?: string;
  url?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateOrganizationDto {
  name?: string;
  description?: string;
  url?: string;
  settings?: Record<string, unknown>;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get all organizations
   */
  async findAll(): Promise<Organization[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from(getTableName('organizations'))
      .select('*')
      .order('name');

    if (error) {
      this.logger.error(`Failed to fetch organizations: ${error.message}`);
      throw new HttpException(
        `Failed to fetch organizations: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return (data || []) as Organization[];
  }

  /**
   * Get a single organization by slug
   */
  async findOne(slug: string): Promise<Organization | null> {
    const client = this.supabaseService.getServiceClient();

    const result = await client
      .from(getTableName('organizations'))
      .select('*')
      .eq('slug', slug)
      .single();

    const data = result.data as Organization | null;
    const error = result.error as { code?: string; message?: string } | null;

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      this.logger.error(`Failed to fetch organization: ${error.message}`);
      throw new HttpException(
        `Failed to fetch organization: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data as Organization;
  }

  /**
   * Create a new organization
   */
  async create(dto: CreateOrganizationDto): Promise<Organization> {
    const client = this.supabaseService.getServiceClient();

    // Check if slug already exists
    const existing = await this.findOne(dto.slug);
    if (existing) {
      throw new HttpException(
        `Organization with slug '${dto.slug}' already exists`,
        HttpStatus.CONFLICT,
      );
    }

    const createResult = await client
      .from(getTableName('organizations'))
      .insert({
        slug: dto.slug,
        name: dto.name,
        description: dto.description || null,
        url: dto.url || null,
        settings: dto.settings || {},
      })
      .select()
      .single();

    const createData = createResult.data as Organization | null;
    const createError = createResult.error as { message?: string } | null;

    if (createError) {
      this.logger.error(
        `Failed to create organization: ${createError.message}`,
      );
      throw new HttpException(
        `Failed to create organization: ${createError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`Created organization: ${dto.slug}`);
    return createData as Organization;
  }

  /**
   * Update an organization
   */
  async update(
    slug: string,
    dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    const client = this.supabaseService.getServiceClient();

    // Check if organization exists
    const existing = await this.findOne(slug);
    if (!existing) {
      throw new HttpException(
        `Organization '${slug}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.url !== undefined) updateData.url = dto.url;
    if (dto.settings !== undefined) updateData.settings = dto.settings;

    const updateResult = await client
      .from(getTableName('organizations'))
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single();

    const updatedData = updateResult.data as Organization | null;
    const updateError = updateResult.error as { message?: string } | null;

    if (updateError) {
      this.logger.error(
        `Failed to update organization: ${updateError.message}`,
      );
      throw new HttpException(
        `Failed to update organization: ${updateError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`Updated organization: ${slug}`);
    return updatedData as Organization;
  }

  /**
   * Delete an organization
   */
  async delete(slug: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    // Check if organization exists
    const existing = await this.findOne(slug);
    if (!existing) {
      throw new HttpException(
        `Organization '${slug}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if there are agents using this organization
    const { data: agents, error: agentsError } = await client
      .from(getTableName('agents'))
      .select('slug')
      .contains('organization_slug', [slug])
      .limit(1);

    if (agentsError) {
      this.logger.error(`Failed to check agents: ${agentsError.message}`);
    } else if (agents && agents.length > 0) {
      throw new HttpException(
        `Cannot delete organization '${slug}' because it has agents assigned to it`,
        HttpStatus.CONFLICT,
      );
    }

    const { error } = await client
      .from(getTableName('organizations'))
      .delete()
      .eq('slug', slug);

    if (error) {
      this.logger.error(`Failed to delete organization: ${error.message}`);
      throw new HttpException(
        `Failed to delete organization: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`Deleted organization: ${slug}`);
  }

  /**
   * Get organization statistics
   */
  async getStats(): Promise<{ total: number }> {
    const client = this.supabaseService.getServiceClient();

    const { count, error } = await client
      .from(getTableName('organizations'))
      .select('*', { count: 'exact', head: true });

    if (error) {
      this.logger.error(`Failed to get organization stats: ${error.message}`);
      return { total: 0 };
    }

    return { total: count || 0 };
  }
}
