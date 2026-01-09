/**
 * Analyst Dashboard Handler
 *
 * Handles dashboard mode requests for prediction analysts.
 * Analysts are AI personas that evaluate signals/predictors from different perspectives.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { AnalystService } from '../../services/analyst.service';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
  buildPaginationMetadata,
} from '../dashboard-handler.interface';
import { CreateAnalystDto, UpdateAnalystDto } from '../../dto/analyst.dto';

interface AnalystFilters {
  scopeLevel?: string;
  domain?: string;
  universeId?: string;
  targetId?: string;
  isActive?: boolean;
}

interface AnalystParams {
  id?: string;
  slug?: string;
  filters?: AnalystFilters;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AnalystHandler implements IDashboardHandler {
  private readonly logger = new Logger(AnalystHandler.name);
  private readonly supportedActions = [
    'list',
    'get',
    'create',
    'update',
    'delete',
  ];

  constructor(private readonly analystService: AnalystService) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(
      `[ANALYST-HANDLER] Executing action: ${action} for org: ${context.orgSlug}`,
    );

    const params = payload.params as AnalystParams | undefined;

    switch (action.toLowerCase()) {
      case 'list':
        return this.handleList(params);
      case 'get':
        return this.handleGet(params);
      case 'create':
        return this.handleCreate(payload);
      case 'update':
        return this.handleUpdate(params, payload);
      case 'delete':
        return this.handleDelete(params);
      default:
        return buildDashboardError(
          'UNSUPPORTED_ACTION',
          `Unsupported action: ${action}`,
          { supportedActions: this.supportedActions },
        );
    }
  }

  getSupportedActions(): string[] {
    return this.supportedActions;
  }

  private async handleList(
    params?: AnalystParams,
  ): Promise<DashboardActionResult> {
    try {
      let analysts;

      // Fetch based on scope
      if (params?.filters?.domain) {
        analysts = await this.analystService.findByDomain(
          params.filters.domain,
        );
      } else if (params?.filters?.scopeLevel === 'runner') {
        analysts = await this.analystService.findRunnerLevel();
      } else if (params?.slug) {
        analysts = await this.analystService.findBySlug(
          params.slug,
          params.filters?.scopeLevel,
          params.filters?.domain,
        );
      } else {
        // Default: get system analysts
        analysts = await this.analystService.findRunnerLevel();
      }

      // Apply additional filters
      let filtered = analysts;

      if (params?.filters?.isActive !== undefined) {
        filtered = filtered.filter(
          (a) => a.is_enabled === params.filters!.isActive,
        );
      }

      // Simple pagination
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 20;
      const startIndex = (page - 1) * pageSize;
      const paginatedAnalysts = filtered.slice(
        startIndex,
        startIndex + pageSize,
      );

      return buildDashboardSuccess(
        paginatedAnalysts,
        buildPaginationMetadata(filtered.length, page, pageSize),
      );
    } catch (error) {
      this.logger.error(
        `Failed to list analysts: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'LIST_FAILED',
        error instanceof Error ? error.message : 'Failed to list analysts',
      );
    }
  }

  private async handleGet(
    params?: AnalystParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Analyst ID is required');
    }

    try {
      const analyst = await this.analystService.findById(params.id);
      if (!analyst) {
        return buildDashboardError(
          'NOT_FOUND',
          `Analyst not found: ${params.id}`,
        );
      }

      return buildDashboardSuccess(analyst);
    } catch (error) {
      this.logger.error(
        `Failed to get analyst: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'GET_FAILED',
        error instanceof Error ? error.message : 'Failed to get analyst',
      );
    }
  }

  private async handleCreate(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const data = payload.params as Partial<CreateAnalystDto>;

    if (!data.slug || !data.name || !data.scope_level || !data.perspective) {
      return buildDashboardError(
        'INVALID_DATA',
        'slug, name, scope_level, and perspective are required',
      );
    }

    try {
      const createDto: CreateAnalystDto = {
        slug: data.slug,
        name: data.name,
        scope_level: data.scope_level,
        perspective: data.perspective,
        domain: data.domain,
        universe_id: data.universe_id,
        target_id: data.target_id,
        agent_id: data.agent_id,
        default_weight: data.default_weight ?? 1.0,
        tier_instructions: data.tier_instructions,
        learned_patterns: data.learned_patterns,
        is_enabled: data.is_enabled ?? true,
      };

      const analyst = await this.analystService.create(createDto);
      return buildDashboardSuccess(analyst);
    } catch (error) {
      this.logger.error(
        `Failed to create analyst: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'CREATE_FAILED',
        error instanceof Error ? error.message : 'Failed to create analyst',
      );
    }
  }

  private async handleUpdate(
    params: AnalystParams | undefined,
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Analyst ID is required');
    }

    const data = payload.params as Partial<UpdateAnalystDto>;

    try {
      const updateDto: UpdateAnalystDto = {};

      if (data.name !== undefined) updateDto.name = data.name;
      if (data.perspective !== undefined)
        updateDto.perspective = data.perspective;
      if (data.default_weight !== undefined)
        updateDto.default_weight = data.default_weight;
      if (data.tier_instructions !== undefined)
        updateDto.tier_instructions = data.tier_instructions;
      if (data.learned_patterns !== undefined)
        updateDto.learned_patterns = data.learned_patterns;
      if (data.agent_id !== undefined) updateDto.agent_id = data.agent_id;
      if (data.is_enabled !== undefined) updateDto.is_enabled = data.is_enabled;

      const analyst = await this.analystService.update(params.id, updateDto);
      return buildDashboardSuccess(analyst);
    } catch (error) {
      this.logger.error(
        `Failed to update analyst: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'UPDATE_FAILED',
        error instanceof Error ? error.message : 'Failed to update analyst',
      );
    }
  }

  private async handleDelete(
    params?: AnalystParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Analyst ID is required');
    }

    try {
      await this.analystService.delete(params.id);
      return buildDashboardSuccess({ deleted: true, id: params.id });
    } catch (error) {
      this.logger.error(
        `Failed to delete analyst: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'DELETE_FAILED',
        error instanceof Error ? error.message : 'Failed to delete analyst',
      );
    }
  }
}
