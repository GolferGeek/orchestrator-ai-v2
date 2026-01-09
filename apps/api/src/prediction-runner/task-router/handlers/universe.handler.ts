/**
 * Universe Dashboard Handler
 *
 * Handles dashboard mode requests for prediction universes.
 * Universes group targets by organization, domain, and strategy.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { UniverseService } from '../../services/universe.service';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
  buildPaginationMetadata,
} from '../dashboard-handler.interface';
import { CreateUniverseDto, UpdateUniverseDto } from '../../dto/universe.dto';

interface UniverseFilters {
  domain?: string;
  isActive?: boolean;
}

interface UniverseParams {
  id?: string;
  filters?: UniverseFilters;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class UniverseHandler implements IDashboardHandler {
  private readonly logger = new Logger(UniverseHandler.name);
  private readonly supportedActions = [
    'list',
    'get',
    'create',
    'update',
    'delete',
  ];

  constructor(private readonly universeService: UniverseService) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(
      `[UNIVERSE-HANDLER] Executing action: ${action} for org: ${context.orgSlug}`,
    );

    const params = payload.params as UniverseParams | undefined;

    switch (action.toLowerCase()) {
      case 'list':
        return this.handleList(context, params);
      case 'get':
        return this.handleGet(params);
      case 'create':
        return this.handleCreate(context, payload);
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
    context: ExecutionContext,
    params?: UniverseParams,
  ): Promise<DashboardActionResult> {
    try {
      const universes = await this.universeService.findAll(context.orgSlug);

      // Apply filters if provided
      let filtered = universes;
      if (params?.filters?.domain) {
        filtered = filtered.filter((u) => u.domain === params.filters!.domain);
      }

      // Simple pagination
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 20;
      const startIndex = (page - 1) * pageSize;
      const paginatedUniverses = filtered.slice(
        startIndex,
        startIndex + pageSize,
      );

      return buildDashboardSuccess(
        paginatedUniverses,
        buildPaginationMetadata(filtered.length, page, pageSize),
      );
    } catch (error) {
      this.logger.error(
        `Failed to list universes: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'LIST_FAILED',
        error instanceof Error ? error.message : 'Failed to list universes',
      );
    }
  }

  private async handleGet(
    params?: UniverseParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Universe ID is required');
    }

    try {
      const universe = await this.universeService.findById(params.id);
      if (!universe) {
        return buildDashboardError(
          'NOT_FOUND',
          `Universe not found: ${params.id}`,
        );
      }

      return buildDashboardSuccess(universe);
    } catch (error) {
      this.logger.error(
        `Failed to get universe: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'GET_FAILED',
        error instanceof Error ? error.message : 'Failed to get universe',
      );
    }
  }

  private async handleCreate(
    context: ExecutionContext,
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const data = payload.params as Partial<CreateUniverseDto>;

    if (!data.name || !data.domain) {
      return buildDashboardError(
        'INVALID_DATA',
        'Name and domain are required',
      );
    }

    try {
      const createDto: CreateUniverseDto = {
        name: data.name,
        domain: data.domain,
        organization_slug: context.orgSlug,
        agent_slug: data.agent_slug || context.agentSlug || 'prediction-runner',
        description: data.description,
        strategy_id: data.strategy_id,
        is_active: data.is_active ?? true,
        thresholds: data.thresholds,
        llm_config: data.llm_config,
        notification_config: data.notification_config,
      };

      const universe = await this.universeService.create(createDto);
      return buildDashboardSuccess(universe);
    } catch (error) {
      this.logger.error(
        `Failed to create universe: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'CREATE_FAILED',
        error instanceof Error ? error.message : 'Failed to create universe',
      );
    }
  }

  private async handleUpdate(
    params: UniverseParams | undefined,
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Universe ID is required');
    }

    const data = payload.params as Partial<UpdateUniverseDto>;

    try {
      const updateDto: UpdateUniverseDto = {};

      // Only include fields that are explicitly provided
      if (data.name !== undefined) updateDto.name = data.name;
      if (data.description !== undefined)
        updateDto.description = data.description;
      if (data.domain !== undefined) updateDto.domain = data.domain;
      if (data.strategy_id !== undefined)
        updateDto.strategy_id = data.strategy_id;
      if (data.is_active !== undefined) updateDto.is_active = data.is_active;
      if (data.thresholds !== undefined) updateDto.thresholds = data.thresholds;
      if (data.llm_config !== undefined) updateDto.llm_config = data.llm_config;
      if (data.notification_config !== undefined)
        updateDto.notification_config = data.notification_config;

      const universe = await this.universeService.update(params.id, updateDto);
      return buildDashboardSuccess(universe);
    } catch (error) {
      this.logger.error(
        `Failed to update universe: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'UPDATE_FAILED',
        error instanceof Error ? error.message : 'Failed to update universe',
      );
    }
  }

  private async handleDelete(
    params?: UniverseParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Universe ID is required');
    }

    try {
      await this.universeService.delete(params.id);
      return buildDashboardSuccess({ deleted: true, id: params.id });
    } catch (error) {
      this.logger.error(
        `Failed to delete universe: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'DELETE_FAILED',
        error instanceof Error ? error.message : 'Failed to delete universe',
      );
    }
  }
}
