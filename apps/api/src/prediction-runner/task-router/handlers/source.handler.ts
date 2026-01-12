/**
 * Source Dashboard Handler
 *
 * Handles dashboard mode requests for prediction sources.
 * Sources are data feeds (web, RSS, API) that generate signals.
 * Includes test-crawl action to preview crawl results without persisting.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { SourceRepository } from '../../repositories/source.repository';
import { SourceCrawlerService } from '../../services/source-crawler.service';
import { FirecrawlService } from '../../services/firecrawl.service';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
  buildPaginationMetadata,
} from '../dashboard-handler.interface';
import {
  Source,
  CreateSourceData,
  UpdateSourceData,
  CrawlConfig,
  AuthConfig,
} from '../../interfaces/source.interface';

interface SourceFilters {
  targetId?: string;
  universeId?: string;
  scopeLevel?: string;
  sourceType?: string;
  isActive?: boolean;
}

interface SourceParams {
  id?: string;
  targetId?: string;
  universeId?: string;
  filters?: SourceFilters;
  page?: number;
  pageSize?: number;
  // Test crawl params
  url?: string;
  crawlConfig?: Record<string, unknown>;
}

/**
 * camelCase params from transport-types contract
 * Maps to snake_case DTOs for database persistence
 */
interface CreateSourceParams {
  targetId?: string;
  universeId?: string;
  domain?: 'stocks' | 'crypto' | 'elections' | 'polymarket';
  scopeLevel: string;
  name: string;
  sourceType: string;
  url: string;
  crawlConfig?: CrawlConfig;
  authConfig?: AuthConfig;
  crawlFrequencyMinutes?: number;
  isActive?: boolean;
}

interface UpdateSourceParams {
  name?: string;
  description?: string;
  url?: string;
  crawlConfig?: CrawlConfig;
  authConfig?: AuthConfig;
  crawlFrequencyMinutes?: number;
  isActive?: boolean;
}

@Injectable()
export class SourceHandler implements IDashboardHandler {
  private readonly logger = new Logger(SourceHandler.name);
  private readonly supportedActions = [
    'list',
    'get',
    'create',
    'update',
    'delete',
    'testCrawl',
  ];

  constructor(
    private readonly sourceRepository: SourceRepository,
    private readonly sourceCrawlerService: SourceCrawlerService,
    private readonly firecrawlService: FirecrawlService,
  ) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(
      `[SOURCE-HANDLER] Executing action: ${action} for org: ${context.orgSlug}`,
    );

