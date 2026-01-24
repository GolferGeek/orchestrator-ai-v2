import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CrawlerSourceRepository } from './repositories/source.repository';
import { ArticleRepository } from './repositories/article.repository';
import { SourceCrawlRepository } from './repositories/source-crawl.repository';
import {
  Source,
  CreateSourceData,
  UpdateSourceData,
  Article,
  SourceCrawl,
} from './interfaces';

/**
 * Helper to validate org slug from header
 */
function getOrgSlug(orgHeader?: string): string {
  if (!orgHeader) {
    throw new BadRequestException(
      'x-organization-slug header is required for crawler operations',
    );
  }
  return orgHeader;
}

/**
 * DTOs for request/response
 */
interface SubscriptionInfoDto {
  agent_type: 'prediction' | 'risk';
  subscription_id: string;
  target_name?: string;
  scope_name?: string;
  is_active: boolean;
  last_processed_at: string | null;
}

interface SourceWithSubscriptionsDto extends Source {
  article_count: number;
  subscriptions: SubscriptionInfoDto[];
  crawl_stats: {
    total_crawls: number;
    successful_crawls: number;
    total_articles_found: number;
    total_articles_new: number;
    total_duplicates: number;
    avg_duration_ms: number;
  };
}

interface DashboardStatsDto {
  total_sources: number;
  active_sources: number;
  total_articles: number;
  articles_today: number;
  total_crawls_24h: number;
  successful_crawls_24h: number;
  deduplication_stats: {
    exact: number;
    cross_source: number;
    fuzzy_title: number;
    phrase_overlap: number;
  };
}

interface CreateSourceDto {
  name: string;
  description?: string;
  source_type: 'web' | 'rss' | 'twitter_search' | 'api' | 'test_db';
  url: string;
  crawl_config?: {
    selector?: string;
    wait_for_element?: string;
  };
  crawl_frequency_minutes?: 5 | 10 | 15 | 30 | 60;
  is_test?: boolean;
}

interface UpdateSourceDto {
  name?: string;
  description?: string;
  source_type?: 'web' | 'rss' | 'twitter_search' | 'api' | 'test_db';
  url?: string;
  crawl_config?: {
    selector?: string;
    wait_for_element?: string;
  };
  crawl_frequency_minutes?: 5 | 10 | 15 | 30 | 60;
  is_active?: boolean;
  is_test?: boolean;
}

/**
 * CrawlerAdminController - Admin endpoints for central crawler management
 *
 * Provides unified admin view across all agents (prediction, risk, marketing)
 * for managing shared crawling infrastructure.
 */
@Controller('api/crawler/admin')
@UseGuards(JwtAuthGuard)
export class CrawlerAdminController {
  private readonly logger = new Logger(CrawlerAdminController.name);

  constructor(
    private readonly sourceRepository: CrawlerSourceRepository,
    private readonly articleRepository: ArticleRepository,
    private readonly sourceCrawlRepository: SourceCrawlRepository,
  ) {}

