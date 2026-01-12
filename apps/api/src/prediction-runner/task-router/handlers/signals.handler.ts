/**
 * Signals Dashboard Handler
 *
 * Handles dashboard mode requests for signals.
 * Signals are raw data inputs (news, events, social media) detected by sources.
 * Provides filtered access to signals for dashboard analysis.
 *
 * Sprint 4, Task s4-2
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { SignalRepository } from '../../repositories/signal.repository';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
  buildPaginationMetadata,
} from '../dashboard-handler.interface';
import { SignalDisposition } from '../../interfaces/signal.interface';
import { TestDataFilter } from '../../interfaces/test-data.interface';

interface SignalParams {
  id?: string;
  targetId?: string;
  disposition?: SignalDisposition;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  includeTest?: boolean;
}

@Injectable()
export class SignalsHandler implements IDashboardHandler {
  private readonly logger = new Logger(SignalsHandler.name);
  private readonly supportedActions = ['list', 'get'];

  constructor(private readonly signalRepository: SignalRepository) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(
      `[SIGNALS-HANDLER] Executing action: ${action} for org: ${context.orgSlug}`,
    );

    const params = payload.params as SignalParams | undefined;

    switch (action.toLowerCase()) {
      case 'list':
        return this.handleList(params);
      case 'get':
        return this.handleGet(params);
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
   * List signals for a target with filtering and pagination
   * Supports filtering by disposition and test data inclusion
   */
  private async handleList(
    params?: SignalParams,
  ): Promise<DashboardActionResult> {
    if (!params?.targetId) {
      return buildDashboardError('MISSING_TARGET_ID', 'Target ID is required');
    }

    try {
      // Build test data filter
      const testDataFilter: TestDataFilter = {
        includeTestData: params.includeTest ?? false,
      };

      // Fetch signals based on disposition filter
      let signals;
      if (params.disposition) {
        signals = await this.signalRepository.findByTargetAndDisposition(
          params.targetId,
          params.disposition,
          testDataFilter,
        );
      } else {
        // If no disposition specified, get pending signals (most common use case)
        signals = await this.signalRepository.findPendingSignals(
          params.targetId,
          1000, // Large limit to get all, we'll paginate in-memory
          testDataFilter,
        );
      }

      // Simple pagination
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
      const offset = params.offset ?? 0;
      const startIndex = offset > 0 ? offset : (page - 1) * pageSize;
      const paginatedSignals = signals.slice(startIndex, startIndex + pageSize);

      return buildDashboardSuccess(
        paginatedSignals,
        buildPaginationMetadata(signals.length, page, pageSize),
      );
    } catch (error) {
      this.logger.error(
        `Failed to list signals: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'LIST_FAILED',
        error instanceof Error ? error.message : 'Failed to list signals',
      );
    }
  }

  /**
   * Get a single signal by ID
   */
  private async handleGet(
    params?: SignalParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Signal ID is required');
    }

    try {
      const signal = await this.signalRepository.findById(params.id);
      if (!signal) {
        return buildDashboardError(
          'NOT_FOUND',
          `Signal not found: ${params.id}`,
        );
      }

      return buildDashboardSuccess(signal);
    } catch (error) {
      this.logger.error(
        `Failed to get signal: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'GET_FAILED',
        error instanceof Error ? error.message : 'Failed to get signal',
      );
    }
  }
}