    const params = payload.params as SourceParams | undefined;

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
      case 'testcrawl':
      case 'test-crawl':
        return this.handleTestCrawl(params, payload);
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
    params?: SourceParams,
  ): Promise<DashboardActionResult> {
    try {
      let sources: Source[];

      // Determine scope for listing using findByScope
      const targetId = params?.targetId || params?.filters?.targetId;
      const universeId = params?.universeId || params?.filters?.universeId;
      const scopeLevel = params?.filters?.scopeLevel;

      if (targetId) {
        sources = await this.sourceRepository.findByScope('target', targetId);
      } else if (universeId) {
        sources = await this.sourceRepository.findByScope(
          'universe',
          universeId,
        );
      } else if (scopeLevel) {
        sources = await this.sourceRepository.findByScope(
          scopeLevel as 'runner' | 'domain' | 'universe' | 'target',
        );
      } else {
        // Get runner-level (global) sources
        sources = await this.sourceRepository.findByScope('runner');
      }

      // Apply additional filters
      let filtered = sources;

      if (params?.filters?.sourceType) {
        filtered = filtered.filter(
          (s) => s.source_type === params.filters!.sourceType,
        );
      }

      if (params?.filters?.isActive !== undefined) {
        filtered = filtered.filter(
          (s) => s.is_active === params.filters!.isActive,
        );
      }

      // Simple pagination
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 20;
      const startIndex = (page - 1) * pageSize;
      const paginatedSources = filtered.slice(
        startIndex,
        startIndex + pageSize,
      );

      return buildDashboardSuccess(
        paginatedSources,
        buildPaginationMetadata(filtered.length, page, pageSize),
      );
    } catch (error) {
      this.logger.error(
        `Failed to list sources: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'LIST_FAILED',
        error instanceof Error ? error.message : 'Failed to list sources',
      );
    }
  }

  private async handleGet(
    params?: SourceParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Source ID is required');
    }

    try {
      const source = await this.sourceRepository.findById(params.id);
      if (!source) {
        return buildDashboardError(
          'NOT_FOUND',
          `Source not found: ${params.id}`,
        );
      }

      return buildDashboardSuccess(source);
    } catch (error) {
      this.logger.error(
        `Failed to get source: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'GET_FAILED',
        error instanceof Error ? error.message : 'Failed to get source',
      );
    }
  }

  private async handleCreate(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    // Accept camelCase params from transport contract
    const data = payload.params as unknown as CreateSourceParams;

    if (!data.name || !data.sourceType || !data.url || !data.scopeLevel) {
      return buildDashboardError(
        'INVALID_DATA',
        'name, sourceType, url, and scopeLevel are required',
      );
    }

    try {
      // Map camelCase params to snake_case DTO for database
      const createData: CreateSourceData = {
        target_id: data.targetId,
        universe_id: data.universeId,
        domain: data.domain,
        scope_level: data.scopeLevel as
          | 'runner'
          | 'domain'
          | 'universe'
          | 'target',
        name: data.name,
        source_type: data.sourceType as
          | 'web'
          | 'rss'
          | 'twitter_search'
          | 'api',
        url: data.url,
        crawl_config: data.crawlConfig,
        auth_config: data.authConfig,
        crawl_frequency_minutes: (data.crawlFrequencyMinutes || 15) as
          | 5
          | 10
          | 15
          | 30
          | 60,
        is_active: data.isActive ?? true,
      };

      const source = await this.sourceRepository.create(createData);
      return buildDashboardSuccess(source);
    } catch (error) {
      this.logger.error(
        `Failed to create source: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'CREATE_FAILED',
        error instanceof Error ? error.message : 'Failed to create source',
      );
    }
  }

  private async handleUpdate(
    params: SourceParams | undefined,
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Source ID is required');
    }

    // Accept camelCase params from transport contract
    const data = payload.params as unknown as UpdateSourceParams;

    try {
      // Map camelCase params to snake_case DTO for database
      const updateData: UpdateSourceData = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.url !== undefined) updateData.url = data.url;
      if (data.crawlConfig !== undefined)
        updateData.crawl_config = data.crawlConfig;
      if (data.authConfig !== undefined)
        updateData.auth_config = data.authConfig;
      if (data.crawlFrequencyMinutes !== undefined) {
        updateData.crawl_frequency_minutes = data.crawlFrequencyMinutes as
          | 5
          | 10
          | 15
          | 30
          | 60;
      }
      if (data.isActive !== undefined) updateData.is_active = data.isActive;

      const source = await this.sourceRepository.update(params.id, updateData);
      return buildDashboardSuccess(source);
    } catch (error) {
      this.logger.error(
        `Failed to update source: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'UPDATE_FAILED',
        error instanceof Error ? error.message : 'Failed to update source',
      );
    }
  }

  private async handleDelete(
    params?: SourceParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Source ID is required');
    }

    try {
      await this.sourceRepository.delete(params.id);
      return buildDashboardSuccess({ deleted: true, id: params.id });
    } catch (error) {
      this.logger.error(
        `Failed to delete source: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'DELETE_FAILED',
        error instanceof Error ? error.message : 'Failed to delete source',
      );
    }
  }

  /**
   * Test crawl a source without persisting signals
   * Returns preview of what would be crawled
   */
  private async handleTestCrawl(
    params: SourceParams | undefined,
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    // Can either test an existing source or a new URL
    const sourceId = params?.id;
    const testUrl = params?.url || (payload.params as { url?: string })?.url;
    const crawlConfig =
      params?.crawlConfig ||
      (payload.params as { crawlConfig?: Record<string, unknown> })
        ?.crawlConfig;

    try {
      if (sourceId) {
        // Test existing source
        const source = await this.sourceRepository.findById(sourceId);
        if (!source) {
          return buildDashboardError(
            'NOT_FOUND',
            `Source not found: ${sourceId}`,
          );
        }

        // Use firecrawl to test
        const result = await this.firecrawlService.scrapeSource(source);

        return buildDashboardSuccess({
          source,
          testResult: {
            success: result.success,
            itemCount: result.items?.length || 0,
            items: result.items?.slice(0, 5), // Preview first 5 items
            error: result.error,
            durationMs: result.duration_ms,
            creditsUsed: result.credits_used,
          },
        });
      } else if (testUrl) {
        // Test new URL
        const testSource: Partial<Source> = {
          id: 'test-source',
          url: testUrl,
          source_type: 'web',
          crawl_config: (crawlConfig as CrawlConfig) || {},
        };

        const result = await this.firecrawlService.scrapeSource(
          testSource as Source,
        );

        return buildDashboardSuccess({
          testUrl,
          testResult: {
            success: result.success,
            itemCount: result.items?.length || 0,
            items: result.items?.slice(0, 5), // Preview first 5 items
            error: result.error,
            durationMs: result.duration_ms,
            creditsUsed: result.credits_used,
          },
        });
      } else {
        return buildDashboardError(
          'MISSING_PARAMS',
          'Either source id or url is required for test crawl',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to test crawl: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'TEST_CRAWL_FAILED',
        error instanceof Error ? error.message : 'Failed to test crawl',
      );
    }
  }
}
