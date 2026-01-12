/**
 * Target Dashboard Handler
 *
 * Handles dashboard mode requests for prediction targets.
 * Targets are specific assets/symbols within a universe (e.g., AAPL in a stocks universe).
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { TargetService } from '../../services/target.service';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
  buildPaginationMetadata,
} from '../dashboard-handler.interface';
import { CreateTargetDto, UpdateTargetDto } from '../../dto/target.dto';

interface TargetFilters {
  universeId?: string;
  isActive?: boolean;
  targetType?: string;
}

interface TargetParams {
  id?: string;
  universeId?: string;
  filters?: TargetFilters;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class TargetHandler implements IDashboardHandler {
  private readonly logger = new Logger(TargetHandler.name);
  private readonly supportedActions = [
    'list',
    'get',
    'create',
    'update',
    'delete',
  ];

  constructor(private readonly targetService: TargetService) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(
      `[TARGET-HANDLER] Executing action: ${action} for org: ${context.orgSlug}`,
    );

    const params = payload.params as TargetParams | undefined;

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
    params?: TargetParams,
  ): Promise<DashboardActionResult> {
    const universeId = params?.universeId || params?.filters?.universeId;

    if (!universeId) {
      return buildDashboardError(
        'MISSING_UNIVERSE_ID',
        'universeId is required. Call universes.list first to get available universes.',
        {
          hint: 'Use action "universes.list" to get universes for this agent, then pass universeId in params',
        },
      );
    }

    try {
      const targets =
        params?.filters?.isActive === false
          ? await this.targetService.findByUniverse(universeId)
          : await this.targetService.findActiveByUniverse(universeId);

      // Apply type filter if provided
      let filtered = targets;
      if (params?.filters?.targetType) {
        filtered = filtered.filter(
          (t) => t.target_type === params.filters!.targetType,
        );
      }

      // Simple pagination
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 20;
      const startIndex = (page - 1) * pageSize;
      const paginatedTargets = filtered.slice(
        startIndex,
        startIndex + pageSize,
      );

      return buildDashboardSuccess(
        paginatedTargets,
        buildPaginationMetadata(filtered.length, page, pageSize),
      );
    } catch (error) {
      this.logger.error(
        `Failed to list targets: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'LIST_FAILED',
        error instanceof Error ? error.message : 'Failed to list targets',
      );
    }
  }

  private async handleGet(
    params?: TargetParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Target ID is required');
    }

    try {
      const target = await this.targetService.findById(params.id);
      if (!target) {
        return buildDashboardError(
          'NOT_FOUND',
          `Target not found: ${params.id}`,
        );
      }

      // Also get effective LLM config
      const llmConfig = await this.targetService.getEffectiveLlmConfig(target);

      return buildDashboardSuccess({
        ...target,
        effectiveLlmConfig: llmConfig,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get target: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'GET_FAILED',
        error instanceof Error ? error.message : 'Failed to get target',
      );
    }
  }

  private async handleCreate(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const data = payload.params as Partial<CreateTargetDto>;

    if (!data.universe_id || !data.symbol || !data.name || !data.target_type) {
      return buildDashboardError(
        'INVALID_DATA',
        'universe_id, symbol, name, and target_type are required',
      );
    }

    try {
      const createDto: CreateTargetDto = {
        universe_id: data.universe_id,
        symbol: data.symbol,
        name: data.name,
        target_type: data.target_type,
        context: data.context,
        is_active: data.is_active ?? true,
        llm_config_override: data.llm_config_override,
        metadata: data.metadata,
      };

      const target = await this.targetService.create(createDto);
      return buildDashboardSuccess(target);
    } catch (error) {
      this.logger.error(
        `Failed to create target: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'CREATE_FAILED',
        error instanceof Error ? error.message : 'Failed to create target',
      );
    }
  }

  private async handleUpdate(
    params: TargetParams | undefined,
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Target ID is required');
    }

    const data = payload.params as Partial<UpdateTargetDto>;

    try {
      const updateDto: UpdateTargetDto = {};

      // Only include fields that are explicitly provided
      if (data.name !== undefined) updateDto.name = data.name;
      if (data.context !== undefined) updateDto.context = data.context;
      if (data.is_active !== undefined) updateDto.is_active = data.is_active;
      if (data.llm_config_override !== undefined)
        updateDto.llm_config_override = data.llm_config_override;
      if (data.metadata !== undefined) updateDto.metadata = data.metadata;

      const target = await this.targetService.update(params.id, updateDto);
      return buildDashboardSuccess(target);
    } catch (error) {
      this.logger.error(
        `Failed to update target: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'UPDATE_FAILED',
        error instanceof Error ? error.message : 'Failed to update target',
      );
    }
  }

  private async handleDelete(
    params?: TargetParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Target ID is required');
    }

    try {
      await this.targetService.delete(params.id);
      return buildDashboardSuccess({ deleted: true, id: params.id });
    } catch (error) {
      this.logger.error(
        `Failed to delete target: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'DELETE_FAILED',
        error instanceof Error ? error.message : 'Failed to delete target',
      );
    }
  }
}
