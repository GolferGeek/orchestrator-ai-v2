/**
 * Missed Opportunity Dashboard Handler
 *
 * Handles dashboard mode requests for missed opportunity analysis.
 * Missed opportunities are significant price moves that were not predicted.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { MissedOpportunityDetectionService } from '../../services/missed-opportunity-detection.service';
import { MissedOpportunityAnalysisService } from '../../services/missed-opportunity-analysis.service';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
  buildPaginationMetadata,
} from '../dashboard-handler.interface';
import type {
  MissedOpportunity,
  MissDetectionConfig,
} from '../../interfaces/missed-opportunity.interface';

interface MissedOpportunityFilters {
  targetId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  minMovePercent?: number;
}

interface MissedOpportunityParams {
  id?: string;
  targetId?: string;
  filters?: MissedOpportunityFilters;
  page?: number;
  pageSize?: number;
  // Detection params
  detectionConfig?: MissDetectionConfig;
}

@Injectable()
export class MissedOpportunityHandler implements IDashboardHandler {
  private readonly logger = new Logger(MissedOpportunityHandler.name);
  private readonly supportedActions = ['list', 'detect', 'analyze'];

  constructor(
    private readonly detectionService: MissedOpportunityDetectionService,
    private readonly analysisService: MissedOpportunityAnalysisService,
  ) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(
      `[MISSED-OPPORTUNITY-HANDLER] Executing action: ${action} for org: ${context.orgSlug}`,
    );

    const params = payload.params as MissedOpportunityParams | undefined;

    switch (action.toLowerCase()) {
      case 'list':
      case 'detect':
        return this.handleDetect(params);
      case 'analyze':
        return this.handleAnalyze(params, context);
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

  /**
   * Detect missed opportunities for a target
   * Runs detection to find unpredicted significant moves
   */
  private async handleDetect(
    params?: MissedOpportunityParams,
  ): Promise<DashboardActionResult> {
    const targetId = params?.targetId || params?.filters?.targetId;

    if (!targetId) {
      return buildDashboardError(
        'MISSING_TARGET_ID',
        'Target ID is required to detect missed opportunities',
      );
    }

    try {
      // Detect missed opportunities for the target
      const opportunities =
        await this.detectionService.detectMissedOpportunities(
          targetId,
          params?.detectionConfig,
        );

      // Apply additional filters
      let filtered: MissedOpportunity[] = opportunities;

      if (params?.filters?.status) {
        filtered = filtered.filter(
          (o) => o.analysis_status === params.filters!.status,
        );
      }

      if (params?.filters?.fromDate) {
        const fromDate = new Date(params.filters.fromDate);
        filtered = filtered.filter((o) => new Date(o.move_start) >= fromDate);
      }

      if (params?.filters?.toDate) {
        const toDate = new Date(params.filters.toDate);
        filtered = filtered.filter((o) => new Date(o.move_start) <= toDate);
      }

      if (params?.filters?.minMovePercent !== undefined) {
        filtered = filtered.filter(
          (o) => Math.abs(o.move_percentage) >= params.filters!.minMovePercent!,
        );
      }

      // Sort by significance score (highest first)
      filtered.sort((a, b) => b.significance_score - a.significance_score);

      // Simple pagination
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 20;
      const startIndex = (page - 1) * pageSize;
      const paginatedOpportunities = filtered.slice(
        startIndex,
        startIndex + pageSize,
      );

      return buildDashboardSuccess(
        paginatedOpportunities,
        buildPaginationMetadata(filtered.length, page, pageSize),
      );
    } catch (error) {
      this.logger.error(
        `Failed to detect missed opportunities: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'DETECT_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to detect missed opportunities',
      );
    }
  }

  /**
   * Analyze a specific missed opportunity
   * Runs full analysis to find root causes and suggest learnings
   */
  private async handleAnalyze(
    params: MissedOpportunityParams | undefined,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError(
        'MISSING_ID',
        'Missed opportunity ID is required for analysis',
      );
    }

    try {
      const analysis = await this.analysisService.analyzeMissedOpportunity(
        params.id,
        context,
      );

      return buildDashboardSuccess({
        missedOpportunityId: params.id,
        analysis,
      });
    } catch (error) {
      this.logger.error(
        `Failed to analyze missed opportunity: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'ANALYZE_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to analyze missed opportunity',
      );
    }
  }
}
