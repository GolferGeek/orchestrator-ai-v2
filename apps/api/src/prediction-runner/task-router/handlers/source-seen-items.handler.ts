/**
 * Source Seen Items Handler
 *
 * Handles dashboard mode requests for source seen items data.
 * Provides visibility into crawled source items for the dashboard.
 *
 * Sprint 4, Task s4-1 - Source Seen Items Dashboard Handler
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { SourceSeenItemRepository } from '../../repositories/source-seen-item.repository';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
} from '../dashboard-handler.interface';

interface ListParams {
  sourceId: string;
  limit?: number;
  offset?: number;
}

interface StatsParams {
  sourceId?: string;
}

@Injectable()
export class SourceSeenItemsHandler implements IDashboardHandler {
  private readonly logger = new Logger(SourceSeenItemsHandler.name);
  private readonly supportedActions = ['list', 'stats'];

  constructor(
    private readonly sourceSeenItemRepository: SourceSeenItemRepository,
  ) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(
      `[SOURCE-SEEN-ITEMS-HANDLER] Executing action: ${action} for org: ${context.orgSlug}`,
    );

    const params = payload.params as Record<string, unknown> | undefined;

    switch (action.toLowerCase()) {
      case 'list':
        return this.handleList(params as ListParams | undefined, context);
      case 'stats':
        return this.handleStats(params as StatsParams | undefined, context);
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
   * List seen items for a source
   * Params: sourceId (required), limit (optional), offset (optional)
   */
  private async handleList(
    params?: ListParams,
    context?: ExecutionContext,
  ): Promise<DashboardActionResult> {
    if (!context?.orgSlug) {
      return buildDashboardError(
        'MISSING_ORG_SLUG',
        'Organization slug is required',
      );
    }

    if (!params?.sourceId) {
      return buildDashboardError(
        'MISSING_SOURCE_ID',
        'sourceId parameter is required for list action',
      );
    }

    try {
      const limit = params.limit ?? 100;
      const offset = params.offset ?? 0;

      // Get seen items for the source
      const items = await this.sourceSeenItemRepository.findRecentBySourceId(
        params.sourceId,
        limit + offset, // Fetch more to handle offset
      );

      // Apply offset manually
      const paginatedItems = items.slice(offset, offset + limit);

      // Get total count (we use the full array length as approximation)
      const totalCount = items.length;

      return buildDashboardSuccess(paginatedItems, {
        totalCount,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasMore: totalCount > offset + limit,
      });
    } catch (error) {
      this.logger.error(
        `Failed to list seen items: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'LIST_SEEN_ITEMS_FAILED',
        error instanceof Error ? error.message : 'Failed to list seen items',
      );
    }
  }

  /**
   * Get statistics about seen items
   * Params: sourceId (optional - if provided, stats for that source; otherwise all sources)
   */
  private async handleStats(
    params?: StatsParams,
    context?: ExecutionContext,
  ): Promise<DashboardActionResult> {
    if (!context?.orgSlug) {
      return buildDashboardError(
        'MISSING_ORG_SLUG',
        'Organization slug is required',
      );
    }

    try {
      if (params?.sourceId) {
        // Get stats for a specific source
        const stats = await this.getSourceStats(params.sourceId);
        return buildDashboardSuccess(stats);
      } else {
        // Get stats across all sources (would require additional repository methods)
        // For now, return error indicating sourceId is required
        return buildDashboardError(
          'SOURCE_ID_REQUIRED',
          'sourceId parameter is required for stats action. All-sources stats not yet implemented.',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to get seen items stats: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'STATS_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to get seen items stats',
      );
    }
  }

  /**
   * Get statistics for a specific source
   */
  private async getSourceStats(sourceId: string): Promise<{
    sourceId: string;
    totalSeenItems: number;
    seenToday: number;
    lastSeenAt: string | null;
  }> {
    // Get recent items (we'll analyze these for stats)
    const items = await this.sourceSeenItemRepository.findRecentBySourceId(
      sourceId,
      1000, // Get up to 1000 items for stats
    );

    // Calculate stats
    const totalSeenItems = items.length;

    // Get today's timestamp (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count items seen today
    const seenToday = items.filter((item) => {
      const lastSeen = new Date(item.last_seen_at);
      return lastSeen >= today;
    }).length;

    // Get last seen timestamp
    const firstItem = items[0];
    const lastSeenAt = firstItem ? firstItem.last_seen_at : null;

    return {
      sourceId,
      totalSeenItems,
      seenToday,
      lastSeenAt,
    };
  }
}
