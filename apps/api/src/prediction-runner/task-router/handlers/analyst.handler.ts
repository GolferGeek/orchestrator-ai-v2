/**
 * Analyst Dashboard Handler
 *
 * Handles dashboard mode requests for prediction analysts.
 * Analysts are AI personas that evaluate signals/predictors from different perspectives.
 * Supports fork comparison (user vs agent) and adoption workflows.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { AnalystService } from '../../services/analyst.service';
import { PortfolioRepository } from '../../repositories/portfolio.repository';
import type {
  ForkType,
  AnalystContextVersion,
  AnalystPortfolio,
} from '../../interfaces/portfolio.interface';
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
  forkType?: ForkType;
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
    // Fork comparison actions
    'compareForks',
    'forksSummary',
    'getForkHistory',
    'adoptChange',
    'rollback',
  ];

  constructor(
    private readonly analystService: AnalystService,
    private readonly portfolioRepository: PortfolioRepository,
  ) {}

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
      // Fork comparison actions
      case 'compareforks':
        return this.handleCompareForks(params);
      case 'forkssummary':
        return this.handleForksSummary(params);
      case 'getforkhistory':
        return this.handleGetForkHistory(params);
      case 'adoptchange':
        return this.handleAdoptChange(params, payload);
      case 'rollback':
        return this.handleRollback(params, payload);
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

  // =============================================================================
  // FORK COMPARISON ACTIONS
  // =============================================================================

  /**
   * Compare user fork vs agent fork for a specific analyst
   * Returns portfolio performance, context differences, and adoption suggestions
   */
  private async handleCompareForks(
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

      // Get both portfolios
      const userPortfolio = await this.portfolioRepository.getAnalystPortfolio(
        params.id,
        'user',
      );
      const agentPortfolio = await this.portfolioRepository.getAnalystPortfolio(
        params.id,
        'agent',
      );

      // Get current context versions for both forks
      const userContext =
        await this.portfolioRepository.getCurrentAnalystContextVersion(
          params.id,
          'user',
        );
      const agentContext =
        await this.portfolioRepository.getCurrentAnalystContextVersion(
          params.id,
          'agent',
        );

      // Calculate context differences
      const contextDiff = this.calculateContextDiff(userContext, agentContext);

      // Build comparison result
      const comparison = {
        analyst: {
          id: analyst.id,
          slug: analyst.slug,
          name: analyst.name,
          perspective: analyst.perspective,
        },
        userFork: {
          portfolio: userPortfolio,
          currentContext: userContext,
          pnl: userPortfolio
            ? userPortfolio.total_realized_pnl +
              userPortfolio.total_unrealized_pnl
            : 0,
          winRate: this.calculateWinRate(userPortfolio),
        },
        agentFork: {
          portfolio: agentPortfolio,
          currentContext: agentContext,
          pnl: agentPortfolio
            ? agentPortfolio.total_realized_pnl +
              agentPortfolio.total_unrealized_pnl
            : 0,
          winRate: this.calculateWinRate(agentPortfolio),
          status: agentPortfolio?.status ?? 'active',
        },
        comparison: {
          pnlDiff: this.calculatePnlDiff(userPortfolio, agentPortfolio),
          contextDiff,
          agentOutperforming:
            (agentPortfolio?.total_realized_pnl ?? 0) +
              (agentPortfolio?.total_unrealized_pnl ?? 0) >
            (userPortfolio?.total_realized_pnl ?? 0) +
              (userPortfolio?.total_unrealized_pnl ?? 0),
        },
      };

      return buildDashboardSuccess(comparison);
    } catch (error) {
      this.logger.error(
        `Failed to compare forks: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'COMPARE_FAILED',
        error instanceof Error ? error.message : 'Failed to compare forks',
      );
    }
  }

  /**
   * Get summary of all analysts with fork comparisons
   * Uses the v_analyst_fork_comparison view for efficient retrieval
   */
  private async handleForksSummary(
    params?: AnalystParams,
  ): Promise<DashboardActionResult> {
    try {
      const comparisons =
        await this.portfolioRepository.getAnalystForkComparisons();

      // Apply pagination
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 20;
      const startIndex = (page - 1) * pageSize;
      const paginatedComparisons = comparisons.slice(
        startIndex,
        startIndex + pageSize,
      );

      // Calculate summary stats
      const summary = {
        totalAnalysts: comparisons.length,
        agentOutperforming: comparisons.filter((c) => c.balance_diff > 0)
          .length,
        userOutperforming: comparisons.filter((c) => c.balance_diff < 0).length,
        totalAgentPnl: comparisons.reduce(
          (sum, c) => sum + c.agent_realized_pnl + c.agent_unrealized_pnl,
          0,
        ),
        totalUserPnl: comparisons.reduce(
          (sum, c) => sum + c.user_realized_pnl + c.user_unrealized_pnl,
          0,
        ),
        statusBreakdown: {
          active: comparisons.filter((c) => c.agent_status === 'active').length,
          warning: comparisons.filter((c) => c.agent_status === 'warning')
            .length,
          probation: comparisons.filter((c) => c.agent_status === 'probation')
            .length,
          suspended: comparisons.filter((c) => c.agent_status === 'suspended')
            .length,
        },
      };

      return buildDashboardSuccess(
        {
          comparisons: paginatedComparisons,
          summary,
        },
        buildPaginationMetadata(comparisons.length, page, pageSize),
      );
    } catch (error) {
      this.logger.error(
        `Failed to get forks summary: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'SUMMARY_FAILED',
        error instanceof Error ? error.message : 'Failed to get forks summary',
      );
    }
  }

  /**
   * Get context version history for a specific fork
   */
  private async handleGetForkHistory(
    params?: AnalystParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Analyst ID is required');
    }

    const forkType: ForkType = params.forkType ?? 'user';

    try {
      const history =
        await this.portfolioRepository.getAnalystContextVersionHistory(
          params.id,
          forkType,
        );

      // Get analyst info
      const analyst = await this.analystService.findById(params.id);

      return buildDashboardSuccess({
        analyst: analyst
          ? {
              id: analyst.id,
              slug: analyst.slug,
              name: analyst.name,
            }
          : null,
        forkType,
        versionCount: history.length,
        versions: history,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get fork history: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'HISTORY_FAILED',
        error instanceof Error ? error.message : 'Failed to get fork history',
      );
    }
  }

  /**
   * Adopt a specific change from agent fork to user fork
   * Creates a new user context version with the adopted changes
   */
  private async handleAdoptChange(
    params: AnalystParams | undefined,
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Analyst ID is required');
    }

    const adoptionData = payload.params as {
      id?: string;
      changes?: {
        perspective?: string;
        tierInstructions?: Record<string, string | undefined>;
        defaultWeight?: number;
      };
      reason?: string;
    };

    if (!adoptionData.changes) {
      return buildDashboardError(
        'MISSING_CHANGES',
        'Changes to adopt are required',
      );
    }

    try {
      // Get current user context
      const userContext =
        await this.portfolioRepository.getCurrentAnalystContextVersion(
          params.id,
          'user',
        );

      if (!userContext) {
        return buildDashboardError(
          'NO_USER_CONTEXT',
          'User fork has no context version to update',
        );
      }

      // Create new user context version with adopted changes
      const newVersion =
        await this.portfolioRepository.createAnalystContextVersion({
          analyst_id: params.id,
          fork_type: 'user',
          perspective:
            adoptionData.changes.perspective ?? userContext.perspective,
          tier_instructions:
            adoptionData.changes.tierInstructions ??
            userContext.tier_instructions,
          default_weight:
            adoptionData.changes.defaultWeight ?? userContext.default_weight,
          change_reason:
            adoptionData.reason ?? 'Adopted changes from agent fork',
          changed_by: 'user',
        });

      this.logger.log(
        `User adopted changes from agent fork for analyst ${params.id}, created version ${newVersion.version_number}`,
      );

      return buildDashboardSuccess({
        adopted: true,
        analystId: params.id,
        previousVersion: userContext.version_number,
        newVersion: newVersion.version_number,
        changes: adoptionData.changes,
      });
    } catch (error) {
      this.logger.error(
        `Failed to adopt change: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'ADOPT_FAILED',
        error instanceof Error ? error.message : 'Failed to adopt change',
      );
    }
  }

  /**
   * Rollback an analyst's context to a previous version
   * Creates a new version that copies content from the target version
   */
  private async handleRollback(
    params: AnalystParams | undefined,
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Analyst ID is required');
    }

    const rollbackData = payload.params as {
      id?: string;
      targetVersionId?: string;
      forkType?: ForkType;
      reason?: string;
    };

    if (!rollbackData.targetVersionId) {
      return buildDashboardError(
        'MISSING_VERSION_ID',
        'Target version ID is required for rollback',
      );
    }

    const forkType: ForkType = rollbackData.forkType ?? 'user';
    const reason = rollbackData.reason ?? 'Manual rollback';

    try {
      // Get analyst info first
      const analyst = await this.analystService.findById(params.id);
      if (!analyst) {
        return buildDashboardError('NOT_FOUND', 'Analyst not found');
      }

      // Get the target version to show what we're rolling back to
      const targetVersion =
        await this.portfolioRepository.getAnalystContextVersionById(
          rollbackData.targetVersionId,
        );

      if (!targetVersion) {
        return buildDashboardError(
          'VERSION_NOT_FOUND',
          'Target version not found',
        );
      }

      // Perform the rollback
      const newVersion =
        await this.portfolioRepository.rollbackAnalystContextVersion(
          params.id,
          forkType,
          rollbackData.targetVersionId,
          reason,
        );

      this.logger.log(
        `Rolled back analyst ${analyst.slug} ${forkType} fork to v${targetVersion.version_number}, created new v${newVersion.version_number}`,
      );

      return buildDashboardSuccess({
        success: true,
        analyst: {
          id: analyst.id,
          slug: analyst.slug,
          name: analyst.name,
        },
        forkType,
        rolledBackTo: {
          versionId: targetVersion.id,
          versionNumber: targetVersion.version_number,
          changeReason: targetVersion.change_reason,
          changedBy: targetVersion.changed_by,
          createdAt: targetVersion.created_at,
        },
        newVersion: {
          versionId: newVersion.id,
          versionNumber: newVersion.version_number,
          changeReason: newVersion.change_reason,
        },
        reason,
      });
    } catch (error) {
      this.logger.error(
        `Failed to rollback: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'ROLLBACK_FAILED',
        error instanceof Error ? error.message : 'Failed to rollback',
      );
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private calculateWinRate(portfolio: AnalystPortfolio | null): number {
    if (!portfolio) return 0;
    const total = portfolio.win_count + portfolio.loss_count;
    if (total === 0) return 0;
    return portfolio.win_count / total;
  }

  private calculatePnlDiff(
    userPortfolio: AnalystPortfolio | null,
    agentPortfolio: AnalystPortfolio | null,
  ): {
    absolute: number;
    percent: number;
  } {
    const userPnl =
      (userPortfolio?.total_realized_pnl ?? 0) +
      (userPortfolio?.total_unrealized_pnl ?? 0);
    const agentPnl =
      (agentPortfolio?.total_realized_pnl ?? 0) +
      (agentPortfolio?.total_unrealized_pnl ?? 0);

    const absolute = agentPnl - userPnl;
    const percent = userPnl !== 0 ? (absolute / Math.abs(userPnl)) * 100 : 0;

    return { absolute, percent };
  }

  private calculateContextDiff(
    userContext: AnalystContextVersion | null,
    agentContext: AnalystContextVersion | null,
  ): {
    perspectiveChanged: boolean;
    tierInstructionsChanged: boolean;
    weightChanged: boolean;
    agentHasJournal: boolean;
    summary: string[];
  } {
    const diff: string[] = [];
    let perspectiveChanged = false;
    let tierInstructionsChanged = false;
    let weightChanged = false;
    const agentHasJournal = !!agentContext?.agent_journal;

    if (!userContext || !agentContext) {
      return {
        perspectiveChanged: false,
        tierInstructionsChanged: false,
        weightChanged: false,
        agentHasJournal,
        summary: ['One or both forks have no context version'],
      };
    }

    // Check perspective
    if (userContext.perspective !== agentContext.perspective) {
      perspectiveChanged = true;
      diff.push('Agent has modified perspective');
    }

    // Check tier instructions
    const userTiers = JSON.stringify(userContext.tier_instructions);
    const agentTiers = JSON.stringify(agentContext.tier_instructions);
    if (userTiers !== agentTiers) {
      tierInstructionsChanged = true;
      diff.push('Agent has modified tier instructions');
    }

    // Check weight
    if (userContext.default_weight !== agentContext.default_weight) {
      weightChanged = true;
      diff.push(
        `Agent changed weight from ${userContext.default_weight} to ${agentContext.default_weight}`,
      );
    }

    // Check journal
    if (agentHasJournal) {
      diff.push('Agent has journal entries with self-reflection');
    }

    if (diff.length === 0) {
      diff.push('No differences between forks');
    }

    return {
      perspectiveChanged,
      tierInstructionsChanged,
      weightChanged,
      agentHasJournal,
      summary: diff,
    };
  }
}