  /**
   * Get dashboard statistics
   */
  @Get('stats')
  async getDashboardStats(
    @Headers('x-organization-slug') orgHeader?: string,
  ): Promise<DashboardStatsDto> {
    const orgSlug = getOrgSlug(orgHeader);

    try {
      // Get all sources for org
      const allSources = await this.sourceRepository.findAllForDashboard(orgSlug);
      const activeSources = allSources.filter((s) => s.is_active);

      // Get article counts
      let totalArticles = 0;
      for (const source of allSources) {
        const count = await this.articleRepository.countForSource(source.id);
        totalArticles += count;
      }

      // Get 24h crawl stats
      let totalCrawls24h = 0;
      let successfulCrawls24h = 0;
      let dedupExact = 0;
      let dedupCrossSource = 0;
      let dedupFuzzyTitle = 0;
      let dedupPhraseOverlap = 0;

      for (const source of allSources) {
        const stats = await this.sourceCrawlRepository.getStatsForSource(
          source.id,
          1, // 1 day
        );
        totalCrawls24h += stats.total_crawls;
        successfulCrawls24h += stats.successful_crawls;
      }

      // Get recent crawls for dedup stats
      for (const source of allSources) {
        const recentCrawls = await this.sourceCrawlRepository.findRecentForSource(
          source.id,
          20,
        );
        for (const crawl of recentCrawls) {
          dedupExact += crawl.duplicates_exact;
          dedupCrossSource += crawl.duplicates_cross_source;
          dedupFuzzyTitle += crawl.duplicates_fuzzy_title;
          dedupPhraseOverlap += crawl.duplicates_phrase_overlap;
        }
      }

      return {
        total_sources: allSources.length,
        active_sources: activeSources.length,
        total_articles: totalArticles,
        articles_today: 0, // Would need additional query
        total_crawls_24h: totalCrawls24h,
        successful_crawls_24h: successfulCrawls24h,
        deduplication_stats: {
          exact: dedupExact,
          cross_source: dedupCrossSource,
          fuzzy_title: dedupFuzzyTitle,
          phrase_overlap: dedupPhraseOverlap,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard stats: ${error}`);
      throw new HttpException(
        'Failed to get dashboard stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all sources with stats and subscriptions
   */
  @Get('sources')
  async getSources(
    @Headers('x-organization-slug') orgHeader?: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<SourceWithSubscriptionsDto[]> {
    const orgSlug = getOrgSlug(orgHeader);

    try {
      const sources =
        includeInactive === 'true'
          ? await this.sourceRepository.findAllForDashboard(orgSlug)
          : await this.sourceRepository.findAll(orgSlug);

      const result: SourceWithSubscriptionsDto[] = [];

      for (const source of sources) {
        const articleCount = await this.articleRepository.countForSource(
          source.id,
        );
        const crawlStats = await this.sourceCrawlRepository.getStatsForSource(
          source.id,
          7,
        );

        // TODO: Query subscriptions from prediction.source_subscriptions
        // and risk.source_subscriptions tables
        const subscriptions: SubscriptionInfoDto[] = [];

        result.push({
          ...source,
          article_count: articleCount,
          subscriptions,
          crawl_stats: crawlStats,
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to get sources: ${error}`);
      throw new HttpException(
        'Failed to get sources',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a single source with full details
   */
  @Get('sources/:id')
  async getSource(
    @Headers('x-organization-slug') orgHeader?: string,
    @Param('id') id?: string,
  ): Promise<SourceWithSubscriptionsDto> {
    const orgSlug = getOrgSlug(orgHeader);

    if (!id) {
      throw new BadRequestException('Source ID is required');
    }

    try {
      const source = await this.sourceRepository.findById(id);
      if (!source) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }

      if (source.organization_slug !== orgSlug) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }

      const articleCount = await this.articleRepository.countForSource(id);
      const crawlStats = await this.sourceCrawlRepository.getStatsForSource(
        id,
        7,
      );

      // TODO: Query subscriptions
      const subscriptions: SubscriptionInfoDto[] = [];

      return {
        ...source,
        article_count: articleCount,
        subscriptions,
        crawl_stats: crawlStats,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get source: ${error}`);
      throw new HttpException(
        'Failed to get source',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a new source
   */
  @Post('sources')
  async createSource(
    @Headers('x-organization-slug') orgHeader?: string,
    @Body() body?: CreateSourceDto,
  ): Promise<Source> {
    const orgSlug = getOrgSlug(orgHeader);

    if (!body) {
      throw new BadRequestException('Request body is required');
    }

    try {
      const sourceData: CreateSourceData = {
        organization_slug: orgSlug,
        name: body.name,
        description: body.description ?? null,
        source_type: body.source_type,
        url: body.url,
        crawl_config: body.crawl_config ?? {},
        crawl_frequency_minutes: body.crawl_frequency_minutes ?? 60,
        is_test: body.is_test ?? false,
        is_active: true,
      };

      // Use findOrCreate to prevent duplicates
      const source = await this.sourceRepository.findOrCreate(sourceData);
      this.logger.log(`Created/found source: ${source.name} (${source.id})`);

      return source;
    } catch (error) {
      this.logger.error(`Failed to create source: ${error}`);
      throw new HttpException(
        'Failed to create source',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update a source
   */
  @Put('sources/:id')
  async updateSource(
    @Headers('x-organization-slug') orgHeader?: string,
    @Param('id') id?: string,
    @Body() body?: UpdateSourceDto,
  ): Promise<Source> {
    const orgSlug = getOrgSlug(orgHeader);

    if (!id) {
      throw new BadRequestException('Source ID is required');
    }

    if (!body) {
      throw new BadRequestException('Request body is required');
    }

    try {
      // Verify ownership
      const existing = await this.sourceRepository.findById(id);
      if (!existing || existing.organization_slug !== orgSlug) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }

      const updateData: UpdateSourceData = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined)
        updateData.description = body.description;
      if (body.source_type !== undefined)
        updateData.source_type = body.source_type;
      if (body.url !== undefined) updateData.url = body.url;
      if (body.crawl_config !== undefined)
        updateData.crawl_config = body.crawl_config;
      if (body.crawl_frequency_minutes !== undefined)
        updateData.crawl_frequency_minutes = body.crawl_frequency_minutes;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.is_test !== undefined) updateData.is_test = body.is_test;

      const source = await this.sourceRepository.update(id, updateData);
      return source;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to update source: ${error}`);
      throw new HttpException(
        'Failed to update source',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a source (soft delete - sets is_active = false)
   */
  @Delete('sources/:id')
  async deleteSource(
    @Headers('x-organization-slug') orgHeader?: string,
    @Param('id') id?: string,
  ): Promise<{ success: boolean }> {
    const orgSlug = getOrgSlug(orgHeader);

    if (!id) {
      throw new BadRequestException('Source ID is required');
    }

    try {
      // Verify ownership
      const existing = await this.sourceRepository.findById(id);
      if (!existing || existing.organization_slug !== orgSlug) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }

      // Soft delete
      await this.sourceRepository.update(id, { is_active: false });
      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to delete source: ${error}`);
      throw new HttpException(
        'Failed to delete source',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get recent crawl history for a source
   */
  @Get('sources/:id/crawls')
  async getSourceCrawls(
    @Headers('x-organization-slug') orgHeader?: string,
    @Param('id') id?: string,
    @Query('limit') limit?: string,
  ): Promise<SourceCrawl[]> {
    const orgSlug = getOrgSlug(orgHeader);

    if (!id) {
      throw new BadRequestException('Source ID is required');
    }

    try {
      // Verify ownership
      const existing = await this.sourceRepository.findById(id);
      if (!existing || existing.organization_slug !== orgSlug) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }

      const crawls = await this.sourceCrawlRepository.findRecentForSource(
        id,
        limit ? parseInt(limit, 10) : 10,
      );
      return crawls;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get source crawls: ${error}`);
      throw new HttpException(
        'Failed to get source crawls',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get recent articles for a source
   */
  @Get('sources/:id/articles')
  async getSourceArticles(
    @Headers('x-organization-slug') orgHeader?: string,
    @Param('id') id?: string,
    @Query('limit') limit?: string,
    @Query('since') since?: string,
  ): Promise<Article[]> {
    const orgSlug = getOrgSlug(orgHeader);

    if (!id) {
      throw new BadRequestException('Source ID is required');
    }

    try {
      // Verify ownership
      const existing = await this.sourceRepository.findById(id);
      if (!existing || existing.organization_slug !== orgSlug) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }

      const sinceDate = since ? new Date(since) : new Date(0);
      const articles = await this.articleRepository.findNewForSource(
        id,
        sinceDate,
        limit ? parseInt(limit, 10) : 50,
      );
      return articles;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get source articles: ${error}`);
      throw new HttpException(
        'Failed to get source articles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
